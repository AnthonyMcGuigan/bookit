/**
 * Re-identifies every entity in a universe state with fresh UUIDs, rewriting
 * all references (including ids embedded in JSON details). Used for imports
 * and the starter universe so saves never collide.
 */
import type { UniverseState } from "@/lib/domain/entities";
import { UNIVERSE_TABLES } from "@/lib/domain/entities";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function collectEntityIds(state: UniverseState): Set<string> {
  const ids = new Set<string>([state.universe.id]);
  for (const [key] of UNIVERSE_TABLES) {
    for (const row of state[key] as Array<{ id?: string }>) if (row.id) ids.add(row.id.toLowerCase());
  }
  return ids;
}

export function remapUniverseIds(state: UniverseState, newId: () => string = () => crypto.randomUUID()): { state: UniverseState; mapping: Map<string, string> } {
  const ids = collectEntityIds(state);
  const mapping = new Map<string, string>();
  for (const id of ids) mapping.set(id, newId());
  const json = JSON.stringify(state).replace(UUID_RE, (match) => mapping.get(match.toLowerCase()) ?? match);
  const next = JSON.parse(json) as UniverseState;
  // Pair tables store (a, b) with a < b; new ids can change that ordering.
  for (const row of next.chemistry) {
    if (row.wrestler_a > row.wrestler_b) [row.wrestler_a, row.wrestler_b] = [row.wrestler_b, row.wrestler_a];
  }
  for (const row of next.rivalries) {
    if (row.wrestler_a > row.wrestler_b) [row.wrestler_a, row.wrestler_b] = [row.wrestler_b, row.wrestler_a];
  }
  return { state: next, mapping };
}

/** Converts a state into table rows for import_universe_rows. */
export function toImportRows(state: UniverseState, now = new Date().toISOString()): Record<string, unknown[]> {
  const rows: Record<string, unknown[]> = {};
  for (const [key, table] of UNIVERSE_TABLES) {
    const list = state[key] as Array<Record<string, unknown>>;
    if (!list.length) continue;
    rows[table] = list.map((row) => {
      const out: Record<string, unknown> = { ...row, universe_id: state.universe.id };
      if ("created_at" in row) out.created_at = now;
      if ("updated_at" in row) out.updated_at = now;
      return out;
    });
  }
  return rows;
}
