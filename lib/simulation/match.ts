/**
 * Match simulation. Pure functions over a SimContext and a seeded RNG.
 *
 * Outcome model (documented in docs/simulation.md):
 *  1. Each competitor gets a performance score from match-type weighted
 *     attributes, condition (fatigue/injury), star power and big-match ability.
 *  2. Side strength = mean performance + partner chemistry/team experience.
 *  3. Win probabilities = softmax(strength / temperature); temperature grows
 *     with the universe's match-randomness and realism settings, so favourites
 *     win more often but never always.
 *  4. A predetermined winner chosen by the booker is always respected.
 *  5. Quality blends workrate, chemistry, crowd heat, finish, duration fit and
 *     bounded noise.
 */
import type { Wrestler } from "@/lib/domain/entities";
import type { Finish, FinishPlan, MatchType, Stipulation } from "@/lib/domain/enums";
import { clamp, type Rng } from "./rng";
import { groupSides, pairKey, type BookedSegment, type SimContext } from "./context";
import type { MatchDetails, ParticipantResult, SegmentOutcome, SimInjury, TitleOutcome } from "./types";
import { emptyDelta } from "./types";
import type { WorkingState } from "./working-state";
import { crowdReactionFor, starRatingFor } from "./scoring";
import { matchRecap } from "./recap";

type AttributeWeights = Partial<Record<keyof Wrestler, number>>;

const BASE_WEIGHTS: AttributeWeights = {
  in_ring: 0.3,
  technical: 0.14,
  power: 0.1,
  speed: 0.1,
  psychology: 0.14,
  stamina: 0.1,
  selling: 0.06,
  big_match: 0.06,
};

const STIPULATION_WEIGHTS: Partial<Record<Stipulation, AttributeWeights>> = {
  no_dq: { power: 0.2, selling: 0.12 },
  street_fight: { power: 0.2, selling: 0.12 },
  hardcore: { power: 0.22, selling: 0.14 },
  tables: { power: 0.2 },
  falls_count_anywhere: { stamina: 0.16, power: 0.14 },
  ladder: { speed: 0.24, selling: 0.1 },
  steel_cage: { power: 0.16, stamina: 0.14 },
  submission: { technical: 0.34 },
  last_man_standing: { stamina: 0.2, power: 0.2 },
  iron_man: { stamina: 0.3, technical: 0.18 },
  elimination: { stamina: 0.18 },
};

const TYPE_WEIGHTS: Partial<Record<MatchType, AttributeWeights>> = {
  battle_royal: { power: 0.24, stamina: 0.16, technical: 0.04 },
  rumble: { power: 0.2, stamina: 0.24, technical: 0.04 },
  tag: { psychology: 0.16 },
  trios: { speed: 0.14 },
};

/** Extra fatigue and injury risk by stipulation. */
const STIPULATION_RISK: Partial<Record<Stipulation, { fatigue: number; injury: number }>> = {
  ladder: { fatigue: 10, injury: 0.03 },
  hardcore: { fatigue: 8, injury: 0.025 },
  street_fight: { fatigue: 7, injury: 0.02 },
  tables: { fatigue: 7, injury: 0.02 },
  steel_cage: { fatigue: 7, injury: 0.015 },
  no_dq: { fatigue: 5, injury: 0.015 },
  falls_count_anywhere: { fatigue: 6, injury: 0.015 },
  last_man_standing: { fatigue: 8, injury: 0.02 },
  iron_man: { fatigue: 12, injury: 0.01 },
};

const NO_DQ_STIPULATIONS = new Set<Stipulation>([
  "no_dq",
  "street_fight",
  "hardcore",
  "tables",
  "falls_count_anywhere",
  "ladder",
  "steel_cage",
  "last_man_standing",
]);

export function matchImportance(ctx: SimContext, booked: BookedSegment, isMainEvent: boolean): number {
  const s = booked.segment;
  let importance = 0.25;
  if (isMainEvent) importance += 0.25;
  if (ctx.show.show_type === "major_event") importance += 0.25;
  if (ctx.show.show_type === "house_show") importance -= 0.15;
  if (s.championship_id) {
    const prestige = ctx.championships.get(s.championship_id)?.prestige ?? 50;
    importance += 0.1 + prestige / 500;
  }
  if (s.storyline_id) importance += 0.1;
  if (s.tournament_id) importance += 0.05;
  return clamp(importance, 0, 1);
}

