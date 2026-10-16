/**
 * Reference integrity for package content. Rows whose required references
 * point nowhere are dropped; optional dangling references are nulled. The
 * pass repeats until stable because dropping a row can orphan others.
 */
import type { UniverseCollectionKey } from "@/lib/domain/entities";
import { REFS, type PackageContent } from "./schema";

export interface PruneOptions {
  /** Ids that exist outside the package (for example, in the target universe). */
  external?: Set<string>;
  /** Used for required promotion references that would otherwise dangle. */
  defaultPromotionId?: string | null;
}

export interface PruneReport {
  dropped: Partial<Record<UniverseCollectionKey, number>>;
  nulled: number;
  reassigned: number;
}

export function pruneDangling(content: PackageContent, options: PruneOptions = {}): { content: PackageContent; report: PruneReport } {
  const next: PackageContent = {};
  for (const [key, rows] of Object.entries(content)) next[key as UniverseCollectionKey] = rows!.map((r) => ({ ...r }));
  const report: PruneReport = { dropped: {}, nulled: 0, reassigned: 0 };
  const external = options.external ?? new Set<string>();

  const idsOf = (key: UniverseCollectionKey) => new Set((next[key] ?? []).map((r) => r.id as string).filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    const known = new Map<UniverseCollectionKey, Set<string>>();
    const has = (to: UniverseCollectionKey, value: string) => {
      if (external.has(value)) return true;
      if (!known.has(to)) known.set(to, idsOf(to));
      return known.get(to)!.has(value);
    };
    for (const [key, specs] of Object.entries(REFS) as Array<[UniverseCollectionKey, NonNullable<(typeof REFS)[UniverseCollectionKey]>]>) {
      const rows = next[key];
      if (!rows?.length) continue;
      const kept: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        let keep = true;
        for (const spec of specs) {
          const value = row[spec.col];
          if (value === null || value === undefined) continue;
          if (has(spec.to, String(value))) continue;
          if (spec.required) {
            if (spec.to === "promotions" && options.defaultPromotionId) {
              row[spec.col] = options.defaultPromotionId;
              report.reassigned++;
              continue;
            }
            keep = false;
            break;
          }
          row[spec.col] = null;
          report.nulled++;
        }
        if (keep) kept.push(row);
        else report.dropped[key] = (report.dropped[key] ?? 0) + 1;
      }
      if (kept.length !== rows.length) {
        changed = true;
        known.delete(key);
      }
      next[key] = kept;
    }
  }
  for (const key of Object.keys(next) as UniverseCollectionKey[]) if (!next[key]!.length) delete next[key];
  return { content: next, report };
}

/** Chemistry and rivalries store pairs with wrestler_a < wrestler_b; also removes duplicate pairs. */
export function normalisePairs(content: PackageContent): void {
  for (const key of ["chemistry", "rivalries"] as const) {
    const rows = content[key];
    if (!rows) continue;
    const seen = new Set<string>();
    content[key] = rows.filter((row) => {
      let a = String(row.wrestler_a);
      let b = String(row.wrestler_b);
      if (a === b) return false;
      if (a > b) [a, b] = [b, a];
      row.wrestler_a = a;
      row.wrestler_b = b;
      const pairKey = key === "rivalries" && row.ended_on ? `${a}:${b}:${row.id}` : `${a}:${b}`;
      if (seen.has(pairKey)) return false;
      seen.add(pairKey);
      return true;
    });
  }
}
