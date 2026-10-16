import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadUniverseState } from "@/lib/storage/universe-repo";
import { addDays } from "@/lib/domain/dates";

/** Universe header info for the shell (cheap query). */
export const getUniverseHeader = cache(async (universeId: string) => {
  await requireUser(`/u/${universeId}`);
  if (!/^[0-9a-f-]{36}$/i.test(universeId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("universes")
    .select("id, name, game_date, settings, archived_at, promotions!promotions_universe_id_fkey(id, name, abbreviation, primary_color, secondary_color, logo_asset_id, controlled_by, archived_at)")
    .eq("id", universeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  return data;
});

/**
 * Loads universe state for a page. "recent" limits match history to the last
 * 120 days, which is all most screens and the simulation need.
 */
export const getUniverseState = cache(async (universeId: string, scope: "recent" | "full" = "recent") => {
  await requireUser(`/u/${universeId}`);
  const supabase = await createSupabaseServerClient();
  let historyFrom: string | null = null;
  if (scope === "recent") {
    const header = await getUniverseHeader(universeId);
    historyFrom = addDays(header.game_date, -120);
  }
  return loadUniverseState(supabase, universeId, { historyFrom });
});
