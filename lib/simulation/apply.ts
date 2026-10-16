/**
 * In-memory application of WorldChanges to a UniverseState. Mirrors the
 * apply_world_changes SQL function exactly (an integration test checks
 * parity). Used for seed generation, previews and tests.
 */
import type { UniverseState, Wrestler } from "@/lib/domain/entities";
import { ATTRIBUTE_KEYS } from "@/lib/domain/entities";
import { clamp } from "./rng";
import type { WorldChanges } from "./changes";

export class ApplyError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function applyChanges(input: UniverseState, changes: WorldChanges, now = new Date().toISOString()): UniverseState {
  const state: UniverseState = structuredClone(input);
  const date = changes.gameDate;

  if (changes.show) {
    const show = state.shows.find((s) => s.id === changes.show!.id);
    if (!show) throw new ApplyError("SHOW_NOT_FOUND", "Show not found");
    if (show.status === "completed") throw new ApplyError("SHOW_ALREADY_SIMULATED", "This show has already been simulated");
    if (show.version !== changes.show.expectedVersion) throw new ApplyError("SHOW_VERSION_CONFLICT", "The show changed since it was loaded");
    Object.assign(show, {
      status: "completed",
      rating: changes.show.rating,
      rating_breakdown: changes.show.ratingBreakdown,
      attendance: changes.show.attendance,
      sim_seed: changes.show.simSeed,
      simulated_at: now,
      version: show.version + 1,
      updated_at: now,
    });
  }

  for (const r of changes.segmentResults) {
    state.segmentResults.push({
      ...r,
      universe_id: state.universe.id,
      crowd_reaction: r.crowd_reaction as UniverseState["segmentResults"][number]["crowd_reaction"],
      manually_edited: false,
      created_at: now,
      updated_at: now,
    });
  }
  for (const o of changes.participantOutcomes) {
    const p = state.segmentParticipants.find((x) => x.segment_id === o.segment_id && x.wrestler_id === o.wrestler_id);
    if (p) p.outcome = o.outcome as typeof p.outcome;
  }

  for (const d of changes.wrestlerDeltas) {
    const w = state.wrestlers.find((x) => x.id === d.wrestler_id);
    if (!w) continue;
    w.popularity = clamp(w.popularity + d.popularity, 0, 100);
    w.momentum = clamp(w.momentum + d.momentum, -100, 100);
    w.morale = clamp(w.morale + d.morale, 0, 100);
    w.fatigue = clamp(w.fatigue + d.fatigue, 0, 100);
    w.reputation = clamp(w.reputation + d.reputation, 0, 100);
    for (const key of ATTRIBUTE_KEYS) {
      const v = d.attributes[key];
      if (v) (w as Wrestler)[key] = clamp(w[key] + v, 0, 100);
    }
    w.updated_at = now;
  }
  for (const s of changes.wrestlerStatus) {
    const w = state.wrestlers.find((x) => x.id === s.wrestler_id);
    if (w) w.career_status = s.career_status;
  }

  for (const i of changes.injuriesNew) {
    state.injuries.push({ ...i, universe_id: state.universe.id, healed_on: null, created_at: now, updated_at: now });
  }
  for (const h of changes.injuriesHealed) {
    const i = state.injuries.find((x) => x.id === h.id);
    if (i && i.healed_on === null) i.healed_on = h.healed_on;
  }

  for (const e of changes.reignsEnded) {
    const r = state.titleReigns.find((x) => x.id === e.id);
    if (r && r.ended_on === null) Object.assign(r, { ended_on: e.ended_on, end_reason: e.end_reason, lost_segment_id: e.lost_segment_id, updated_at: now });
  }
  for (const n of changes.reignsNew) {
    if (state.titleReigns.some((r) => r.championship_id === n.championship_id && r.ended_on === null)) {
      throw new ApplyError("TITLE_ALREADY_HELD", "Championship already has a current reign");
    }
    state.titleReigns.push({
      id: n.id,
      universe_id: state.universe.id,
      championship_id: n.championship_id,
      team_id: n.team_id,
      started_on: n.started_on,
      ended_on: null,
      end_reason: null,
      won_segment_id: n.won_segment_id,
      lost_segment_id: null,
      defenses: 0,
      notes: "",
      is_manual: false,
      created_at: now,
      updated_at: now,
    });
    for (const holder of n.holder_ids) state.titleReignHolders.push({ universe_id: state.universe.id, reign_id: n.id, wrestler_id: holder });
  }
  for (const d of changes.reignDefenses) {
    const r = state.titleReigns.find((x) => x.id === d.id);
    if (r) r.defenses += d.count;
  }
  for (const p of changes.championshipPrestige) {
    const c = state.championships.find((x) => x.id === p.id);
    if (c) c.prestige = clamp(c.prestige + p.delta, 0, 100);
  }

