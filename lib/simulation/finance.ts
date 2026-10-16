/**
 * Show economics. All amounts are whole units of the universe currency.
 * Every line carries a plain-language explanation shown to the player.
 */
import type { ShowType } from "@/lib/domain/enums";
import type { SimContext } from "./context";
import { clamp, type Rng } from "./rng";
import type { SegmentOutcome, ShowFinances } from "./types";

export const PRODUCTION_COST: Record<ShowType, number> = {
  weekly_tv: 40000,
  house_show: 4000,
  major_event: 150000,
  tournament: 50000,
  special: 60000,
  custom: 20000,
};

export const SHOW_DRAW_MULTIPLIER: Record<ShowType, number> = {
  weekly_tv: 1,
  house_show: 0.7,
  major_event: 1.6,
  tournament: 1.15,
  special: 1.2,
  custom: 1,
};

const DEFAULT_CAPACITY = 1500;
const TRAVEL_PER_TALENT = 700;
const BASE_TICKET_PRICE = 30;

function difficultyMultiplier(ctx: SimContext): number {
  switch (ctx.settings.difficulty) {
    case "sandbox":
      return 1.3;
    case "easy":
      return 1.15;
    case "hard":
      return 0.85;
    default:
      return 1;
  }
}

export function computeAttendance(ctx: SimContext, segments: SegmentOutcome[], rng: Rng): { attendance: number; capacity: number; demand: number } {
  const capacity = ctx.venue?.capacity ?? DEFAULT_CAPACITY;
  const ids = new Set(segments.flatMap((s) => s.participants.map((p) => p.wrestlerId)));
  const pops = [...ids].map((id) => ctx.wrestlers.get(id)?.popularity ?? 0).sort((a, b) => b - a);
  const starPower = pops.slice(0, 4).reduce((s, p) => s + p, 0) / Math.max(1, Math.min(4, pops.length));
  const titleMatches = segments.filter((s) => s.title_outcome).length;
  const hype = Math.min(15, titleMatches * 4 + segments.filter((s) => s.storyline).length * 2);
  let demand = ctx.promotion.popularity * 0.55 + starPower * 0.35 + hype + (ctx.venue?.prestige ?? 50) * 0.1;
  demand *= SHOW_DRAW_MULTIPLIER[ctx.show.show_type];
  const price = Math.max(1, ctx.show.ticket_price);
  demand *= Math.pow(BASE_TICKET_PRICE / price, 0.55);
  demand *= 1 + rng.normal(0.05);
  const fill = clamp(demand / 100, 0.05, 1);
  return { attendance: Math.round(capacity * fill), capacity, demand: Math.round(demand) };
}

export function computeShowFinances(ctx: SimContext, segments: SegmentOutcome[], attendance: number, capacity: number): ShowFinances {
  const enabled = ctx.settings.financesEnabled;
  const lines: ShowFinances["lines"] = [];
  const explanation: string[] = [];
  const mult = difficultyMultiplier(ctx);
  const showType = ctx.show.show_type;
  const date = ctx.show.show_date;

  const tickets = Math.round(attendance * ctx.show.ticket_price * mult);
  lines.push({ category: "tickets", amount: tickets, description: `${attendance.toLocaleString("en-US")} fans × ${ctx.show.ticket_price} per ticket` });

  const ids = new Set(segments.flatMap((s) => s.participants.map((p) => p.wrestlerId)));
  const topPop = Math.max(0, ...[...ids].map((id) => ctx.wrestlers.get(id)?.popularity ?? 0));
  const merchPerFan = 1 + topPop / 40;
  const merch = Math.round(attendance * merchPerFan * mult);
  lines.push({ category: "merchandise", amount: merch, description: `${merchPerFan.toFixed(2)} per attendee, driven by the most popular star on the card` });

  for (const deal of ctx.businessDeals) {
    if (deal.promotion_id !== ctx.promotion.id || deal.status !== "active") continue;
    if (date < deal.starts_on || date > deal.ends_on) continue;
    if (!deal.applies_to.includes(showType)) continue;
    lines.push({ category: deal.kind, amount: deal.amount_per_show, description: `${deal.partner_name} (${deal.kind} deal, per show)` });
  }

  if (ctx.venue) lines.push({ category: "venue", amount: -ctx.venue.rental_cost, description: `${ctx.venue.name} rental` });
  else lines.push({ category: "venue", amount: -3000, description: "Generic venue rental (no venue selected)" });

  lines.push({ category: "production", amount: -PRODUCTION_COST[showType], description: `Production for a ${showType.replace("_", " ")}` });
  lines.push({ category: "travel", amount: -ids.size * TRAVEL_PER_TALENT, description: `${ids.size} performers × ${TRAVEL_PER_TALENT} travel and lodging` });

  let fees = 0;
  for (const id of ids) {
    const contract = ctx.contracts.find((c) => c.wrestler_id === id && c.promotion_id === ctx.promotion.id && c.status === "active");
    fees += contract?.appearance_fee ?? 0;
  }
  if (fees > 0) lines.push({ category: "appearance_fees", amount: -fees, description: "Per-appearance fees from contracts" });

  const revenue = lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const expenses = -lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0);
  explanation.push(`Attendance filled ${Math.round((attendance / capacity) * 100)}% of a ${capacity.toLocaleString("en-US")} capacity venue.`);
  explanation.push("Weekly payroll is charged when the calendar advances, not per show.");
  if (mult !== 1) explanation.push(`Revenue adjusted ×${mult} for ${ctx.settings.difficulty} financial difficulty.`);
  return { enabled, attendance, capacity, lines, revenue, expenses, profit: revenue - expenses, explanation };
}
