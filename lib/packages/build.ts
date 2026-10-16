/**
 * Builds packages from universe state: a full universe backup, a scenario
 * (universe setup without history), or a single entity with the records it
 * needs to stand on its own.
 */
import type { UniverseCollectionKey, UniverseState } from "@/lib/domain/entities";
import { UNIVERSE_TABLES } from "@/lib/domain/entities";
import { normalisePairs, pruneDangling } from "./refs";
import { MEDIA_COLUMNS, PACKAGE_FORMAT, PACKAGE_SCHEMA_VERSION, PackageError, type PackageContent, type PackageEnvelope, type PackageKind } from "./schema";
import { stripRow } from "./validate";

export const GENERATOR = "pwbs-web/1";

export interface BuildOptions {
  kind: PackageKind;
  /** Root entity for single-entity packages. */
  rootId?: string | null;
  title?: string;
  description?: string;
  now?: Date;
}

type Rows = Array<Record<string, unknown>>;

function rowsOf(state: UniverseState, key: UniverseCollectionKey): Rows {
  return state[key] as unknown as Rows;
}

function pick(state: UniverseState, key: UniverseCollectionKey, filter: (row: Record<string, unknown>) => boolean): Rows {
  return rowsOf(state, key).filter(filter);
}

/** Collects package content for the requested kind. */
export function selectContent(state: UniverseState, kind: PackageKind, rootId?: string | null): { content: PackageContent; rootName: string } {
  const content: PackageContent = {};
  const set = (key: UniverseCollectionKey, rows: Rows) => {
    if (rows.length) content[key] = rows;
  };
  const need = <T extends { id: string }>(list: T[], id: string | null | undefined, label: string): T => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new PackageError(`That ${label} no longer exists.`);
    return found;
  };
  const wrestlerIdsIn = (ids: Set<string>) => (row: Record<string, unknown>) => ids.has(row.wrestler_a as string) && ids.has(row.wrestler_b as string);

  switch (kind) {
    case "universe": {
      for (const [key] of UNIVERSE_TABLES) set(key, rowsOf(state, key));
      return { content, rootName: state.universe.name };
    }
    case "scenario": {
      const keepShows = new Set(state.shows.filter((s) => s.status !== "completed" && s.status !== "cancelled").map((s) => s.id));
      for (const [key] of UNIVERSE_TABLES) {
        if (["segmentResults", "timelineEvents", "financialTransactions", "storylineDevelopments", "businessDeals"].includes(key)) continue;
        set(key, rowsOf(state, key));
      }
      set("shows", pick(state, "shows", (s) => keepShows.has(s.id as string)));
      set("titleReigns", pick(state, "titleReigns", (r) => r.ended_on === null));
      set("rosterMemberships", pick(state, "rosterMemberships", (m) => m.ended_on === null));
      set("contracts", pick(state, "contracts", (c) => c.status === "active"));
      set("injuries", pick(state, "injuries", (i) => i.healed_on === null));
      set("teamMemberships", pick(state, "teamMemberships", (m) => m.left_on === null));
      set("rivalries", pick(state, "rivalries", (r) => r.ended_on === null));
      set("tournaments", pick(state, "tournaments", (t) => t.status !== "completed"));
      // Completed shows are removed, so segments and participants on them drop out in pruning.
      return { content, rootName: state.universe.name };
    }
    case "wrestler": {
      const w = need(state.wrestlers, rootId, "wrestler");
      set("wrestlers", [w as unknown as Record<string, unknown>]);
      return { content, rootName: w.ring_name };
    }
    case "venue": {
      const v = need(state.venues, rootId, "venue");
      set("venues", [v as unknown as Record<string, unknown>]);
      return { content, rootName: v.name };
    }
    case "championship": {
      const c = need(state.championships, rootId, "championship");
      set("championships", [c as unknown as Record<string, unknown>]);
      return { content, rootName: c.name };
    }
    case "team": {
      const t = need(state.teams, rootId, "team");
      const memberships = state.teamMemberships.filter((m) => m.team_id === t.id && m.left_on === null);
      const ids = new Set(memberships.map((m) => m.wrestler_id));
      set("teams", [t as unknown as Record<string, unknown>]);
      set("teamMemberships", memberships as unknown as Rows);
      set("wrestlers", pick(state, "wrestlers", (w) => ids.has(w.id as string)));
      set("chemistry", pick(state, "chemistry", wrestlerIdsIn(ids)));
      return { content, rootName: t.name };
    }
    case "storyline": {
      const s = need(state.storylines, rootId, "storyline");
      const participants = state.storylineParticipants.filter((p) => p.storyline_id === s.id);
      const wrestlerIds = new Set(participants.map((p) => p.wrestler_id).filter((x): x is string => Boolean(x)));
      const teamIds = new Set(participants.map((p) => p.team_id).filter((x): x is string => Boolean(x)));
      const teamMembers = state.teamMemberships.filter((m) => teamIds.has(m.team_id) && m.left_on === null);
      for (const m of teamMembers) wrestlerIds.add(m.wrestler_id);
      set("storylines", [{ ...(s as unknown as Record<string, unknown>), promotion_id: null, championship_id: null }]);
      set("storylineParticipants", participants as unknown as Rows);
      set("storylineDevelopments", pick(state, "storylineDevelopments", (d) => d.storyline_id === s.id).map((d) => ({ ...d, show_id: null, segment_id: null })));
      set("teams", pick(state, "teams", (t) => teamIds.has(t.id as string)));
      set("teamMemberships", teamMembers as unknown as Rows);
      set("wrestlers", pick(state, "wrestlers", (w) => wrestlerIds.has(w.id as string)));
      set("rivalries", pick(state, "rivalries", (r) => r.storyline_id === s.id));
      return { content, rootName: s.title };
    }
    case "promotion": {
      const p = need(state.promotions, rootId, "promotion");
      const memberships = state.rosterMemberships.filter((m) => m.promotion_id === p.id && m.ended_on === null);
      const ids = new Set(memberships.map((m) => m.wrestler_id));
      const championships = state.championships.filter((c) => c.promotion_id === p.id);
      const champIds = new Set(championships.map((c) => c.id));
      const reigns = state.titleReigns.filter((r) => champIds.has(r.championship_id) && r.ended_on === null);
      const reignIds = new Set(reigns.map((r) => r.id));
      const teams = state.teams.filter((t) => t.promotion_id === p.id && !t.disbanded_on);
      const teamIds = new Set(teams.map((t) => t.id));
      set("promotions", [p as unknown as Record<string, unknown>]);
      set("wrestlers", pick(state, "wrestlers", (w) => ids.has(w.id as string)));
      set("rosterMemberships", memberships as unknown as Rows);
      set("contracts", pick(state, "contracts", (c) => c.promotion_id === p.id && c.status === "active"));
      set("teams", teams as unknown as Rows);
      set("teamMemberships", pick(state, "teamMemberships", (m) => teamIds.has(m.team_id as string) && m.left_on === null));
      set("championships", championships as unknown as Rows);
      set("titleReigns", reigns.map((r) => ({ ...r, won_segment_id: null, lost_segment_id: null })) as unknown as Rows);
      set("titleReignHolders", pick(state, "titleReignHolders", (h) => reignIds.has(h.reign_id as string)));
      set("chemistry", pick(state, "chemistry", wrestlerIdsIn(ids)));
      return { content, rootName: p.name };
    }
  }
}

