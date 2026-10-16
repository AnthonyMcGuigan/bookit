import { describe, expect, it } from "vitest";
import { buildStarterUniverse } from "@/lib/seed/starter";
import { planSimulation, PlanError, nextShowName } from "@/lib/simulation/plan";

const starter = buildStarterUniverse({ name: "Plan test" });
const nextShow = starter.shows.find((s) => s.name === "Ironside Uprising #320")!;

describe("planSimulation", () => {
  it("simulates the player show, runs rival shows first and advances the date", () => {
    const plan = planSimulation(starter, { showId: nextShow.id, seed: "t1", now: "2026-01-01T00:00:00.000Z" });
    expect(plan.toDate).toBe(nextShow.show_date);
    expect(plan.state.universe.game_date).toBe(nextShow.show_date);
    expect(plan.playerSimulation?.rating).toBeGreaterThan(0);
    const after = plan.state.shows.find((s) => s.id === nextShow.id)!;
    expect(after.status).toBe("completed");
    // Every step except ticks carries at most one show.
    expect(plan.steps.filter((s) => s.show).length).toBe(1 + plan.rivalShows.length);
  });

  it("is deterministic for the same seed", () => {
    const a = planSimulation(starter, { showId: nextShow.id, seed: "same", now: "2026-01-01T00:00:00.000Z" });
    const b = planSimulation(starter, { showId: nextShow.id, seed: "same", now: "2026-01-01T00:00:00.000Z" });
    expect(JSON.stringify(a.steps)).toBe(JSON.stringify(b.steps));
  });

  it("refuses a later show while an earlier player show is pending", () => {
    const later = starter.shows.find((s) => s.name === "Ironside Uprising #321")!;
    expect(() => planSimulation(starter, { showId: later.id, seed: "x" })).toThrow(PlanError);
  });

  it("refuses to simulate the same show twice", () => {
    const plan = planSimulation(starter, { showId: nextShow.id, seed: "t2" });
    expect(() => planSimulation(plan.state, { showId: nextShow.id, seed: "t2" })).toThrow(/already been simulated/);
  });

  it("names the next rival show", () => {
    expect(nextShowName("Rift Live #158", "PRW")).toBe("Rift Live #159");
    expect(nextShowName(undefined, "PRW")).toBe("PRW Weekly #1");
  });
});
