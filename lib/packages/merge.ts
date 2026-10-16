/**
 * Import planning: detects name conflicts with an existing universe, applies
 * the player's resolutions (rename, import as new, skip, use existing), gives
 * every imported record a fresh id and repairs references so the rows can be
 * inserted without touching anything already in the save.
 */
import type { UniverseCollectionKey, UniverseState } from "@/lib/domain/entities";
import { UNIVERSE_TABLES } from "@/lib/domain/entities";
import { normalisePairs, pruneDangling, type PruneReport } from "./refs";
import { COLLECTION_SCHEMAS, MATCHABLE, MEDIA_COLUMNS, PACKAGE_KIND_LABELS, PackageError, type PackageContent, type ValidPackage } from "./schema";
import { countRows } from "./validate";

export type ResolutionAction = "rename" | "new" | "skip" | "existing";
export interface Resolution {
  action: ResolutionAction;
  /** New name when renaming; defaults to "<name> (2)". */
  name?: string;
}

export interface ImportConflict {
  key: string;
  collection: UniverseCollectionKey;
  id: string;
  name: string;
  existingId: string;
  existingName: string;
  suggestedName: string;
}

export interface ImportAnalysis {
  kind: ValidPackage["kind"];
  kindLabel: string;
  title: string;
  description: string;
  counts: Partial<Record<UniverseCollectionKey, number>>;
  conflicts: ImportConflict[];
  mediaCount: number;
  /** True when some rows need a promotion and the package doesn't include one. */
  needsPromotion: boolean;
  /** Universe and scenario packages always become a new universe. */
  createsUniverse: boolean;
  attribution: ValidPackage["attribution"];
}

export const COLLECTION_LABELS: Record<UniverseCollectionKey, string> = {
  promotions: "Promotions",
  venues: "Venues",
  wrestlers: "Wrestlers",
  rosterMemberships: "Roster spots",
  contracts: "Contracts",
  injuries: "Injuries",
  teams: "Teams & factions",
  teamMemberships: "Team members",
  chemistry: "Chemistry pairs",
  championships: "Championships",
  titleReigns: "Title reigns",
  titleReignHolders: "Reign holders",
  shows: "Shows",
  tournaments: "Tournaments",
  segments: "Segments",
  segmentParticipants: "Segment participants",
  segmentResults: "Results",
  storylines: "Storylines",
  storylineParticipants: "Storyline participants",
  storylineDevelopments: "Storyline developments",
  rivalries: "Rivalries",
  businessDeals: "Business deals",
  financialTransactions: "Transactions",
  timelineEvents: "Timeline events",
};

const NAME_LIMITS: Partial<Record<UniverseCollectionKey, number>> = { promotions: 80, venues: 80, wrestlers: 60, teams: 80, championships: 80, storylines: 120 };

export const createsUniverse = (pkg: Pick<ValidPackage, "kind">) => pkg.kind === "universe" || pkg.kind === "scenario";

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueName(base: string, taken: Set<string>, max: number): string {
  for (let n = 2; n < 1000; n++) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, max - suffix.length) + suffix;
    if (!taken.has(norm(candidate))) return candidate;
  }
  return base.slice(0, max);
}

