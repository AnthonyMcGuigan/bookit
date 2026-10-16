/**
 * Full-show simulation: runs every segment in card order, then rates the
 * show as a whole and computes attendance and economics.
 */
import { SHOW_TYPE_LABELS } from "@/lib/domain/enums";
import { groupSides, matchupKey, type SimContext } from "./context";
import { computeAttendance, computeShowFinances } from "./finance";
import { simulateMatch } from "./match";
import { clamp, createRng } from "./rng";
import { CROWD_SCORE, formatStars } from "./scoring";
import { simulateSegment } from "./segment";
import type { SegmentOutcome, ShowRatingBreakdown, ShowSimulation } from "./types";
import { WorkingState } from "./working-state";

export function simulateShow(ctx: SimContext, seed: string): ShowSimulation {
  const rng = createRng(seed);
  const state = new WorkingState(ctx.wrestlers);
  const outcomes: SegmentOutcome[] = [];
  const last = ctx.segments.length - 1;

  ctx.segments.forEach((booked, index) => {
    const segRng = rng.fork(`segment:${booked.segment.id}`);
    const isMainEvent = index === last;
    const outcome =
      booked.segment.kind === "match"
        ? simulateMatch(ctx, booked, state, segRng, isMainEvent)
        : simulateSegment(ctx, booked, state, segRng, isMainEvent);
    for (const p of outcome.participants) state.apply(p.wrestlerId, p.delta);
    outcomes.push(outcome);
  });

  const breakdown = rateShow(ctx, outcomes);
  const rating = Math.round((breakdown.total / 20) * 100) / 100;
  const { attendance, capacity } = computeAttendance(ctx, outcomes, rng.fork("attendance"));
  const finances = computeShowFinances(ctx, outcomes, attendance, capacity);

  // Promotion reaction: great shows grow popularity and reputation.
  const promotionPopularityDelta = ctx.settings.autoProgression ? Math.round(clamp((breakdown.total - 55) / 15, -3, 3)) : 0;
  const promotionReputationDelta = ctx.settings.autoProgression ? Math.round(clamp((breakdown.total - 60) / 20, -2, 2)) : 0;

  const best = outcomes.reduce<SegmentOutcome | null>((b, o) => (b === null || o.quality > b.quality ? o : b), null);
  const summary =
    outcomes.length === 0
      ? `${ctx.show.name} ran with an empty card.`
      : `${ctx.show.name} (${SHOW_TYPE_LABELS[ctx.show.show_type]}) drew ${attendance.toLocaleString("en-US")} fans and earned a ${rating.toFixed(2)} show rating. ` +
        `Best segment: ${best?.title || describeSegment(best!, ctx)} (${formatStars(best!.starRating)}).`;

  return {
    showId: ctx.show.id,
    seed,
    segments: outcomes,
    rating,
    ratingScore: Math.round(breakdown.total),
    breakdown,
    finances,
    promotionPopularityDelta,
    promotionReputationDelta,
    summary,
  };
}

function describeSegment(o: SegmentOutcome, ctx: SimContext): string {
  const names = o.participants.filter((p) => p.role !== "manager").map((p) => ctx.wrestlers.get(p.wrestlerId)?.ring_name ?? "?");
  if (o.match) return o.match.sides.map((s) => s.wrestlerIds.map((id) => ctx.wrestlers.get(id)?.ring_name ?? "?").join(" & ")).join(" vs. ");
  return names.join(", ");
}

/**
 * Show rating (0-100). Components are additive adjustments around the
 * duration-weighted segment average and are all reported to the player.
 */
