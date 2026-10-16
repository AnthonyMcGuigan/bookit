import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { loadUniverseState } from "@/lib/storage/universe-repo";
import { addDays } from "@/lib/domain/dates";
import { planSimulation, type SimulationPlan } from "@/lib/simulation/plan";

/**
 * Plans and persists a simulation batch. The seed combines the universe
 * revision with the target so a retried request after success fails cleanly
 * (revision changed) instead of applying twice.
 */
export async function runSimulation(
  supabase: AppSupabaseClient,
  universeId: string,
  target: { showId: string } | { toDate: string },
): Promise<SimulationPlan> {
  const header = await supabase.from("universes").select("game_date").eq("id", universeId).single();
  if (header.error) throw header.error;
  const state = await loadUniverseState(supabase, universeId, { historyFrom: addDays(header.data.game_date, -120) });
  const seed = `${universeId}:r${state.universe.revision}:${"showId" in target ? target.showId : target.toDate}`;
  const plan = planSimulation(state, { ...target, seed });
  const rows: Record<string, unknown[]> = {};
  if (plan.rows.shows.length) rows.shows = plan.rows.shows;
  if (plan.rows.segments.length) rows.segments = plan.rows.segments;
  if (plan.rows.segmentParticipants.length) rows.segment_participants = plan.rows.segmentParticipants;
  const { error } = await supabase.rpc("simulate_batch", {
    p_universe: universeId,
    p_expected_revision: state.universe.revision,
    p_rows: rows as never,
    p_steps: plan.steps as never,
  });
  if (error) throw error;
  return plan;
}
