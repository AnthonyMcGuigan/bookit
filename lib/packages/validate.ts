/**
 * Parses untrusted package JSON: checks the envelope, applies format
 * migrations, then validates every row against its entity schema. The
 * result contains only known collections and known columns.
 */
import { UNIVERSE_TABLES, type UniverseCollectionKey } from "@/lib/domain/entities";
import { parseSettings } from "@/lib/domain/settings";
import { migratePackage } from "./migrate";
import { COLLECTION_SCHEMAS, LIMITS, PackageError, packageEnvelopeSchema, type PackageContent, type ValidPackage } from "./schema";

const PLACEHOLDER_UNIVERSE = "00000000-0000-4000-8000-000000000000";
const PLACEHOLDER_TIME = "1970-01-01T00:00:00.000Z";
/** Columns that belong to the save, not the package. */
const SAVE_COLUMNS = ["universe_id", "created_at", "updated_at"] as const;

export const COLLECTION_KEYS: UniverseCollectionKey[] = UNIVERSE_TABLES.map(([key]) => key);

/** Removes save-specific columns from a row. */
export function stripRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const col of SAVE_COLUMNS) delete out[col];
  return out;
}

export function parsePackageJson(text: string): ValidPackage {
  if (text.length > LIMITS.maxJsonBytes) throw new PackageError("This package is too large to import.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PackageError("This file isn't valid JSON. Export packages from the game and try again.");
  }
  return validatePackage(raw);
}

export function validatePackage(input: unknown): ValidPackage {
  const migrated = migratePackage(input);
  const parsed = packageEnvelopeSchema.safeParse(migrated);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PackageError(`This isn't a valid booking-sim package (${issue.path.join(".") || "file"}: ${issue.message}).`);
  }
  const envelope = parsed.data;
  const content: PackageContent = {};
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const [key, rows] of Object.entries(envelope.content)) {
    if (!(COLLECTION_KEYS as string[]).includes(key)) continue; // unknown collections from newer minor versions are ignored
    const collection = key as UniverseCollectionKey;
    const schema = COLLECTION_SCHEMAS[collection];
    const clean: Array<Record<string, unknown>> = [];
    rows.forEach((row, index) => {
      const result = schema.safeParse({ ...row, universe_id: PLACEHOLDER_UNIVERSE, created_at: PLACEHOLDER_TIME, updated_at: PLACEHOLDER_TIME });
      if (!result.success) {
        if (problems.length < 5) {
          const issue = result.error.issues[0];
          problems.push(`${collection}[${index}].${issue.path.join(".")}: ${issue.message}`);
        }
        return;
      }
      const value = result.data as Record<string, unknown>;
      if (typeof value.id === "string") {
        const id = value.id.toLowerCase();
        if (seenIds.has(id)) {
          if (problems.length < 5) problems.push(`${collection}[${index}]: duplicate id`);
          return;
        }
        seenIds.add(id);
      }
      clean.push(stripRow(value));
    });
    if (clean.length) content[collection] = clean;
  }
  if (problems.length) throw new PackageError(`Some records in this package are invalid: ${problems.join("; ")}`);

  const total = Object.values(content).reduce((n, rows) => n + (rows?.length ?? 0), 0);
  if (total === 0 && envelope.kind !== "universe" && envelope.kind !== "scenario") throw new PackageError("This package is empty.");

  return {
    ...envelope,
    content,
    universe: envelope.universe ? { ...envelope.universe, settings: parseSettings(envelope.universe.settings) } : null,
  };
}

export function countRows(content: PackageContent): Partial<Record<UniverseCollectionKey, number>> {
  const counts: Partial<Record<UniverseCollectionKey, number>> = {};
  for (const [key, rows] of Object.entries(content)) if (rows?.length) counts[key as UniverseCollectionKey] = rows.length;
  return counts;
}
