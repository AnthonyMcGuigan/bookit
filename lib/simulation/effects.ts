/**
 * Converts a ShowSimulation into WorldChanges (titles, storylines, rivalries,
 * chemistry, injuries, timeline, finances). Pure and deterministic: ids are
 * derived from the simulation seed so a retried apply produces identical rows.
 */
import { addDays } from "@/lib/domain/dates";
import { SHOW_TYPE_LABELS } from "@/lib/domain/enums";
import type { StorylineStatus } from "@/lib/domain/enums";
import { pairKey, type SimContext } from "./context";
import { addWrestlerDelta, emptyChanges, type WorldChanges } from "./changes";
import { createRng, rngUuid } from "./rng";
import { joinNames } from "./recap";
import type { SegmentOutcome, ShowSimulation } from "./types";

export function nextStorylineStatus(current: StorylineStatus, intensity: number, autoProgress: boolean): StorylineStatus | null {
  if (!autoProgress) return null;
  if (current === "building" && intensity >= 40) return "active";
  if (current === "active" && intensity >= 80) return "climax";
  return null;
}

export function buildShowChanges(ctx: SimContext, sim: ShowSimulation): WorldChanges {
  const changes = emptyChanges();
  const idRng = createRng(`${sim.seed}::ids`);
  const newId = () => rngUuid(idRng);
  const date = ctx.show.show_date;
  const name = (id: string) => ctx.wrestlers.get(id)?.ring_name ?? "Unknown";

  changes.gameDate = date > ctx.gameDate ? date : null;
  changes.show = {
    id: ctx.show.id,
    expectedVersion: ctx.show.version,
    rating: sim.rating,
    ratingBreakdown: { ...sim.breakdown, finances: sim.finances, summary: sim.summary },
    attendance: sim.finances.attendance,
    simSeed: sim.seed,
  };

  const storylineIntensity = new Map<string, number>();
  const rivalryDeltas = new Map<string, { a: string; b: string; delta: number; storyline: string | null }>();
  const chemistry = new Map<string, { a: string; b: string; partner: number; opponent: number; together: number; against: number }>();

  const bumpChemistry = (x: string, y: string, kind: "partner" | "opponent", delta: number) => {
    const key = pairKey(x, y);
    const [a, b] = x < y ? [x, y] : [y, x];
    const entry = chemistry.get(key) ?? { a, b, partner: 0, opponent: 0, together: 0, against: 0 };
    if (kind === "partner") {
      entry.partner += delta;
      entry.together += 1;
    } else {
      entry.opponent += delta;
      entry.against += 1;
    }
    chemistry.set(key, entry);
  };

  const bumpRivalry = (x: string, y: string, delta: number, storyline: string | null, force: boolean) => {
    const key = pairKey(x, y);
    const existing = ctx.rivalries.get(key);
    const facedBefore = (ctx.chemistry.get(key)?.matches_against ?? 0) >= 1;
    if (!existing && !force && !facedBefore) return;
    const [a, b] = x < y ? [x, y] : [y, x];
    const entry = rivalryDeltas.get(key) ?? { a, b, delta: 0, storyline };
    entry.delta += existing ? delta : Math.max(delta, 15);
    if (storyline) entry.storyline = storyline;
    rivalryDeltas.set(key, entry);
  };

  for (const o of sim.segments) {
    changes.segmentResults.push({
      segment_id: o.segmentId,
      show_id: ctx.show.id,
      quality: o.quality,
      star_rating: o.starRating,
      crowd_reaction: o.crowdReaction,
      duration_min: o.durationMin,
      winner_side: o.match?.winnerSide ?? null,
      finish: o.match?.finish ?? null,
      title_changed: o.title_outcome?.result === "new_champion" || o.title_outcome?.result === "vacant_filled",
      recap: o.recap,
      details: { ...o } as unknown as Record<string, unknown>,
    });
    for (const p of o.participants) {
      changes.participantOutcomes.push({ segment_id: o.segmentId, wrestler_id: p.wrestlerId, outcome: p.outcome });
      addWrestlerDelta(changes, {
        wrestler_id: p.wrestlerId,
        popularity: p.delta.popularity,
        momentum: p.delta.momentum,
        morale: p.delta.morale,
        fatigue: p.delta.fatigue,
        reputation: p.delta.reputation,
        attributes: p.delta.attributes as Record<string, number>,
      });
    }

    applyTitleOutcome(ctx, o, changes, newId, date, name);

    // Injuries.
    for (const injury of o.injuries) {
      changes.injuriesNew.push({
        id: newId(),
        wrestler_id: injury.wrestlerId,
        description: injury.description,
        severity: injury.severity,
        started_on: date,
        expected_return_on: addDays(date, injury.days),
        segment_id: o.segmentId,
        is_storyline: injury.isStoryline,
      });
      changes.timelineEvents.push({
        id: newId(),
        promotion_id: ctx.promotion.id,
        occurred_on: date,
        kind: "injury",
        title: `${name(injury.wrestlerId)} injured`,
        summary: `${injury.description} (${injury.isStoryline ? "storyline" : injury.severity.replace("_", " ")}), expected out about ${Math.round(injury.days / 7)} week(s).`,
        wrestler_ids: [injury.wrestlerId],
        show_id: ctx.show.id,
        segment_id: o.segmentId,
        championship_id: null,
        importance: injury.isStoryline ? 2 : 3,
      });
    }

    // Storylines.
    if (o.storyline) {
      const prev = storylineIntensity.get(o.storyline.storylineId) ?? 0;
      storylineIntensity.set(o.storyline.storylineId, prev + o.storyline.intensityDelta);
      changes.storylineDevelopments.push({
        id: newId(),
        storyline_id: o.storyline.storylineId,
        occurred_on: date,
        show_id: ctx.show.id,
        segment_id: o.segmentId,
        kind: o.kind === "match" ? "match" : o.kind === "promo" || o.kind === "interview" ? "promo" : "development",
        summary: o.recap.slice(0, 1000),
        intensity_delta: o.storyline.intensityDelta,
      });
    }

    // Rivalries and chemistry.
    if (o.match) {
      const sides = o.match.sides;
      for (let i = 0; i < sides.length; i++) {
        const side = sides[i].wrestlerIds;
        const won = o.match.winnerSide === sides[i].side;
        for (let x = 0; x < side.length; x++)
          for (let y = x + 1; y < side.length; y++) bumpChemistry(side[x], side[y], "partner", won ? 2 : 1);
        for (let j = i + 1; j < sides.length; j++) {
          if (sides.length > 4) continue; // battle royals do not build chemistry
          for (const a of side)
            for (const b of sides[j].wrestlerIds) {
              bumpChemistry(a, b, "opponent", o.quality >= 65 ? 2 : o.quality < 35 ? -2 : o.quality >= 50 ? 1 : 0);
              if (side.length <= 2 && sides[j].wrestlerIds.length <= 2 && sides.length === 2) {
                bumpRivalry(a, b, Math.round(2 + o.quality / 30), o.storyline?.storylineId ?? null, Boolean(o.storyline));
              }
            }
        }
      }
    } else if (o.kind === "confrontation" || o.kind === "contract_signing" || o.kind === "injury_angle") {
      const s0 = o.participants.filter((p) => p.side === 0).map((p) => p.wrestlerId);
      const s1 = o.participants.filter((p) => p.side !== 0).map((p) => p.wrestlerId);
      for (const a of s0) for (const b of s1) bumpRivalry(a, b, o.kind === "injury_angle" ? 12 : 6, o.storyline?.storylineId ?? null, true);
    }

    // Debuts and returns.
    if (o.kind === "debut" || o.kind === "return") {
      const ids = o.participants.map((p) => p.wrestlerId);
      changes.timelineEvents.push({
        id: newId(),
        promotion_id: ctx.promotion.id,
        occurred_on: date,
        kind: o.kind,
        title: `${joinNames(ids.map(name))} ${o.kind === "debut" ? "debuted" : "returned"}`,
        summary: o.recap,
        wrestler_ids: ids,
        show_id: ctx.show.id,
        segment_id: o.segmentId,
        championship_id: null,
        importance: 3,
      });
    }

    // Tournaments.
    const seg = ctx.segments.find((b) => b.segment.id === o.segmentId)?.segment;
    if (seg?.tournament_id && o.match && o.match.winnerIds.length > 0) {
      const t = ctx.tournaments.get(seg.tournament_id);
      if (t && t.status === "active") {
        const round = seg.tournament_round ?? 0;
        const pending = changes.tournaments.find((x) => x.id === t.id);
        const rounds = pending ? pending.round_winners : t.round_winners.map((r) => r.slice());
        while (rounds.length <= round) rounds.push([]);
        const winner = o.match.winnerIds[0];
        if (!rounds[round].includes(winner)) rounds[round].push(winner);
        const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, t.entrant_ids.length))));
        const isFinal = round === totalRounds - 1;
        const update = { id: t.id, round_winners: rounds, status: isFinal ? ("completed" as const) : ("active" as const), winner_wrestler_id: isFinal ? winner : null };
        if (pending) Object.assign(pending, update);
        else changes.tournaments.push(update);
        if (isFinal) {
          changes.timelineEvents.push({
            id: newId(),
            promotion_id: ctx.promotion.id,
            occurred_on: date,
            kind: "news",
            title: `${name(winner)} won the ${t.name}`,
            summary: o.recap,
            wrestler_ids: [winner],
            show_id: ctx.show.id,
            segment_id: o.segmentId,
            championship_id: t.championship_id,
            importance: 4,
          });
        }
      }
    }
  }

  // Storyline intensity and status changes (aggregated per storyline).
  for (const [storylineId, delta] of storylineIntensity) {
    const storyline = ctx.storylines.get(storylineId)!;
    const intensity = Math.max(0, Math.min(100, storyline.intensity + delta));
    let status = nextStorylineStatus(storyline.status, intensity, storyline.auto_progress);
    let resolvedOn: string | null = null;
    // Title pursuits resolve when a protagonist wins the linked title.
    if (storyline.kind === "title_pursuit" && storyline.championship_id && storyline.auto_progress) {
      const protagonists = ctx.storylineParticipants
        .filter((p) => p.storyline_id === storylineId && p.role === "protagonist" && p.wrestler_id)
        .map((p) => p.wrestler_id!);
      const won = changes.reignsNew.find((r) => r.championship_id === storyline.championship_id && r.holder_ids.some((h) => protagonists.includes(h)));
      if (won) {
        status = "resolved";
        resolvedOn = date;
        changes.storylineDevelopments.push({
          id: newId(),
          storyline_id: storylineId,
          occurred_on: date,
          show_id: ctx.show.id,
          segment_id: won.won_segment_id,
          kind: "resolved",
          summary: `The pursuit is over: ${joinNames(won.holder_ids.map(name))} captured the championship.`,
          intensity_delta: 0,
        });
      }
    }
    changes.storylineUpdates.push({ id: storylineId, intensity_delta: delta, status, resolved_on: resolvedOn });
    if (status === "climax" || status === "resolved") {
      changes.timelineEvents.push({
        id: newId(),
        promotion_id: storyline.promotion_id,
        occurred_on: date,
        kind: "storyline",
        title: status === "climax" ? `"${storyline.title}" reached its climax` : `"${storyline.title}" resolved`,
        summary: "",
        wrestler_ids: ctx.storylineParticipants.filter((p) => p.storyline_id === storylineId && p.wrestler_id).map((p) => p.wrestler_id!),
        show_id: ctx.show.id,
        segment_id: null,
        championship_id: storyline.championship_id,
        importance: 3,
      });
    }
  }

  for (const r of rivalryDeltas.values()) {
    changes.rivalries.push({ id: newId(), wrestler_a: r.a, wrestler_b: r.b, intensity_delta: r.delta, occurred_on: date, storyline_id: r.storyline });
  }
  for (const c of chemistry.values()) {
    changes.chemistry.push({ wrestler_a: c.a, wrestler_b: c.b, partner_delta: c.partner, opponent_delta: c.opponent, together: c.together, against: c.against });
  }

  // Show timeline entry.
  const featured = [...new Set(sim.segments.slice(-1).flatMap((o) => o.participants.map((p) => p.wrestlerId)))];
  changes.timelineEvents.push({
    id: newId(),
    promotion_id: ctx.promotion.id,
    occurred_on: date,
    kind: "show",
    title: `${ctx.show.name}: ${sim.rating.toFixed(2)} rating`,
    summary: sim.summary,
    wrestler_ids: featured,
    show_id: ctx.show.id,
    segment_id: null,
    championship_id: null,
    importance: ctx.show.show_type === "major_event" ? 4 : ctx.show.show_type === "house_show" ? 1 : 2,
  });

  // Finances.
  const promoDelta = { id: ctx.promotion.id, popularity: sim.promotionPopularityDelta, reputation: sim.promotionReputationDelta, cash: 0 };
  if (sim.finances.enabled) {
    for (const line of sim.finances.lines) {
      if (line.amount === 0) continue;
      changes.transactions.push({
        id: newId(),
        promotion_id: ctx.promotion.id,
        occurred_on: date,
        category: line.category as WorldChanges["transactions"][number]["category"],
        amount: line.amount,
        show_id: ctx.show.id,
        description: `${ctx.show.name}: ${line.description}`.slice(0, 300),
      });
    }
    promoDelta.cash = sim.finances.profit;
  }
  changes.promotionDeltas.push(promoDelta);
  return changes;
}

