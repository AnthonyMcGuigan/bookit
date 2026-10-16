/**
 * Plans a batch of world progression: advancing the calendar to a date,
 * running every AI rival show scheduled up to then, and (optionally)
 * simulating one player show. Pure and deterministic for a given state and
 * seed; the result is persisted in one transaction by the simulate_batch RPC.
 */
import type { Segment, SegmentParticipant, Show, UniverseState } from "@/lib/domain/entities";
import { addDays } from "@/lib/domain/dates";
import { parseSettings } from "@/lib/domain/settings";
import { applyChanges } from "./apply";
import { autoBookShow } from "./ai-booker";
import { advanceWorld } from "./career";
import type { WorldChanges } from "./changes";
import { buildSimContext } from "./context";
import { buildShowChanges } from "./effects";
import { createRng, rngUuid } from "./rng";
import { simulateShow } from "./show";
import type { ShowSimulation } from "./types";

export class PlanError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export interface PlanRows {
  shows: Show[];
  segments: Segment[];
  segmentParticipants: SegmentParticipant[];
}

export interface SimulationPlan {
  toDate: string;
  steps: WorldChanges[];
  rows: PlanRows;
  state: UniverseState;
  playerSimulation: ShowSimulation | null;
  rivalShows: Array<{ show: Show; simulation: ShowSimulation }>;
}

export interface PlanOptions {
  /** Player show to simulate; the calendar advances to its date. */
  showId?: string;
  /** Advance to this date without a player show (ignored when showId is set). */
  toDate?: string;
  seed: string;
  now?: string;
}

/** Problems that make a show impossible to simulate (non-blocking issues are warnings in validate.ts). */
export function blockingProblems(state: UniverseState, show: Show): string[] {
  const problems: string[] = [];
  const segments = state.segments.filter((s) => s.show_id === show.id);
  if (segments.length === 0) problems.push("The card is empty. Add at least one segment.");
  for (const seg of segments) {
    const parts = state.segmentParticipants.filter((p) => p.segment_id === seg.id);
    if (seg.kind === "match") {
      const sides = new Set(parts.filter((p) => p.role === "competitor").map((p) => p.side));
      if (sides.size < 2) problems.push(`${seg.title || "A match"} needs competitors on at least two sides.`);
      if (seg.predetermined_winner_side !== null && !sides.has(seg.predetermined_winner_side)) {
        problems.push(`${seg.title || "A match"} has a planned winner on a side with no competitors.`);
      }
    } else if (parts.length === 0 && seg.kind !== "custom") {
      problems.push(`${seg.title || "A segment"} has no participants.`);
    }
  }
  return problems;
}

