import { describe, expect, it } from "vitest";
import { buildStarterUniverse } from "@/lib/seed/starter";
import { planSimulation } from "@/lib/simulation/plan";
import { finishChangesTitle } from "@/lib/simulation/match";
import { applyChanges } from "@/lib/simulation/apply";
import type { UniverseState } from "@/lib/domain/entities";

const NOW = "2026-01-01T00:00:00.000Z";
const starter = buildStarterUniverse({ name: "Sim tests" });
const show = starter.shows.find((s) => s.name === "Ironside Uprising #320")!;
const matches = starter.segments.filter((s) => s.show_id === show.id && s.kind === "match");

function withSegment(state: UniverseState, segmentId: string, patch: Partial<UniverseState["segments"][number]>): UniverseState {
  return { ...state, segments: state.segments.map((s) => (s.id === segmentId ? { ...s, ...patch } : s)) };
}

function resultFor(state: UniverseState, segmentId: string) {
  return state.segmentResults.find((r) => r.segment_id === segmentId)!;
}

describe("simulation outcomes", () => {
  it("always respects a predetermined winner", () => {
    const seg = matches[0];
    for (const side of [0, 1]) {
      const state = withSegment(starter, seg.id, { predetermined_winner_side: side, finish_plan: "clean" });
      for (let i = 0; i < 15; i++) {
        const plan = planSimulation(state, { showId: show.id, seed: `pw-${side}-${i}`, now: NOW });
        expect(resultFor(plan.state, seg.id).winner_side).toBe(side);
      }
    }
  });

  it("produces different winners across seeds when nothing is planned (upsets happen)", () => {
    const seg = matches.find((m) => m.championship_id === null) ?? matches[0];
    const state = withSegment(starter, seg.id, { predetermined_winner_side: null, finish_plan: "auto" });
    const winners = new Set<number | null>();
    for (let i = 0; i < 40; i++) winners.add(resultFor(planSimulation(state, { showId: show.id, seed: `up-${i}`, now: NOW }).state, seg.id).winner_side);
    expect(winners.size).toBeGreaterThan(1);
  });

  it("does not change a title on a disqualification unless the match allows it", () => {
    expect(finishChangesTitle("dq", false)).toBe(false);
    expect(finishChangesTitle("countout", false)).toBe(false);
    expect(finishChangesTitle("dq", true)).toBe(true);
    expect(finishChangesTitle("pinfall", false)).toBe(true);
    expect(finishChangesTitle("draw", true)).toBe(false);

    const titleMatch = matches.find((m) => m.championship_id);
    if (!titleMatch) return;
    const reign = starter.titleReigns.find((r) => r.championship_id === titleMatch.championship_id && r.ended_on === null)!;
    const holders = new Set(starter.titleReignHolders.filter((h) => h.reign_id === reign.id).map((h) => h.wrestler_id));
    const challengerSide = starter.segmentParticipants.find((p) => p.segment_id === titleMatch.id && !holders.has(p.wrestler_id))!.side;
    const state = withSegment(starter, titleMatch.id, { predetermined_winner_side: challengerSide, finish_plan: "dq", title_changes_on_dq: false });
    const plan = planSimulation(state, { showId: show.id, seed: "dq", now: NOW });
    const result = resultFor(plan.state, titleMatch.id);
    expect(result.winner_side).toBe(challengerSide);
    expect(result.title_changed).toBe(false);
    expect(plan.state.titleReigns.find((r) => r.id === reign.id)!.ended_on).toBeNull();
  });

  it("applying the planned steps one by one reproduces the planned state", () => {
    const plan = planSimulation(starter, { showId: show.id, seed: "parity", now: NOW });
    let state: UniverseState = {
      ...starter,
      shows: [...starter.shows, ...(plan.rows.shows as UniverseState["shows"])],
      segments: [...starter.segments, ...(plan.rows.segments as UniverseState["segments"])],
      segmentParticipants: [...starter.segmentParticipants, ...(plan.rows.segmentParticipants as UniverseState["segmentParticipants"])],
    };
    for (const step of plan.steps) state = applyChanges(state, step, NOW);
    expect(state.universe.game_date).toBe(plan.state.universe.game_date);
    expect(state.segmentResults.length).toBe(plan.state.segmentResults.length);
    const pick = (s: UniverseState) => s.wrestlers.map((w) => [w.id, w.popularity, w.momentum, w.fatigue]).sort();
    expect(pick(state)).toEqual(pick(plan.state));
    expect(state.titleReigns.length).toBe(plan.state.titleReigns.length);
  });
});