function applyTitleOutcome(
  ctx: SimContext,
  o: SegmentOutcome,
  changes: WorldChanges,
  newId: () => string,
  date: string,
  name: (id: string) => string,
): void {
  const t = o.title_outcome;
  if (!t) return;
  const championship = ctx.championships.get(t.championshipId)!;
  if (o.quality >= 70) changes.championshipPrestige.push({ id: championship.id, delta: 1 });
  else if (o.quality < 35) changes.championshipPrestige.push({ id: championship.id, delta: -1 });

  if (t.result === "retained" && t.previousReignId) {
    changes.reignDefenses.push({ id: t.previousReignId, count: 1 });
    return;
  }
  if (t.result !== "new_champion" && t.result !== "vacant_filled") return;

  if (t.previousReignId) {
    changes.reignsEnded.push({ id: t.previousReignId, ended_on: date, end_reason: "lost", lost_segment_id: o.segmentId });
  }
  const booked = ctx.segments.find((b) => b.segment.id === o.segmentId);
  const winnerTeams = new Set(
    (booked?.participants ?? []).filter((p) => t.newHolderIds.includes(p.wrestler_id)).map((p) => p.team_id),
  );
  const teamId = winnerTeams.size === 1 ? [...winnerTeams][0] : null;
  // Tag/trios titles are held by the expected number of members.
  const holderCount = championship.format === "tag" ? 2 : championship.format === "trios" ? 3 : 1;
  const holderIds = t.newHolderIds.slice(0, Math.max(holderCount, 1));
  changes.reignsNew.push({
    id: newId(),
    championship_id: championship.id,
    team_id: championship.format === "singles" ? null : teamId,
    started_on: date,
    won_segment_id: o.segmentId,
    holder_ids: holderIds,
  });
  changes.timelineEvents.push({
    id: newId(),
    promotion_id: championship.promotion_id,
    occurred_on: date,
    kind: "title_change",
    title: `${joinNames(holderIds.map(name))} won the ${championship.name}`,
    summary: t.previousHolderIds.length
      ? `Defeated ${joinNames(t.previousHolderIds.map(name))} at ${ctx.show.name}.`
      : `Won the vacant title at ${ctx.show.name}.`,
    wrestler_ids: [...holderIds, ...t.previousHolderIds],
    show_id: ctx.show.id,
    segment_id: o.segmentId,
    championship_id: championship.id,
    importance: championship.tier === "world" ? 5 : 4,
  });
}

export function showTypeLabel(type: keyof typeof SHOW_TYPE_LABELS): string {
  return SHOW_TYPE_LABELS[type];
}