export function rateShow(ctx: SimContext, outcomes: SegmentOutcome[]): ShowRatingBreakdown {
  const notes: string[] = [];
  if (outcomes.length === 0) {
    return {
      segmentAverage: 0, mainEvent: 0, opener: 0, pacing: 0, starPower: 0, stakes: 0,
      storyProgression: 0, repetition: 0, length: 0, crowd: 0, expectations: 0, total: 0,
      notes: ["The card was empty."],
    };
  }
  const last = outcomes.length - 1;
  let weightSum = 0;
  let weighted = 0;
  outcomes.forEach((o, i) => {
    const positionWeight = i === last ? 2 : i === 0 ? 1.25 : 1;
    const w = positionWeight * Math.sqrt(Math.max(1, o.durationMin));
    weighted += o.quality * w;
    weightSum += w;
  });
  const segmentAverage = weighted / weightSum;
  const avgQuality = outcomes.reduce((s, o) => s + o.quality, 0) / outcomes.length;

  // Main event.
  const main = outcomes[last];
  let mainEvent = 0;
  if (main.quality >= Math.max(...outcomes.map((o) => o.quality))) {
    mainEvent = 3;
    notes.push("The main event was the best thing on the show.");
  } else if (main.quality < avgQuality - 5) {
    mainEvent = -4;
    notes.push("The main event failed to live up to the rest of the card.");
  }

  // Opener.
  const opener = outcomes.length > 2 && outcomes[0].kind === "match" && outcomes[0].quality >= 60 ? 2 : 0;
  if (opener) notes.push("A hot opener set the tone.");

  // Pacing: long runs of talking segments or of matches.
  let pacing = 0;
  let talkRun = 0;
  let matchRun = 0;
  for (const o of outcomes) {
    if (o.kind === "match") {
      matchRun++;
      talkRun = 0;
      if (matchRun >= 5) pacing -= 1;
    } else {
      talkRun++;
      matchRun = 0;
      if (talkRun >= 3) pacing -= 3;
    }
  }
  const matchShare = outcomes.filter((o) => o.kind === "match").length / outcomes.length;
  if (matchShare < 0.4) {
    pacing -= 4;
    notes.push("Too much talking and not enough wrestling.");
  }
  if (pacing < 0 && matchShare >= 0.4) notes.push("Pacing suffered from back-to-back segments of the same kind.");

  // Star power: top five popularity on the card.
  const ids = [...new Set(outcomes.flatMap((o) => o.participants.map((p) => p.wrestlerId)))];
  const pops = ids.map((id) => ctx.wrestlers.get(id)?.popularity ?? 0).sort((a, b) => b - a).slice(0, 5);
  const starPower = clamp(((pops.reduce((s, p) => s + p, 0) / Math.max(1, pops.length)) - 55) / 10, -4, 3);

  // Stakes: championships and tournament matches.
  let stakes = 0;
  for (const o of outcomes) {
    if (o.title_outcome) stakes += 0.5 + (ctx.championships.get(o.title_outcome.championshipId)?.prestige ?? 50) / 100;
    if (o.title_outcome?.result === "new_champion") stakes += 1;
  }
  stakes = Math.min(4, stakes);

  // Story progression.
  const storyProgression = Math.min(4, outcomes.filter((o) => o.storyline).length);
  if (storyProgression >= 3) notes.push("Multiple storylines moved forward.");

  // Repetition: rematches inside the window and overbooked wrestlers.
  let repetition = 0;
  for (const booked of ctx.segments) {
    if (booked.segment.kind !== "match") continue;
    const sides = groupSides(booked.participants.filter((p) => p.role === "competitor"));
    if (sides.length < 2) continue;
    const key = matchupKey(sides.map((s) => s.map((p) => p.wrestler_id)));
    const count = ctx.recentMatchups.get(key) ?? 0;
    if (count > 0) repetition -= Math.min(6, count * 2.5);
  }
  const appearances = new Map<string, number>();
  for (const o of outcomes) for (const p of o.participants) appearances.set(p.wrestlerId, (appearances.get(p.wrestlerId) ?? 0) + 1);
  for (const count of appearances.values()) if (count > ctx.settings.bookingRules.maxSegmentsPerWrestler) repetition -= 2;
  repetition = Math.max(-10, repetition);
  if (repetition < 0) notes.push("Fans have seen some of these matchups or performers too often.");

  // Show length.
  const totalMinutes = outcomes.reduce((s, o) => s + o.durationMin, 0) + outcomes.length; // + transitions
  const target = ctx.show.target_duration_min;
  const deviation = Math.abs(totalMinutes - target) / target;
  let length = 0;
  if (deviation > 0.25) {
    length = -Math.min(8, Math.round((deviation - 0.25) * 20));
    notes.push(totalMinutes > target ? "The show ran long." : "The show felt short for its slot.");
  }

  // Crowd engagement.
  const crowdAvg = outcomes.reduce((s, o) => s + CROWD_SCORE[o.crowdReaction], 0) / outcomes.length;
  const crowd = clamp((crowdAvg - 60) / 10, -4, 3);

  // Expectations for big shows.
  let expectations = 0;
  if (ctx.show.show_type === "major_event") {
    expectations = segmentAverage >= 65 ? 3 : segmentAverage < 55 ? -5 : 0;
    if (expectations < 0) notes.push("Fans expected more from a major event.");
  }
  if (ctx.show.show_type === "house_show") expectations = 1;

  const total = clamp(
    segmentAverage + mainEvent + opener + pacing + starPower + stakes + storyProgression + repetition + length + crowd + expectations,
    0,
    100,
  );
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    segmentAverage: r(segmentAverage),
    mainEvent,
    opener,
    pacing,
    starPower: r(starPower),
    stakes: r(stakes),
    storyProgression: r(storyProgression),
    repetition: r(repetition),
    length,
    crowd: r(crowd),
    expectations,
    total: r(total),
    notes,
  };
}