export function analysePackage(pkg: ValidPackage, target: UniverseState | null): ImportAnalysis {
  const conflicts: ImportConflict[] = [];
  const intoExisting = target && !createsUniverse(pkg);
  if (intoExisting) {
    for (const [collection, col] of Object.entries(MATCHABLE) as Array<[UniverseCollectionKey, string]>) {
      const existing = (target[collection] as unknown as Array<Record<string, unknown>>).filter((r) => !r.archived_at);
      const byName = new Map(existing.map((r) => [norm(r[col]), r]));
      const taken = new Set(existing.map((r) => norm(r[col])));
      for (const row of pkg.content[collection] ?? []) {
        const match = byName.get(norm(row[col]));
        if (!match) continue;
        conflicts.push({
          key: `${collection}:${row.id}`,
          collection,
          id: String(row.id),
          name: String(row[col]),
          existingId: String(match.id),
          existingName: String(match[col]),
          suggestedName: uniqueName(String(row[col]), taken, NAME_LIMITS[collection] ?? 80),
        });
      }
    }
  }
  const needsPromotion =
    !createsUniverse(pkg) &&
    !(pkg.content.promotions?.length) &&
    Boolean(pkg.content.championships?.length || pkg.content.rosterMemberships?.length || pkg.content.contracts?.length);
  return {
    kind: pkg.kind,
    kindLabel: PACKAGE_KIND_LABELS[pkg.kind],
    title: pkg.title,
    description: pkg.description,
    counts: countRows(pkg.content),
    conflicts,
    mediaCount: pkg.media.length,
    needsPromotion,
    createsUniverse: createsUniverse(pkg),
    attribution: pkg.attribution,
  };
}

/** The default for each conflict: link to the existing record. */
export function defaultResolutions(analysis: ImportAnalysis): Record<string, Resolution> {
  return Object.fromEntries(analysis.conflicts.map((c) => [c.key, { action: "existing" as const }]));
}

export interface PrepareOptions {
  /** The universe receiving the rows (its id is forced on every row). */
  targetUniverseId: string;
  /** Existing state when importing into a save; null for a new universe. */
  target: UniverseState | null;
  resolutions?: Record<string, Resolution>;
  defaultPromotionId?: string | null;
  /** Package media id -> stored asset id. Unmapped media columns are cleared. */
  mediaMap?: Map<string, string>;
  newId?: () => string;
  now?: string;
}

