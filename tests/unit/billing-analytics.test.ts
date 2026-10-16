import { describe, expect, it } from "vitest";
import { getBillingProvider, nullProvider, BillingNotConfiguredError } from "@/lib/billing/provider";
import { computeAnalytics } from "@/lib/analytics/compute";
import { buildStarterUniverse } from "@/lib/seed/starter";
import { planSimulation } from "@/lib/simulation/plan";
import { playerPromotions } from "@/lib/domain/selectors";

describe("billing provider", () => {
  it("defaults to no provider with purchases disabled", async () => {
    const provider = getBillingProvider();
    expect(provider).toBe(nullProvider);
    expect(provider.purchasesEnabled).toBe(false);
    await expect(provider.createCheckout({ userId: "u", email: "e", plan: "premium", successUrl: "/", cancelUrl: "/" })).rejects.toBeInstanceOf(BillingNotConfiguredError);
    await expect(provider.parseWebhook("{}", new Headers())).rejects.toBeInstanceOf(BillingNotConfiguredError);
  });

  it("never enables purchases for an unknown provider name", () => {
    process.env.BILLING_PROVIDER = "made-up";
    try {
      expect(getBillingProvider().purchasesEnabled).toBe(false);
    } finally {
      delete process.env.BILLING_PROVIDER;
    }
  });
});

describe("analytics", () => {
  it("summarises simulated shows for the player's promotions", () => {
    const starter = buildStarterUniverse({ name: "Analytics" });
    const next = starter.shows.filter((s) => s.status !== "completed" && playerPromotions(starter).some((p) => p.id === s.promotion_id)).sort((a, b) => (a.show_date < b.show_date ? -1 : 1))[0];
    const plan = planSimulation(starter, { showId: next.id, seed: "a", now: "2026-01-01T00:00:00.000Z" });
    const ids = new Set(playerPromotions(plan.state).map((p) => p.id));
    const a = computeAnalytics(plan.state, ids);
    expect(a.showTrend.at(-1)?.showId).toBe(next.id);
    expect(a.segmentShare.matches).toBeGreaterThan(0);
    expect(a.matchTypes.reduce((n, t) => n + t.count, 0)).toBe(a.segmentShare.matches);
  });
});