function performance(
  w: Wrestler,
  ctx: SimContext,
  state: WorkingState,
  matchType: MatchType,
  stipulation: Stipulation,
  importance: number,
): number {
  const weights: AttributeWeights = { ...BASE_WEIGHTS, ...(TYPE_WEIGHTS[matchType] ?? {}), ...(STIPULATION_WEIGHTS[stipulation] ?? {}) };
  let totalWeight = 0;
  let skill = 0;
  for (const [key, weight] of Object.entries(weights) as Array<[keyof Wrestler, number]>) {
    skill += (w[key] as number) * weight;
    totalWeight += weight;
  }
  skill /= totalWeight;

  const fatigue = state.fatigue(w.id);
  const injured = ctx.activeInjuries.has(w.id);
  const condition = 1 - fatigue / 220 - (injured ? 0.22 : 0);
  const starPower = (w.popularity - 50) * 0.18 + state.momentum(w.id) * 0.1;
  const bigMatch = (w.big_match - 50) * 0.35 * importance;
  return skill * condition + starPower + bigMatch;
}

function temperature(ctx: SimContext): number {
  const realism = ctx.settings.realism === "arcade" ? 1.35 : ctx.settings.realism === "realistic" ? 0.85 : 1;
  return (5 + ctx.settings.matchRandomness * 0.22) * realism;
}

function softmax(values: number[], temp: number): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / temp));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function chooseFinish(
  rng: Rng,
  plan: FinishPlan,
  matchType: MatchType,
  stipulation: Stipulation,
  winner: Wrestler | null,
  hasInterference: boolean,
): Finish {
  if (plan === "draw") return "draw";
  if (plan === "no_contest") return "no_contest";
  const noDq = NO_DQ_STIPULATIONS.has(stipulation);
  if (plan === "dq") return noDq ? "pinfall" : "dq";
  if (plan === "countout") return noDq ? "pinfall" : "countout";
  if (plan === "interference") return "interference";
  if (plan === "roll_up") return "roll_up";
  if (plan === "submission") return "submission";
  if (plan === "knockout") return "knockout";
  if (plan === "pinfall") return "pinfall";

  // Stipulation-defined finishes.
  if (matchType === "battle_royal" || matchType === "rumble") return "elimination";
  if (stipulation === "ladder") return "ladder_retrieval";
  if (stipulation === "submission") return "submission";
  if (stipulation === "last_man_standing") return "knockout";
  if (stipulation === "elimination") return "elimination";
  if (stipulation === "steel_cage") return rng.chance(0.35) ? "escape" : "pinfall";

  const technical = winner?.technical ?? 50;
  const power = winner?.power ?? 50;
  const heel = winner?.alignment === "heel";
  if (plan === "clean") {
    return rng.weighted<Finish>(["pinfall", "submission", "knockout"], [70, 10 + technical / 4, 2 + power / 25]);
  }
  const options: Finish[] = ["pinfall", "submission", "knockout", "roll_up"];
  const weights = [62, 8 + technical / 6, 2 + power / 30, heel ? 9 : 5];
  if (!noDq) {
    options.push("dq", "countout");
    weights.push(heel ? 6 : 4, 3);
  }
  if (hasInterference) {
    options.push("interference");
    weights.push(heel ? 30 : 18);
  }
  if (matchType === "singles" || matchType === "tag") {
    options.push("draw");
    weights.push(1.5);
  }
  return rng.weighted(options, weights);
}

