/**
 * Time progression between shows: recovery, injury healing, momentum decay,
 * morale drift, contracts and payroll, ability growth/decline and rival
 * promotion activity. Produces WorldChanges; never mutates input.
 */
import type { UniverseState, Wrestler } from "@/lib/domain/entities";
import { addDays, daysBetween, parseIsoDate, yearsBetween } from "@/lib/domain/dates";
import { parseSettings } from "@/lib/domain/settings";
import { addWrestlerDelta, emptyChanges, type WorldChanges } from "./changes";
import { clamp, createRng, rngUuid } from "./rng";

export interface AdvanceOptions {
  /** Wrestler ids already booked on the show being simulated (not "idle"). */
  bookedWrestlerIds?: Set<string>;
}

function monthsCrossed(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export function advanceWorld(state: UniverseState, toDate: string, seed: string, options: AdvanceOptions = {}): WorldChanges {
  const changes = emptyChanges();
  const from = state.universe.game_date;
  const days = daysBetween(from, toDate);
  if (days <= 0) return changes;
  changes.gameDate = toDate;

  const settings = parseSettings(state.universe.settings);
  const rng = createRng(`${seed}::advance:${from}:${toDate}`);
  const newId = () => rngUuid(rng);
  const recoveryPerDay = settings.realism === "realistic" ? 2 : settings.realism === "arcade" ? 4 : 2.8;
  const playerPromotions = new Set(state.promotions.filter((p) => p.controlled_by === "player" && !p.archived_at).map((p) => p.id));

  // Who appeared recently (for morale drift).
  const recentWindowStart = addDays(toDate, -28);
  const recentShowIds = new Set(state.shows.filter((s) => s.status === "completed" && s.show_date >= recentWindowStart).map((s) => s.id));
  const recentSegments = new Set(state.segments.filter((s) => recentShowIds.has(s.show_id)).map((s) => s.id));
  const recentlyBooked = new Set(state.segmentParticipants.filter((p) => recentSegments.has(p.segment_id)).map((p) => p.wrestler_id));
  for (const id of options.bookedWrestlerIds ?? []) recentlyBooked.add(id);

  const openMembership = new Map<string, string[]>();
  for (const m of state.rosterMemberships) {
    if (m.ended_on !== null) continue;
    const list = openMembership.get(m.wrestler_id) ?? [];
    list.push(m.promotion_id);
    openMembership.set(m.wrestler_id, list);
  }

  const months = settings.abilityProgression ? monthsCrossed(from, toDate) : 0;

  for (const w of state.wrestlers) {
    if (w.archived_at || w.career_status === "retired") continue;
    const delta = { wrestler_id: w.id, popularity: 0, momentum: 0, morale: 0, fatigue: 0, reputation: 0, attributes: {} as Record<string, number> };
    delta.fatigue = -Math.min(w.fatigue, Math.round(days * recoveryPerDay));
    if (settings.autoProgression && w.momentum !== 0) {
      const decay = Math.min(Math.abs(w.momentum), Math.round(days * 0.5));
      delta.momentum = w.momentum > 0 ? -decay : decay;
    }
    if (settings.moraleEnabled) {
      const onPlayerRoster = (openMembership.get(w.id) ?? []).some((p) => playerPromotions.has(p));
      if (onPlayerRoster && !recentlyBooked.has(w.id) && w.role !== "manager") {
        delta.morale = -Math.round(days * 0.25 + (w.card_position === "main_event" ? days * 0.15 : 0));
      } else if (w.morale < 60) {
        delta.morale = Math.round(days * 0.15);
      }
    }
    if (months > 0) applyAbilityProgression(w, months, toDate, rng.fork(w.id), delta);
    if (delta.fatigue || delta.momentum || delta.morale || Object.keys(delta.attributes).length) addWrestlerDelta(changes, delta);
  }

  // Injury recovery.
  for (const injury of state.injuries) {
    if (injury.healed_on !== null || injury.expected_return_on > toDate) continue;
    changes.injuriesHealed.push({ id: injury.id, healed_on: injury.expected_return_on });
    if (!injury.is_storyline) {
      const w = state.wrestlers.find((x) => x.id === injury.wrestler_id);
      changes.timelineEvents.push({
        id: newId(),
        promotion_id: null,
        occurred_on: injury.expected_return_on,
        kind: "recovery",
        title: `${w?.ring_name ?? "A wrestler"} cleared to compete`,
        summary: `Recovered from ${injury.description.toLowerCase()}.`,
        wrestler_ids: [injury.wrestler_id],
        show_id: null,
        segment_id: null,
        championship_id: null,
        importance: 2,
      });
    }
  }

  // Contracts: expiries and payroll.
  for (const c of state.contracts) {
    if (c.status !== "active") continue;
    const promotion = state.promotions.find((p) => p.id === c.promotion_id);
    if (!promotion) continue;
    const paidUntil = c.ends_on < toDate ? c.ends_on : toDate;
    const paidDays = Math.max(0, daysBetween(from, paidUntil));
    if (settings.financesEnabled && paidDays > 0 && c.weekly_salary > 0) {
      const amount = Math.round((c.weekly_salary * paidDays) / 7);
      const existing = changes.transactions.find((t) => t.promotion_id === promotion.id && t.category === "payroll" && t.occurred_on === toDate);
      if (existing) existing.amount -= amount;
      else
        changes.transactions.push({
          id: newId(),
          promotion_id: promotion.id,
          occurred_on: toDate,
          category: "payroll",
          amount: -amount,
          show_id: null,
          description: `Payroll for ${daysBetween(from, toDate)} day(s)`,
        });
    }
    if (c.ends_on < toDate) {
      changes.contractsExpired.push(c.id);
      const membership = state.rosterMemberships.find((m) => m.wrestler_id === c.wrestler_id && m.promotion_id === c.promotion_id && m.ended_on === null);
      if (membership) changes.membershipsEnded.push({ id: membership.id, ended_on: c.ends_on, end_reason: "contract_expired" });
      const w = state.wrestlers.find((x) => x.id === c.wrestler_id);
      changes.timelineEvents.push({
        id: newId(),
        promotion_id: promotion.id,
        occurred_on: c.ends_on,
        kind: "contract",
        title: `${w?.ring_name ?? "A wrestler"}'s contract with ${promotion.name} expired`,
        summary: "Now a free agent unless re-signed.",
        wrestler_ids: [c.wrestler_id],
        show_id: null,
        segment_id: null,
        championship_id: null,
        importance: 2,
      });
    }
  }
  for (const t of changes.transactions) {
    const p = changes.promotionDeltas.find((x) => x.id === t.promotion_id);
    if (p) p.cash += t.amount;
    else changes.promotionDeltas.push({ id: t.promotion_id, popularity: 0, reputation: 0, cash: t.amount });
  }

  if (settings.rivalPromotionsEnabled) rivalActivity(state, from, toDate, days, changes, rng.fork("rivals"));
  return changes;
}

function applyAbilityProgression(
  w: Wrestler,
  months: number,
  date: string,
  rng: ReturnType<typeof createRng>,
  delta: { attributes: Record<string, number> },
) {
  const age = w.birth_date ? yearsBetween(w.birth_date, date) : null;
  const young = w.card_position === "prospect" || (age !== null && age < 28);
  const veteran = age !== null && age >= 37;
  for (let m = 0; m < months; m++) {
    if (young && rng.chance(0.55)) {
      const key = rng.pick(["in_ring", "technical", "psychology", "mic_skills", "charisma", "stamina"] as const);
      if (w[key] + (delta.attributes[key] ?? 0) < 95) delta.attributes[key] = (delta.attributes[key] ?? 0) + 1;
    }
    if (veteran && rng.chance(0.4)) {
      const key = rng.pick(["speed", "stamina", "power"] as const);
      if (w[key] + (delta.attributes[key] ?? 0) > 20) delta.attributes[key] = (delta.attributes[key] ?? 0) - 1;
    }
    if (veteran && rng.chance(0.2) && w.psychology + (delta.attributes.psychology ?? 0) < 98) {
      delta.attributes.psychology = (delta.attributes.psychology ?? 0) + 1;
    }
  }
}

/**
 * Rival promotions: AI promotions sign free agents, occasionally poach
 * talent whose contracts are close to expiring, and generate industry news.
 */
function rivalActivity(
  state: UniverseState,
  from: string,
  toDate: string,
  days: number,
  changes: WorldChanges,
  rng: ReturnType<typeof createRng>,
) {
  const aiPromotions = state.promotions.filter((p) => p.controlled_by === "ai" && !p.archived_at);
  if (aiPromotions.length === 0) return;
  const newId = () => rngUuid(rng);
  const expiring = new Set(changes.contractsExpired);
  const contracted = new Set(
    state.contracts.filter((c) => c.status === "active" && !expiring.has(c.id)).map((c) => c.wrestler_id),
  );
  const freeAgents = state.wrestlers.filter(
    (w) => !w.archived_at && w.career_status === "active" && !contracted.has(w.id) && w.role !== "manager",
  );
  const weeks = Math.max(1, Math.round(days / 7));
  for (const promo of aiPromotions) {
    for (let i = 0; i < weeks; i++) {
      if (freeAgents.length === 0 || !rng.chance(0.25 + promo.popularity / 400)) continue;
      // Prefer popular free agents, weighted.
      const target = rng.weighted(freeAgents, freeAgents.map((w) => 5 + w.popularity));
      freeAgents.splice(freeAgents.indexOf(target), 1);
      const salary = Math.round(400 + target.popularity * 40 + (target.card_position === "main_event" ? 1500 : 0));
      changes.signings.push({
        membership_id: newId(),
        contract_id: newId(),
        wrestler_id: target.id,
        promotion_id: promo.id,
        started_on: toDate,
        ends_on: addDays(toDate, 365),
        weekly_salary: salary,
      });
      changes.timelineEvents.push({
        id: newId(),
        promotion_id: promo.id,
        occurred_on: toDate,
        kind: "signing",
        title: `${promo.name} signed ${target.ring_name}`,
        summary: `${target.ring_name} agreed to a one-year deal with the rival promotion.`,
        wrestler_ids: [target.id],
        show_id: null,
        segment_id: null,
        championship_id: null,
        importance: target.popularity >= 60 ? 3 : 2,
      });
    }
    // Rival momentum: AI promotions slowly gain or lose popularity.
    const drift = Math.round(clamp(rng.normal(0.8) * weeks * 0.5, -2, 2));
    if (drift !== 0) changes.promotionDeltas.push({ id: promo.id, popularity: drift, reputation: 0, cash: 0 });
    if (rng.chance(0.15 * weeks)) {
      changes.timelineEvents.push({
        id: newId(),
        promotion_id: promo.id,
        occurred_on: toDate,
        kind: "news",
        title: drift >= 0 ? `${promo.name} reports strong ticket sales` : `${promo.name} struggling at the gate`,
        summary: `Industry insiders note ${promo.name}'s ${drift >= 0 ? "growth" : "decline"} in the ${promo.region} market.`,
        wrestler_ids: [],
        show_id: null,
        segment_id: null,
        championship_id: null,
        importance: 1,
      });
    }
  }
  void from;
}