export interface PreparedImport {
  rows: Record<string, unknown[]>;
  counts: Partial<Record<UniverseCollectionKey, number>>;
  report: PruneReport & { skipped: number; linked: number; renamed: number };
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Relationship rows that only connect other records; dropped when every record they connect already existed. */
const LINK_COLLECTIONS: UniverseCollectionKey[] = ["rosterMemberships", "contracts", "teamMemberships", "chemistry", "rivalries", "injuries", "titleReigns", "storylineParticipants"];

export function preparePackageImport(pkg: ValidPackage, options: PrepareOptions): PreparedImport {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? new Date().toISOString();
  const resolutions = options.resolutions ?? {};
  const target = createsUniverse(pkg) ? null : options.target;
  if (!createsUniverse(pkg) && !target) throw new PackageError("Choose a universe to import into.");

  let skipped = 0;
  let linked = 0;
  let renamed = 0;

  // 1. Decide each row's fate and new id.
  const mapping = new Map<string, string>();
  const existingLinks = new Set<string>(); // package ids mapped onto existing records
  const content: PackageContent = {};
  const taken = new Map<UniverseCollectionKey, Set<string>>();
  for (const [collection, col] of Object.entries(MATCHABLE) as Array<[UniverseCollectionKey, string]>) {
    const names = new Set<string>();
    for (const r of (target?.[collection] ?? []) as unknown as Array<Record<string, unknown>>) names.add(norm(r[col]));
    taken.set(collection, names);
  }
  const existingNames = new Map<string, string>(); // key -> existing id, recomputed from target for safety
  if (target) {
    for (const [collection, col] of Object.entries(MATCHABLE) as Array<[UniverseCollectionKey, string]>) {
      for (const r of target[collection] as unknown as Array<Record<string, unknown>>) {
        if (!r.archived_at) existingNames.set(`${collection}:${norm(r[col])}`, String(r.id));
      }
    }
  }

  for (const [collection] of UNIVERSE_TABLES) {
    const rows = pkg.content[collection];
    if (!rows?.length) continue;
    const nameCol = MATCHABLE[collection];
    const out: Array<Record<string, unknown>> = [];
    for (const original of rows) {
      const row = { ...original };
      const id = typeof row.id === "string" ? row.id.toLowerCase() : null;
      if (id && nameCol && target) {
        const resolution = resolutions[`${collection}:${id}`] ?? resolutions[`${collection}:${row.id}`];
        const existingId = existingNames.get(`${collection}:${norm(row[nameCol])}`);
        if (existingId) {
          const action = resolution?.action ?? "existing";
          if (action === "existing") {
            mapping.set(id, existingId);
            existingLinks.add(existingId);
            linked++;
            continue;
          }
          if (action === "skip") {
            mapping.set(id, newId()); // points nowhere, so references to it are repaired below
            skipped++;
            continue;
          }
          if (action === "rename") {
            const max = NAME_LIMITS[collection] ?? 80;
            const wanted = resolution?.name?.trim().slice(0, max);
            row[nameCol] = wanted && !taken.get(collection)!.has(norm(wanted)) ? wanted : uniqueName(String(row[nameCol]), taken.get(collection)!, max);
            renamed++;
          }
        } else if (resolution?.action === "skip") {
          mapping.set(id, newId());
          skipped++;
          continue;
        }
        taken.get(collection)!.add(norm(row[nameCol]));
      }
      if (id) mapping.set(id, newId());
      out.push(row);
    }
    if (out.length) content[collection] = out;
  }

  // 2. Rewrite every package id (including ids inside JSON details) in one pass.
  const remapped = JSON.parse(
    JSON.stringify(content).replace(UUID_RE, (match) => mapping.get(match.toLowerCase()) ?? match),
  ) as PackageContent;

  // 3. Relationship rows between records that already existed would duplicate or
  //    rewrite the save's own history, so they are not imported.
  const targetIds = new Set<string>();
  if (target) {
    for (const [key] of UNIVERSE_TABLES) for (const r of target[key] as Array<{ id?: string }>) if (r.id) targetIds.add(r.id);
  }
  for (const key of LINK_COLLECTIONS) {
    const rows = remapped[key];
    if (!rows || !target) continue;
    remapped[key] = rows.filter((row) => {
      const refs = ["wrestler_id", "promotion_id", "team_id", "wrestler_a", "wrestler_b", "championship_id", "storyline_id"]
        .map((c) => row[c])
        .filter((v): v is string => typeof v === "string");
      if (key === "titleReigns" && existingLinks.has(String(row.championship_id))) return false;
      return refs.length === 0 || !refs.every((v) => targetIds.has(v));
    });
  }

  // 4. Media columns point at newly stored assets only.
  for (const [key, col] of Object.entries(MEDIA_COLUMNS) as Array<[UniverseCollectionKey, string]>) {
    for (const row of remapped[key] ?? []) {
      const value = row[col];
      row[col] = typeof value === "string" ? (options.mediaMap?.get(value) ?? null) : null;
    }
  }

  // 5. Repair references, then normalise pair tables.
  const external = targetIds;
  const defaultPromotionId = options.defaultPromotionId && targetIds.has(options.defaultPromotionId) ? options.defaultPromotionId : null;
  const { content: pruned, report } = pruneDangling(remapped, { external, defaultPromotionId });
  normalisePairs(pruned);

  // 6. Final rows with the target universe id and fresh timestamps, re-validated.
  const rows: Record<string, unknown[]> = {};
  for (const [key, table] of UNIVERSE_TABLES) {
    const list = pruned[key];
    if (!list?.length) continue;
    const schema = COLLECTION_SCHEMAS[key];
    rows[table] = list.map((row) => {
      const full = { ...row, universe_id: options.targetUniverseId, created_at: now, updated_at: now };
      const result = schema.safeParse(full);
      if (!result.success) {
        const issue = result.error.issues[0];
        throw new PackageError(`Couldn't prepare ${COLLECTION_LABELS[key].toLowerCase()} for import (${issue.path.join(".")}: ${issue.message}).`);
      }
      return result.data;
    });
  }
  return { rows, counts: countRows(pruned), report: { ...report, skipped, linked, renamed } };
}
