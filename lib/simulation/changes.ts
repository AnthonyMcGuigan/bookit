/**
 * WorldChanges: the structured set of state changes produced by a simulation
 * step. The persistence layer applies it atomically (apply_world_changes RPC),
 * so a show's results are recorded exactly once or not at all.
 */
import type { InjurySeverity, MembershipEndReason, ReignEndReason, StorylineStatus, TimelineKind, TransactionCategory, DevelopmentKind } from "@/lib/domain/enums";

export interface WrestlerDeltaChange {
  wrestler_id: string;
  popularity: number;
  momentum: number;
  morale: number;
  fatigue: number;
  reputation: number;
  attributes: Record<string, number>;
}

export interface WorldChanges {
  gameDate: string | null;
  show: {
    id: string;
    expectedVersion: number;
    rating: number;
    ratingBreakdown: Record<string, unknown>;
    attendance: number;
    simSeed: string;
  } | null;
  segmentResults: Array<{
    segment_id: string;
    show_id: string;
    quality: number;
    star_rating: number;
    crowd_reaction: string;
    duration_min: number;
    winner_side: number | null;
    finish: string | null;
    title_changed: boolean;
    recap: string;
    details: Record<string, unknown>;
  }>;
  participantOutcomes: Array<{ segment_id: string; wrestler_id: string; outcome: string | null }>;
  wrestlerDeltas: WrestlerDeltaChange[];
  wrestlerStatus: Array<{ wrestler_id: string; career_status: "active" | "inactive" | "retired" }>;
  injuriesNew: Array<{
    id: string;
    wrestler_id: string;
    description: string;
    severity: InjurySeverity;
    started_on: string;
    expected_return_on: string;
    segment_id: string | null;
    is_storyline: boolean;
  }>;
  injuriesHealed: Array<{ id: string; healed_on: string }>;
  reignsEnded: Array<{ id: string; ended_on: string; end_reason: ReignEndReason; lost_segment_id: string | null }>;
  reignsNew: Array<{
    id: string;
    championship_id: string;
    team_id: string | null;
    started_on: string;
    won_segment_id: string | null;
    holder_ids: string[];
  }>;
  reignDefenses: Array<{ id: string; count: number }>;
  championshipPrestige: Array<{ id: string; delta: number }>;
  storylineUpdates: Array<{ id: string; intensity_delta: number; status: StorylineStatus | null; resolved_on: string | null }>;
  storylineDevelopments: Array<{
    id: string;
    storyline_id: string;
    occurred_on: string;
    show_id: string | null;
    segment_id: string | null;
    kind: DevelopmentKind;
    summary: string;
    intensity_delta: number;
  }>;
  rivalries: Array<{ id: string; wrestler_a: string; wrestler_b: string; intensity_delta: number; occurred_on: string; storyline_id: string | null }>;
  rivalriesEnded: Array<{ id: string; ended_on: string }>;
  chemistry: Array<{ wrestler_a: string; wrestler_b: string; partner_delta: number; opponent_delta: number; together: number; against: number }>;
  contractsExpired: string[];
  membershipsEnded: Array<{ id: string; ended_on: string; end_reason: MembershipEndReason }>;
  signings: Array<{
    membership_id: string;
    contract_id: string;
    wrestler_id: string;
    promotion_id: string;
    started_on: string;
    ends_on: string;
    weekly_salary: number;
  }>;
  timelineEvents: Array<{
    id: string;
    promotion_id: string | null;
    occurred_on: string;
    kind: TimelineKind;
    title: string;
    summary: string;
    wrestler_ids: string[];
    show_id: string | null;
    segment_id: string | null;
    championship_id: string | null;
    importance: number;
  }>;
  transactions: Array<{
    id: string;
    promotion_id: string;
    occurred_on: string;
    category: TransactionCategory;
    amount: number;
    show_id: string | null;
    description: string;
  }>;
  promotionDeltas: Array<{ id: string; popularity: number; reputation: number; cash: number }>;
  tournaments: Array<{ id: string; round_winners: string[][]; status: "active" | "completed"; winner_wrestler_id: string | null }>;
}

export function emptyChanges(): WorldChanges {
  return {
    gameDate: null,
    show: null,
    segmentResults: [],
    participantOutcomes: [],
    wrestlerDeltas: [],
    wrestlerStatus: [],
    injuriesNew: [],
    injuriesHealed: [],
    reignsEnded: [],
    reignsNew: [],
    reignDefenses: [],
    championshipPrestige: [],
    storylineUpdates: [],
    storylineDevelopments: [],
    rivalries: [],
    rivalriesEnded: [],
    chemistry: [],
    contractsExpired: [],
    membershipsEnded: [],
    signings: [],
    timelineEvents: [],
    transactions: [],
    promotionDeltas: [],
    tournaments: [],
  };
}

/** Merges b into a (a is mutated and returned). Deltas for the same entity are summed. */
export function mergeChanges(a: WorldChanges, b: WorldChanges): WorldChanges {
  if (b.gameDate && (!a.gameDate || b.gameDate > a.gameDate)) a.gameDate = b.gameDate;
  if (b.show) a.show = b.show;
  a.segmentResults.push(...b.segmentResults);
  a.participantOutcomes.push(...b.participantOutcomes);
  for (const d of b.wrestlerDeltas) addWrestlerDelta(a, d);
  a.wrestlerStatus.push(...b.wrestlerStatus);
  a.injuriesNew.push(...b.injuriesNew);
  a.injuriesHealed.push(...b.injuriesHealed);
  a.reignsEnded.push(...b.reignsEnded);
  a.reignsNew.push(...b.reignsNew);
  a.reignDefenses.push(...b.reignDefenses);
  a.championshipPrestige.push(...b.championshipPrestige);
  a.storylineUpdates.push(...b.storylineUpdates);
  a.storylineDevelopments.push(...b.storylineDevelopments);
  a.rivalries.push(...b.rivalries);
  a.rivalriesEnded.push(...b.rivalriesEnded);
  a.chemistry.push(...b.chemistry);
  a.contractsExpired.push(...b.contractsExpired);
  a.membershipsEnded.push(...b.membershipsEnded);
  a.signings.push(...b.signings);
  a.timelineEvents.push(...b.timelineEvents);
  a.transactions.push(...b.transactions);
  for (const p of b.promotionDeltas) {
    const existing = a.promotionDeltas.find((x) => x.id === p.id);
    if (existing) {
      existing.popularity += p.popularity;
      existing.reputation += p.reputation;
      existing.cash += p.cash;
    } else a.promotionDeltas.push({ ...p });
  }
  a.tournaments.push(...b.tournaments);
  return a;
}

export function addWrestlerDelta(changes: WorldChanges, d: WrestlerDeltaChange): void {
  const existing = changes.wrestlerDeltas.find((x) => x.wrestler_id === d.wrestler_id);
  if (!existing) {
    changes.wrestlerDeltas.push({ ...d, attributes: { ...d.attributes } });
    return;
  }
  existing.popularity += d.popularity;
  existing.momentum += d.momentum;
  existing.morale += d.morale;
  existing.fatigue += d.fatigue;
  existing.reputation += d.reputation;
  for (const [k, v] of Object.entries(d.attributes)) existing.attributes[k] = (existing.attributes[k] ?? 0) + v;
}

export function isEmptyDelta(d: WrestlerDeltaChange): boolean {
  return !d.popularity && !d.momentum && !d.morale && !d.fatigue && !d.reputation && Object.values(d.attributes).every((v) => !v);
}
