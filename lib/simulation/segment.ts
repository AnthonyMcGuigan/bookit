/**
 * Non-match segment simulation (promos, interviews, angles, debuts...).
 */
import type { Wrestler } from "@/lib/domain/entities";
import type { SegmentKind } from "@/lib/domain/enums";
import type { BookedSegment, SimContext } from "./context";
import { pairKey } from "./context";
import { clamp, type Rng } from "./rng";
import { crowdReactionFor, starRatingFor } from "./scoring";
import { segmentRecap } from "./recap";
import type { ParticipantResult, SegmentOutcome, SimInjury } from "./types";
import { emptyDelta } from "./types";
import type { WorkingState } from "./working-state";

/** How much each attribute matters for a segment kind (charisma, mic, popularity, selling). */
const KIND_PROFILE: Record<Exclude<SegmentKind, "match">, { charisma: number; mic: number; popularity: number; selling: number; base: number }> = {
  promo: { charisma: 0.4, mic: 0.5, popularity: 0.1, selling: 0, base: 0 },
  interview: { charisma: 0.35, mic: 0.5, popularity: 0.15, selling: 0, base: -2 },
  confrontation: { charisma: 0.4, mic: 0.35, popularity: 0.25, selling: 0, base: 3 },
  backstage: { charisma: 0.55, mic: 0.3, popularity: 0.15, selling: 0, base: -4 },
  return: { charisma: 0.3, mic: 0.1, popularity: 0.6, selling: 0, base: 10 },
  debut: { charisma: 0.5, mic: 0.2, popularity: 0.3, selling: 0, base: 4 },
  contract_signing: { charisma: 0.35, mic: 0.45, popularity: 0.2, selling: 0, base: 0 },
  injury_angle: { charisma: 0.25, mic: 0.1, popularity: 0.25, selling: 0.4, base: 2 },
  storyline: { charisma: 0.45, mic: 0.35, popularity: 0.2, selling: 0, base: 0 },
  custom: { charisma: 0.45, mic: 0.35, popularity: 0.2, selling: 0, base: 0 },
};

export function simulateSegment(
  ctx: SimContext,
  booked: BookedSegment,
  state: WorkingState,
  rng: Rng,
  isMainEvent: boolean,
): SegmentOutcome {
  const segment = booked.segment;
  const kind = segment.kind as Exclude<SegmentKind, "match">;
  const profile = KIND_PROFILE[kind] ?? KIND_PROFILE.custom;
  const wrestlers: Wrestler[] = booked.participants
    .map((p) => ctx.wrestlers.get(p.wrestler_id))
    .filter((w): w is Wrestler => Boolean(w));
  const factors: string[] = [];

  const avg = (fn: (w: Wrestler) => number) =>
    wrestlers.length ? wrestlers.reduce((s, w) => s + fn(w), 0) / wrestlers.length : 40;

  let quality =
    avg((w) => w.charisma) * profile.charisma +
    avg((w) => w.mic_skills) * profile.mic +
    avg((w) => state.popularity(w.id)) * profile.popularity +
    avg((w) => w.selling) * profile.selling;
  // Normalise when weights do not sum to 1.
  quality /= profile.charisma + profile.mic + profile.popularity + profile.selling;
  quality = 12 + quality * 0.7 + profile.base;

  const storyline = segment.storyline_id ? ctx.storylines.get(segment.storyline_id) : undefined;
  let rivalry = 0;
  for (let i = 0; i < wrestlers.length; i++)
    for (let j = i + 1; j < wrestlers.length; j++)
      rivalry = Math.max(rivalry, ctx.rivalries.get(pairKey(wrestlers[i].id, wrestlers[j].id))?.intensity ?? 0);
  const heat = clamp(avg((w) => state.popularity(w.id)) * 0.6 + (storyline?.intensity ?? 0) * 0.3 + rivalry * 0.2, 0, 100);
  quality += (heat - 50) * 0.1;
  if (storyline) {
    quality += 3;
    factors.push(`Advanced "${storyline.title}"`);
  }
  if (wrestlers.length === 0) {
    quality = 25;
    factors.push("Nobody was booked in this segment");
  }
  // Long talking segments drag unless the talent is elite.
  if (segment.duration_min > 12 && avg((w) => w.mic_skills) < 75) {
    quality -= (segment.duration_min - 12) * 0.8;
    factors.push("Segment ran long");
  }
  if (isMainEvent && kind !== "return" && kind !== "contract_signing" && kind !== "confrontation") {
    quality -= 6;
    factors.push("A talking segment closing the show disappointed some fans");
  }
  if (kind === "return") factors.push("Big reaction for the returning star");
  quality += rng.normal(2 + ctx.settings.matchRandomness / 20);
  quality = Math.round(clamp(quality, 5, 100));

  const injuries: SimInjury[] = [];
  const participants: ParticipantResult[] = booked.participants.map((p) => {
    const w = ctx.wrestlers.get(p.wrestler_id)!;
    const delta = emptyDelta();
    delta.fatigue = kind === "injury_angle" || kind === "confrontation" ? 3 : 1;
    if (ctx.settings.autoProgression) {
      delta.popularity = Math.round(clamp((quality - 55) / 14, -3, 5));
      delta.momentum = Math.round(clamp((quality - 50) / 10, -4, 6));
      if (kind === "return" || kind === "debut") {
        delta.momentum += 5;
        delta.popularity += 2;
      }
    }
    if (ctx.settings.moraleEnabled) delta.morale = quality >= 60 ? 2 : quality < 35 ? -2 : 0;
    // Injury angles: side 1 participants are written off with a storyline injury.
    if (kind === "injury_angle" && p.side === 1) {
      injuries.push({ wrestlerId: w.id, description: "Attacked backstage (storyline)", severity: "moderate", days: 21, isStoryline: true });
    }
    return { wrestlerId: w.id, side: p.side, role: p.role, outcome: null, performance: Math.round(quality), delta };
  });

  const outcome: SegmentOutcome = {
    segmentId: segment.id,
    kind: segment.kind,
    position: segment.position,
    title: segment.title,
    quality,
    starRating: starRatingFor(quality),
    crowdReaction: crowdReactionFor(quality, heat),
    heat: Math.round(heat),
    durationMin: segment.duration_min,
    participants,
    match: null,
    title_outcome: null,
    storyline:
      storyline && storyline.status !== "resolved" && storyline.status !== "abandoned"
        ? { storylineId: storyline.id, intensityDelta: storyline.auto_progress ? Math.round(2 + quality / 25) : 0, summary: "" }
        : null,
    injuries,
    recap: "",
    factors,
  };
  outcome.recap = segmentRecap(outcome, ctx);
  if (outcome.storyline) outcome.storyline.summary = outcome.recap.split(". ")[0].replace(/\.$/, "") + ".";
  return outcome;
}
