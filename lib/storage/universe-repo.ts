import "server-only";
import { notFound } from "next/navigation";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { universeSchema, type UniverseCollectionKey, type UniverseState } from "@/lib/domain/entities";
import { parseSettings } from "@/lib/domain/settings";
import { AppError, errorMessage } from "@/lib/errors";

export interface LoadOptions {
  /** Only load these collections (others come back empty). */
  collections?: UniverseCollectionKey[];
  /** Limit history-heavy tables to rows on/after this date. */
  historyFrom?: string | null;
}

/**
 * Loads a universe snapshot for the signed-in owner. RLS guarantees another
 * user's universe id returns nothing, which we surface as a 404.
 */
export async function loadUniverseState(supabase: AppSupabaseClient, universeId: string, options: LoadOptions = {}): Promise<UniverseState> {
  if (!/^[0-9a-f-]{36}$/i.test(universeId)) notFound();
  const { data, error } = await supabase.rpc("get_universe_snapshot", {
    p_universe: universeId,
    p_history_from: options.historyFrom ?? undefined,
    p_collections: options.collections ?? undefined,
  });
  if (error) throw new AppError(errorMessage(error), "LOAD_FAILED", 503);
  if (!data) notFound();
  const snapshot = data as unknown as UniverseState & { universe: Record<string, unknown> };
  const universe = universeSchema.parse({ ...snapshot.universe, settings: parseSettings(snapshot.universe.settings) });
  return { ...snapshot, universe };
}

export interface UniverseSummary {
  id: string;
  name: string;
  description: string;
  origin: string;
  game_date: string;
  archived_at: string | null;
  last_played_at: string;
  created_at: string;
  promotionCount: number;
  wrestlerCount: number;
}

export async function listUniverses(supabase: AppSupabaseClient): Promise<UniverseSummary[]> {
  const { data, error } = await supabase
    .from("universes")
    .select("id, name, description, origin, game_date, archived_at, last_played_at, created_at, promotions!promotions_universe_id_fkey(count), wrestlers!wrestlers_universe_id_fkey(count)")
    .order("last_played_at", { ascending: false });
  if (error) throw new AppError(errorMessage(error), "LOAD_FAILED", 503);
  return (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    description: u.description,
    origin: u.origin,
    game_date: u.game_date,
    archived_at: u.archived_at,
    last_played_at: u.last_played_at,
    created_at: u.created_at,
    promotionCount: (u.promotions as unknown as Array<{ count: number }>)[0]?.count ?? 0,
    wrestlerCount: (u.wrestlers as unknown as Array<{ count: number }>)[0]?.count ?? 0,
  }));
}

export async function importUniverseRows(
  supabase: AppSupabaseClient,
  universe: Record<string, unknown> | null,
  universeId: string,
  rows: Record<string, unknown[]>,
): Promise<string> {
  const { data, error } = await supabase.rpc("import_universe_rows", {
    p_universe: (universe ?? null) as never,
    p_universe_id: universeId,
    p_rows: rows as never,
  });
  if (error) {
    const err = new AppError(errorMessage(error), "IMPORT_FAILED");
    (err as AppError & { cause?: unknown }).cause = error;
    throw err;
  }
  return data as string;
}