export function planSimulation(input: UniverseState, opts: PlanOptions): SimulationPlan {
  const now = opts.now ?? new Date().toISOString();
  let state = input;
  const settings = parseSettings(state.universe.settings);
  const gameDate = state.universe.game_date;
  const steps: WorldChanges[] = [];
  const rows: PlanRows = { shows: [], segments: [], segmentParticipants: [] };
  const rivalShows: SimulationPlan["rivalShows"] = [];

  let target: Show | null = null;
  let toDate: string;
  if (opts.showId) {
    target = state.shows.find((s) => s.id === opts.showId) ?? null;
    if (!target) throw new PlanError("SHOW_NOT_FOUND", "Show not found.");
    if (target.status === "completed") throw new PlanError("SHOW_ALREADY_SIMULATED", "This show has already been simulated.");
    if (target.status === "cancelled") throw new PlanError("SHOW_CANCELLED", "This show was cancelled.");
    const promotion = state.promotions.find((p) => p.id === target!.promotion_id);
    if (!promotion || promotion.controlled_by !== "player") throw new PlanError("NOT_PLAYER_SHOW", "Rival promotion shows run automatically.");
    if (target.show_date < gameDate) throw new PlanError("SHOW_IN_PAST", "This show is dated before the current universe date. Change its date first.");
    const earlier = state.shows.find(
      (s) =>
        s.id !== target!.id &&
        (s.status === "draft" || s.status === "booked") &&
        s.show_date < target!.show_date &&
        state.promotions.find((p) => p.id === s.promotion_id)?.controlled_by === "player",
    );
    if (earlier) throw new PlanError("EARLIER_SHOW_PENDING", `${earlier.name} is scheduled earlier. Simulate, move or cancel it first.`);
    const problems = blockingProblems(state, target);
    if (problems.length) throw new PlanError("CARD_INVALID", problems.join(" "));
    toDate = target.show_date;
  } else {
    if (!opts.toDate || opts.toDate <= gameDate) throw new PlanError("BAD_DATE", "Choose a date after the current universe date.");
    const blocking = state.shows.find(
      (s) =>
        (s.status === "draft" || s.status === "booked") &&
        s.show_date < opts.toDate! &&
        state.promotions.find((p) => p.id === s.promotion_id)?.controlled_by === "player",
    );
    if (blocking) throw new PlanError("EARLIER_SHOW_PENDING", `${blocking.name} is scheduled before that date. Simulate, move or cancel it first.`);
    toDate = opts.toDate;
  }

  // Rival promotion shows that happen on or before the target date.
  const aiPromotions = new Set(state.promotions.filter((p) => p.controlled_by === "ai" && !p.archived_at).map((p) => p.id));
  const rivalQueue = settings.rivalPromotionsEnabled
    ? state.shows
        .filter((s) => aiPromotions.has(s.promotion_id) && (s.status === "draft" || s.status === "booked") && s.show_date >= gameDate && s.show_date <= toDate)
        .sort((a, b) => (a.show_date < b.show_date ? -1 : a.show_date > b.show_date ? 1 : a.id < b.id ? -1 : 1))
    : [];

  for (const queued of rivalQueue) {
    if (queued.show_date > state.universe.game_date) {
      const tick = advanceWorld(state, queued.show_date, `${opts.seed}:tick:${queued.id}`);
      state = applyChanges(state, tick, now);
      steps.push(tick);
    }
    let show = state.shows.find((s) => s.id === queued.id)!;
    if (!state.segments.some((s) => s.show_id === show.id)) {
      const booked = autoBookShow(state, {
        promotionId: show.promotion_id,
        date: show.show_date,
        showType: show.show_type,
        name: show.name,
        seed: `${opts.seed}:book:${show.id}`,
        venueId: show.venue_id,
        existingShow: show,
      });
      const segments = booked.segments.map((s) => ({ ...s, created_at: now, updated_at: now }));
      const participants = booked.participants.map((p) => ({ ...p, created_at: now, updated_at: now }));
      rows.segments.push(...segments);
      rows.segmentParticipants.push(...participants);
      state = { ...state, segments: [...state.segments, ...segments], segmentParticipants: [...state.segmentParticipants, ...participants] };
      show = state.shows.find((s) => s.id === queued.id)!;
    }
    if (blockingProblems(state, show).length > 0) continue; // AI couldn't fill a card (tiny roster); skip quietly.
    const ctx = buildSimContext(state, show.id);
    const simulation = simulateShow(ctx, `${opts.seed}:sim:${show.id}`);
    const changes = buildShowChanges(ctx, simulation);
    state = applyChanges(state, changes, now);
    steps.push(changes);
    rivalShows.push({ show, simulation });
  }

  // Advance to the target date, then run the player's show.
  let playerSimulation: ShowSimulation | null = null;
  if (toDate > state.universe.game_date) {
    const booked = target
      ? new Set(
          state.segmentParticipants
            .filter((p) => state.segments.some((s) => s.id === p.segment_id && s.show_id === target!.id))
            .map((p) => p.wrestler_id),
        )
      : undefined;
    const tick = advanceWorld(state, toDate, `${opts.seed}:tick:final`, { bookedWrestlerIds: booked });
    state = applyChanges(state, tick, now);
    steps.push(tick);
  }
  if (target) {
    const ctx = buildSimContext(state, target.id);
    playerSimulation = simulateShow(ctx, `${opts.seed}:sim:${target.id}`);
    const changes = buildShowChanges(ctx, playerSimulation);
    state = applyChanges(state, changes, now);
    steps.push(changes);
  }

  // Keep rival promotions busy: schedule their next weekly show if none is upcoming.
  if (settings.rivalPromotionsEnabled) {
    const rng = createRng(`${opts.seed}:schedule`);
    for (const promotionId of aiPromotions) {
      const upcoming = state.shows.some((s) => s.promotion_id === promotionId && (s.status === "draft" || s.status === "booked") && s.show_date > toDate);
      if (upcoming) continue;
      const last = state.shows
        .filter((s) => s.promotion_id === promotionId && s.show_type === "weekly_tv")
        .sort((a, b) => (a.show_date < b.show_date ? 1 : -1))[0];
      let date = last ? addDays(last.show_date, 7) : addDays(toDate, 7);
      while (date <= toDate) date = addDays(date, 7);
      const promotion = state.promotions.find((p) => p.id === promotionId)!;
      const show: Show = {
        id: rngUuid(rng),
        universe_id: state.universe.id,
        promotion_id: promotionId,
        venue_id: last?.venue_id ?? null,
        name: nextShowName(last?.name, promotion.abbreviation),
        show_type: "weekly_tv",
        custom_type_label: "",
        show_date: date,
        status: "draft",
        target_duration_min: last?.target_duration_min ?? 120,
        ticket_price: last?.ticket_price ?? 30,
        poster_asset_id: null,
        notes: "",
        rating: null,
        rating_breakdown: null,
        attendance: null,
        sim_seed: null,
        simulated_at: null,
        version: 0,
        created_at: now,
        updated_at: now,
      };
      rows.shows.push(show);
      state = { ...state, shows: [...state.shows, show] };
    }
  }

  return { toDate, steps, rows, state, playerSimulation, rivalShows };
}

/** "Rift Live #155" → "Rift Live #156"; otherwise appends a number. */
export function nextShowName(previous: string | undefined, abbreviation: string): string {
  if (!previous) return `${abbreviation} Weekly #1`;
  const m = previous.match(/^(.*#)(\d+)$/);
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return `${previous} #2`;
}