  for (const u of changes.storylineUpdates) {
    const s = state.storylines.find((x) => x.id === u.id);
    if (!s) continue;
    s.intensity = clamp(s.intensity + u.intensity_delta, 0, 100);
    if (u.status) s.status = u.status;
    if (u.resolved_on) s.resolved_on = u.resolved_on;
  }
  for (const d of changes.storylineDevelopments) {
    state.storylineDevelopments.push({ ...d, universe_id: state.universe.id, created_at: now, updated_at: now });
  }

  for (const r of changes.rivalries) {
    const existing = state.rivalries.find((x) => x.wrestler_a === r.wrestler_a && x.wrestler_b === r.wrestler_b && x.ended_on === null);
    if (existing) {
      existing.intensity = clamp(existing.intensity + r.intensity_delta, 0, 100);
      existing.matches += 1;
      existing.last_interaction_on = r.occurred_on;
      existing.storyline_id = existing.storyline_id ?? r.storyline_id;
    } else {
      state.rivalries.push({
        id: r.id,
        universe_id: state.universe.id,
        wrestler_a: r.wrestler_a,
        wrestler_b: r.wrestler_b,
        intensity: clamp(r.intensity_delta, 0, 100),
        matches: 1,
        started_on: r.occurred_on,
        last_interaction_on: r.occurred_on,
        ended_on: null,
        storyline_id: r.storyline_id,
        created_at: now,
        updated_at: now,
      });
    }
  }
  for (const e of changes.rivalriesEnded) {
    const r = state.rivalries.find((x) => x.id === e.id);
    if (r) r.ended_on = e.ended_on;
  }

  for (const c of changes.chemistry) {
    const existing = state.chemistry.find((x) => x.wrestler_a === c.wrestler_a && x.wrestler_b === c.wrestler_b);
    if (existing) {
      existing.partner_score = clamp(existing.partner_score + c.partner_delta, -100, 100);
      existing.opponent_score = clamp(existing.opponent_score + c.opponent_delta, -100, 100);
      existing.matches_together += c.together;
      existing.matches_against += c.against;
      existing.updated_at = now;
    } else {
      state.chemistry.push({
        universe_id: state.universe.id,
        wrestler_a: c.wrestler_a,
        wrestler_b: c.wrestler_b,
        partner_score: clamp(c.partner_delta, -100, 100),
        opponent_score: clamp(c.opponent_delta, -100, 100),
        matches_together: c.together,
        matches_against: c.against,
        updated_at: now,
      });
    }
  }

  for (const id of changes.contractsExpired) {
    const c = state.contracts.find((x) => x.id === id);
    if (c && c.status === "active") c.status = "expired";
  }
  for (const m of changes.membershipsEnded) {
    const membership = state.rosterMemberships.find((x) => x.id === m.id);
    if (membership && membership.ended_on === null) Object.assign(membership, { ended_on: m.ended_on, end_reason: m.end_reason });
  }
  for (const s of changes.signings) {
    state.rosterMemberships.push({
      id: s.membership_id,
      universe_id: state.universe.id,
      wrestler_id: s.wrestler_id,
      promotion_id: s.promotion_id,
      started_on: s.started_on,
      ended_on: null,
      end_reason: null,
      created_at: now,
      updated_at: now,
    });
    state.contracts.push({
      id: s.contract_id,
      universe_id: state.universe.id,
      wrestler_id: s.wrestler_id,
      promotion_id: s.promotion_id,
      starts_on: s.started_on,
      ends_on: s.ends_on,
      weekly_salary: s.weekly_salary,
      appearance_fee: 0,
      exclusive: true,
      status: "active",
      created_at: now,
      updated_at: now,
    });
  }

  for (const t of changes.timelineEvents) state.timelineEvents.push({ ...t, universe_id: state.universe.id, created_at: now });
  for (const t of changes.transactions) state.financialTransactions.push({ ...t, universe_id: state.universe.id, created_at: now });
  for (const p of changes.promotionDeltas) {
    const promo = state.promotions.find((x) => x.id === p.id);
    if (!promo) continue;
    promo.popularity = clamp(promo.popularity + p.popularity, 0, 100);
    promo.reputation = clamp(promo.reputation + p.reputation, 0, 100);
    promo.cash_balance += p.cash;
  }
  for (const t of changes.tournaments) {
    const tournament = state.tournaments.find((x) => x.id === t.id);
    if (tournament) Object.assign(tournament, { round_winners: t.round_winners, status: t.status, winner_wrestler_id: t.winner_wrestler_id });
  }

  if (date && date > state.universe.game_date) state.universe.game_date = date;
  state.universe.revision += 1;
  return state;
}