/** True when a finish lets the championship change hands. */
export function finishChangesTitle(finish: Finish, titleChangesOnDq: boolean): boolean {
  if (finish === "draw" || finish === "no_contest") return false;
  if (finish === "dq" || finish === "countout") return titleChangesOnDq;
  return true;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

export function simulateMatch(
  ctx: SimContext,
  booked: BookedSegment,
  state: WorkingState,
  rng: Rng,
  isMainEvent: boolean,
): SegmentOutcome {
  const segment = booked.segment;
  const matchType = (segment.match_type ?? "singles") as MatchType;
  const stipulation = (segment.stipulation ?? "standard") as Stipulation;
  const competitors = booked.participants.filter((p) => p.role === "competitor");
  const managers = booked.participants.filter((p) => p.role !== "competitor");
  const sides = groupSides(competitors);
  const factors: string[] = [];
  const importance = matchImportance(ctx, booked, isMainEvent);
  const duration = segment.duration_min;

  const wrestlerOf = (id: string): Wrestler => {
    const w = ctx.wrestlers.get(id);
    if (!w) throw new Error(`Wrestler ${id} missing from simulation context`);
    return w;
  };

  // --- Strength and win probability -------------------------------------
  const perf = new Map<string, number>();
  for (const p of competitors) {
    perf.set(p.wrestler_id, performance(wrestlerOf(p.wrestler_id), ctx, state, matchType, stipulation, importance));
  }

  const sideInfo = sides.map((members) => {
    const ids = members.map((m) => m.wrestler_id);
    const mean = ids.reduce((s, id) => s + (perf.get(id) ?? 0), 0) / Math.max(1, ids.length);
    let teamwork = 0;
    if (ids.length > 1) {
      let pairs = 0;
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          teamwork += (ctx.chemistry.get(pairKey(ids[i], ids[j]))?.partner_score ?? 0) / 10;
          pairs++;
        }
      teamwork /= Math.max(1, pairs);
      const teamId = members[0].team_id;
      if (teamId && members.every((m) => m.team_id === teamId)) teamwork += (ctx.teams.get(teamId)?.experience ?? 0) / 12;
    }
    // Handicap: more bodies help, with diminishing returns.
    const numbers = matchType === "handicap" ? Math.log2(ids.length + 1) * 6 : 0;
    const managerBoost = managers.filter((m) => m.side === members[0].side).length * 2;
    return { side: members[0].side, ids, strength: mean + teamwork + numbers + managerBoost };
  });

  const probabilities =
    sideInfo.length > 0 ? softmax(sideInfo.map((s) => s.strength), temperature(ctx)) : [];

  // --- Winner ---------------------------------------------------------------
  const plan = (segment.finish_plan ?? "auto") as FinishPlan;
  const interference = segment.interference ?? [];
  let winnerIndex: number | null = null;
  const predetermined =
    segment.predetermined_winner_side !== null && sideInfo.some((s) => s.side === segment.predetermined_winner_side);
  if (plan === "draw" || plan === "no_contest" || sideInfo.length < 2) {
    winnerIndex = null;
  } else if (predetermined) {
    winnerIndex = sideInfo.findIndex((s) => s.side === segment.predetermined_winner_side);
  } else {
    const weights = probabilities.slice();
    // Interference tilts the odds toward the side it favours.
    for (const i of interference) {
      const idx = sideInfo.findIndex((s) => s.side === i.favorsSide);
      if (idx >= 0) weights[idx] *= 1.6;
    }
    winnerIndex = sideInfo.indexOf(rng.weighted(sideInfo, weights));
  }

  const winnerSide = winnerIndex === null ? null : sideInfo[winnerIndex];
  const decisive = winnerSide
    ? winnerSide.ids.reduce((best, id) => ((perf.get(id) ?? 0) > (perf.get(best) ?? 0) ? id : best), winnerSide.ids[0])
    : null;
  let finish = chooseFinish(rng, plan, matchType, stipulation, decisive ? wrestlerOf(decisive) : null, interference.length > 0 || managers.length > 0);
  if (winnerSide === null && finish !== "draw" && finish !== "no_contest") finish = "no_contest";
  if (winnerSide !== null && (finish === "draw" || finish === "no_contest")) {
    // An auto-picked draw means nobody wins.
    winnerIndex = null;
  }
  const finalWinner = winnerIndex === null ? null : sideInfo[winnerIndex];
  const upset =
    finalWinner !== null && probabilities[winnerIndex!] < 0.3 && sideInfo.length >= 2;

  // --- Quality --------------------------------------------------------------
  const competitorWrestlers = competitors.map((p) => wrestlerOf(p.wrestler_id));
  const avg = (fn: (w: Wrestler) => number) =>
    competitorWrestlers.reduce((s, w) => s + fn(w), 0) / Math.max(1, competitorWrestlers.length);

  const staminaFit = avg((w) => clamp(w.stamina - Math.max(0, duration - 12) * 1.4 + 10, 0, 100));
  const workrate =
    avg((w) => w.in_ring * 0.34 + w.technical * 0.14 + w.psychology * 0.2 + w.selling * 0.14 + w.speed * 0.06) * 0.88 +
    staminaFit * 0.12;
  // Elite workers (85+) produce ~4-star matches on an ordinary night; heat,
  // stakes and chemistry push the very best higher.
  let quality = 12 + workrate * 0.76;

  let chemistrySum = 0;
  let chemistryPairs = 0;
  for (let i = 0; i < sideInfo.length; i++)
    for (let j = i + 1; j < sideInfo.length; j++)
      for (const a of sideInfo[i].ids)
        for (const b of sideInfo[j].ids) {
          chemistrySum += ctx.chemistry.get(pairKey(a, b))?.opponent_score ?? 0;
          chemistryPairs++;
        }
  const chemistry = chemistryPairs ? chemistrySum / chemistryPairs : 0;
  if (Math.abs(chemistry) >= 10) factors.push(chemistry > 0 ? "Strong in-ring chemistry" : "Poor chemistry between opponents");
  quality += chemistry / 6;

  // Crowd heat: popularity, storyline, rivalry, title prestige.
  const storyline = segment.storyline_id ? ctx.storylines.get(segment.storyline_id) : undefined;
  let rivalryIntensity = 0;
  if (sideInfo.length >= 2) {
    for (const a of sideInfo[0].ids)
      for (const b of sideInfo[1].ids) rivalryIntensity = Math.max(rivalryIntensity, ctx.rivalries.get(pairKey(a, b))?.intensity ?? 0);
  }
  const championship = segment.championship_id ? ctx.championships.get(segment.championship_id) : undefined;
  const heat = clamp(
    avg((w) => w.popularity) * 0.55 +
      (storyline?.intensity ?? 0) * 0.25 +
      rivalryIntensity * 0.15 +
      (championship ? championship.prestige * 0.2 : 0) +
      avg((w) => Math.max(0, state.momentum(w.id))) * 0.1,
    0,
    100,
  );
  quality += (heat - 50) * 0.12;
  if (storyline) factors.push(`Storyline heat from "${storyline.title}"`);
  if (championship) factors.push(`${championship.name} on the line`);

  // Alignment dynamics.
  if (sideInfo.length === 2) {
    const a0 = new Set(sideInfo[0].ids.map((id) => wrestlerOf(id).alignment));
    const a1 = new Set(sideInfo[1].ids.map((id) => wrestlerOf(id).alignment));
    if ((a0.has("face") && a1.has("heel")) || (a0.has("heel") && a1.has("face"))) {
      quality += 3;
    } else if (a0.has("face") && a1.has("face") && rivalryIntensity < 30) {
      quality -= 2;
      factors.push("Crowd unsure who to cheer (face vs face)");
    }
  }

  // Match type fit.
  if (matchType === "battle_royal") quality = Math.min(quality, 72) - 3;
  if (matchType === "rumble") quality = Math.min(quality + 4, 82);
  if (stipulation !== "standard") {
    const spectacle = stipulation === "ladder" ? avg((w) => w.speed) : avg((w) => w.power);
    quality += (spectacle - 50) / 12 + 2;
  }

  // Finish.
  const finishAdjust: Partial<Record<Finish, number>> = {
    pinfall: 2,
    submission: 2,
    knockout: 2,
    ladder_retrieval: 3,
    escape: 1,
    elimination: 1,
    roll_up: -2,
    interference: -4,
    dq: -8,
    countout: -8,
    draw: -5,
    no_contest: -10,
  };
  quality += finishAdjust[finish] ?? 0;
  if (finish === "dq" || finish === "countout" || finish === "no_contest") factors.push("Crowd disliked the inconclusive finish");

  // Duration fit.
  if (isMainEvent && duration < 8) {
    quality -= 8;
    factors.push("Main event felt rushed");
  }
  if (duration < 4) quality -= 6;
  if (duration > 25 && workrate < 60) {
    quality -= (duration - 25) * 0.5;
    factors.push("Match overstayed its welcome");
  }
  if (duration >= 15 && workrate >= 70) quality += 3;

  // Big-match performers rise to the occasion.
  quality += (avg((w) => w.big_match) - 50) * 0.08 * importance;

  // Fatigue and injuries drag the match down.
  const avgFatigue = avg((w) => state.fatigue(w.id));
  quality -= avgFatigue * 0.12;
  if (avgFatigue > 60) factors.push("Tired performers");
  if (competitorWrestlers.some((w) => ctx.activeInjuries.has(w.id))) {
    quality -= 6;
    factors.push("Injured wrestler worked through pain");
  }

  // Reliability → botches.
  const botchChance = avg((w) => (100 - w.reliability) / 700);
  const botch = rng.chance(botchChance);
  if (botch) {
    quality -= rng.int(6, 12);
    factors.push("A botched sequence hurt the flow");
  }

  // Bounded noise.
  quality += rng.normal(2.5 + ctx.settings.matchRandomness / 14);
  quality = Math.round(clamp(quality, 5, 100));
  const starRating = starRatingFor(quality);
  const crowdReaction = crowdReactionFor(quality, heat);

  // --- Title outcome ---------------------------------------------------------
  let titleOutcome: TitleOutcome | null = null;
  if (championship && championship.status === "active") {
    const current = ctx.currentReigns.get(championship.id);
    const holders = current?.holderIds ?? [];
    const winnerIds = finalWinner?.ids ?? [];
    if (!finalWinner) {
      titleOutcome = {
        championshipId: championship.id,
        result: "no_change",
        previousHolderIds: holders,
        newHolderIds: holders,
        previousReignId: current?.reign.id ?? null,
        note: holders.length ? "No winner, so the champion retains." : "No winner, so the title stays vacant.",
      };
    } else if (holders.length && sameSet(holders, winnerIds)) {
      titleOutcome = {
        championshipId: championship.id,
        result: "retained",
        previousHolderIds: holders,
        newHolderIds: holders,
        previousReignId: current!.reign.id,
        note: "",
      };
    } else if (!finishChangesTitle(finish, segment.title_changes_on_dq)) {
      titleOutcome = {
        championshipId: championship.id,
        result: holders.length ? "retained" : "no_change",
        previousHolderIds: holders,
        newHolderIds: holders,
        previousReignId: current?.reign.id ?? null,
        note: "Titles do not change hands on a disqualification or count-out.",
      };
    } else {
      titleOutcome = {
        championshipId: championship.id,
        result: holders.length ? "new_champion" : "vacant_filled",
        previousHolderIds: holders,
        newHolderIds: winnerIds,
        previousReignId: current?.reign.id ?? null,
        note: "",
      };
    }
  }

  // --- Participant effects -------------------------------------------------
  const autoProgress = ctx.settings.autoProgression;
  const moraleOn = ctx.settings.moraleEnabled;
  const risk = STIPULATION_RISK[stipulation] ?? { fatigue: 0, injury: 0 };
  const realismInjury = ctx.settings.realism === "arcade" ? 0.5 : ctx.settings.realism === "realistic" ? 1.3 : 1;
  const injuries: SimInjury[] = [];
  const winnerPop = finalWinner ? Math.max(...finalWinner.ids.map((id) => wrestlerOf(id).popularity)) : 0;
  const loserIds = finalWinner ? competitors.filter((p) => p.side !== finalWinner.side).map((p) => p.wrestler_id) : [];
  const loserPop = loserIds.length ? Math.max(...loserIds.map((id) => wrestlerOf(id).popularity)) : 0;
  const titleChanged = titleOutcome?.result === "new_champion" || titleOutcome?.result === "vacant_filled";

  const participants: ParticipantResult[] = [];
  for (const p of booked.participants) {
    const w = wrestlerOf(p.wrestler_id);
    const delta = emptyDelta();
    let outcome: ParticipantResult["outcome"] = null;
    if (p.role === "competitor") {
      if (!finalWinner) outcome = finish === "no_contest" ? "no_contest" : "draw";
      else outcome = p.side === finalWinner.side ? "win" : "loss";

      // Fatigue: duration, stipulation, stamina.
      delta.fatigue = Math.round(clamp(duration * 0.9 + risk.fatigue - w.stamina / 12 + 3, 1, 40));

      if (autoProgress) {
        if (outcome === "win") {
          delta.momentum = Math.round(4 + quality / 30 + (upset ? 5 : 0) + (titleChanged ? 5 : 0));
          delta.popularity = Math.round(clamp((quality - 50) / 18 + Math.max(0, loserPop - w.popularity) / 12 + (titleChanged ? 3 : 0) + 1, -2, 8));
        } else if (outcome === "loss") {
          delta.momentum = Math.round(quality >= 75 ? -2 : -5 - (finish === "roll_up" ? -2 : 0));
          delta.popularity = Math.round(clamp((quality - 62) / 20 - Math.max(0, w.popularity - winnerPop) / 25, -4, 3));
        } else {
          delta.momentum = 1;
          delta.popularity = Math.round(clamp((quality - 60) / 25, -2, 2));
        }
        if (isMainEvent) delta.popularity += 1;
      }
      if (moraleOn) {
        delta.morale = outcome === "win" ? 3 : outcome === "loss" ? -2 : 0;
        if (isMainEvent) delta.morale += 2;
        if (titleChanged && outcome === "win") delta.morale += 5;
        if (titleChanged && outcome === "loss" && titleOutcome?.previousHolderIds.includes(w.id)) delta.morale -= 4;
      }

      // Injuries.
      if (ctx.settings.injuriesEnabled && !ctx.activeInjuries.has(w.id)) {
        const opponentCare =
          competitors.filter((o) => o.side !== p.side).reduce((s, o) => s + (100 - wrestlerOf(o.wrestler_id).reliability), 0) /
          Math.max(1, competitors.filter((o) => o.side !== p.side).length) /
          2500;
        const chance = (0.006 + state.fatigue(w.id) / 4000 + risk.injury + opponentCare + (botch ? 0.02 : 0)) * realismInjury;
        if (rng.chance(chance)) injuries.push(rollInjury(rng, w.id));
      }
    } else {
      // Managers and other non-competitors.
      delta.fatigue = 2;
      if (autoProgress && finalWinner) delta.momentum = p.side === finalWinner.side ? 2 : -1;
    }
    participants.push({ wrestlerId: w.id, side: p.side, role: p.role, outcome, performance: Math.round(perf.get(w.id) ?? 0), delta });
  }

  const details: MatchDetails = {
    matchType,
    stipulation,
    sides: sideInfo.map((s, i) => ({ side: s.side, wrestlerIds: s.ids, strength: Math.round(s.strength * 10) / 10, winProbability: Math.round(probabilities[i] * 1000) / 1000 })),
    winnerSide: finalWinner?.side ?? null,
    winnerIds: finalWinner?.ids ?? [],
    loserIds,
    finish,
    finisherMove: decisive && finalWinner ? wrestlerOf(decisive).finisher || null : null,
    decisiveWrestlerId: finalWinner ? decisive : null,
    predetermined,
    interference,
    upset,
    botch,
  };

  const storylineEffect =
    storyline && storyline.status !== "resolved" && storyline.status !== "abandoned"
      ? {
          storylineId: storyline.id,
          intensityDelta: storyline.auto_progress ? Math.round(2 + quality / 30 + (titleChanged ? 4 : 0)) : 0,
          summary: "",
        }
      : null;

  const outcome: SegmentOutcome = {
    segmentId: segment.id,
    kind: "match",
    position: segment.position,
    title: segment.title,
    quality,
    starRating,
    crowdReaction,
    heat: Math.round(heat),
    durationMin: duration,
    participants,
    match: details,
    title_outcome: titleOutcome,
    storyline: storylineEffect,
    injuries,
    recap: "",
    factors,
  };
  outcome.recap = matchRecap(outcome, ctx);
  if (storylineEffect) storylineEffect.summary = outcome.recap.split(". ")[0] + ".";
  return outcome;
}

const INJURY_TABLE: Array<{ severity: SimInjury["severity"]; weight: number; days: [number, number]; names: string[] }> = [
  { severity: "minor", weight: 60, days: [5, 20], names: ["Bruised ribs", "Sprained wrist", "Minor concussion symptoms", "Jammed finger", "Strained hamstring"] },
  { severity: "moderate", weight: 28, days: [21, 60], names: ["Sprained knee", "Separated shoulder", "Broken nose", "Torn groin muscle"] },
  { severity: "severe", weight: 10, days: [60, 150], names: ["Torn bicep", "Broken ankle", "Herniated disc", "Torn meniscus"] },
  { severity: "career_threatening", weight: 2, days: [180, 365], names: ["Torn ACL", "Neck injury", "Torn pectoral"] },
];

export function rollInjury(rng: Rng, wrestlerId: string): SimInjury {
  const row = rng.weighted(INJURY_TABLE, INJURY_TABLE.map((r) => r.weight));
  return {
    wrestlerId,
    severity: row.severity,
    description: rng.pick(row.names),
    days: rng.int(row.days[0], row.days[1]),
    isStoryline: false,
  };
}