/** Builds a complete, self-consistent package envelope. */
export function buildPackage(state: UniverseState, options: BuildOptions): PackageEnvelope {
  const { content: selected, rootName } = selectContent(state, options.kind, options.rootId);
  const stripped: PackageContent = {};
  for (const [key, rows] of Object.entries(selected)) stripped[key as UniverseCollectionKey] = rows!.map(stripRow);
  // Promotion references may point outside a single-entity package; the importer
  // reassigns them to a promotion the player picks.
  const { content } = pruneDangling(stripped, { external: new Set(state.promotions.map((p) => p.id)) });
  normalisePairs(content);
  const media = collectMedia(content);
  const withUniverse = options.kind === "universe" || options.kind === "scenario";
  return {
    format: PACKAGE_FORMAT,
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    kind: options.kind,
    title: (options.title?.trim() || rootName).slice(0, 120),
    description: options.description ?? "",
    exportedAt: (options.now ?? new Date()).toISOString(),
    generator: GENERATOR,
    universe: withUniverse
      ? {
          name: state.universe.name,
          description: state.universe.description,
          start_date: state.universe.start_date,
          game_date: state.universe.game_date,
          settings: state.universe.settings,
        }
      : null,
    content: content as PackageEnvelope["content"],
    media: media.map((m) => ({ id: m.id, kind: m.kind, file: `media/${m.id}.webp` })),
    attribution: (state.universe.attribution as PackageEnvelope["attribution"]) ?? [],
  };
}

const MEDIA_KIND_BY_COLLECTION: Partial<Record<UniverseCollectionKey, string>> = {
  promotions: "promotion_logo",
  venues: "venue",
  wrestlers: "portrait",
  teams: "team_logo",
  championships: "championship",
  shows: "event_poster",
};

/** Media asset ids referenced by package rows. */
export function collectMedia(content: PackageContent): Array<{ id: string; kind: string }> {
  const out = new Map<string, string>();
  for (const [key, col] of Object.entries(MEDIA_COLUMNS) as Array<[UniverseCollectionKey, string]>) {
    for (const row of content[key] ?? []) {
      const value = row[col];
      if (typeof value === "string" && value) out.set(value, MEDIA_KIND_BY_COLLECTION[key]!);
    }
  }
  return [...out].map(([id, kind]) => ({ id, kind }));
}

export function packageFilename(pkg: Pick<PackageEnvelope, "title" | "kind">, ext: "json" | "zip"): string {
  const slug = pkg.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || pkg.kind;
  return `${slug}.${pkg.kind}.${ext}`;
}
