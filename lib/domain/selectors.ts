/**
 * Pure read helpers over UniverseState used by pages and the booking editor.
 */
import type {
  Championship,
  Injury,
  Promotion,
  Segment,
  SegmentParticipant,
  Show,
  Storyline,
  Team,
  TitleReign,
  UniverseState,
  Wrestler,
} from "./entities";
import { daysBetween } from "./dates";

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function playerPromotions(state: UniverseState): Promotion[] {
  return state.promotions.filter((p) => p.controlled_by === "player" && !p.archived_at);
}

export function activeInjuries(state: UniverseState): Injury[] {
  return state.injuries.filter((i) => i.healed_on === null);
}

export function injuryFor(state: UniverseState, wrestlerId: string): Injury | undefined {
  return state.injuries.find((i) => i.wrestler_id === wrestlerId && i.healed_on === null);
}

/** Current promotions a wrestler is signed to (open roster memberships). */
export function promotionsOf(state: UniverseState, wrestlerId: string): Promotion[] {
  const ids = new Set(state.rosterMemberships.filter((m) => m.wrestler_id === wrestlerId && m.ended_on === null).map((m) => m.promotion_id));
  return state.promotions.filter((p) => ids.has(p.id));
}

export function rosterOf(state: UniverseState, promotionId: string): Wrestler[] {
  const ids = new Set(state.rosterMemberships.filter((m) => m.promotion_id === promotionId && m.ended_on === null).map((m) => m.wrestler_id));
  return state.wrestlers.filter((w) => ids.has(w.id) && !w.archived_at);
}

export function freeAgents(state: UniverseState): Wrestler[] {
  const signed = new Set(state.rosterMemberships.filter((m) => m.ended_on === null).map((m) => m.wrestler_id));
  return state.wrestlers.filter((w) => !signed.has(w.id) && !w.archived_at && w.career_status !== "retired");
}

export interface ReignView {
  reign: TitleReign;
  championship: Championship;
  holders: Wrestler[];
  team: Team | null;
  days: number;
}

export function reignHolders(state: UniverseState, reignId: string): Wrestler[] {
  const byId = indexById(state.wrestlers);
  return state.titleReignHolders.filter((h) => h.reign_id === reignId).map((h) => byId.get(h.wrestler_id)).filter((w): w is Wrestler => Boolean(w));
}

export function currentChampions(state: UniverseState): Array<{ championship: Championship; reign: ReignView | null }> {
  return state.championships
    .filter((c) => c.status === "active")
    .map((championship) => {
      const reign = state.titleReigns.find((r) => r.championship_id === championship.id && r.ended_on === null);
      return { championship, reign: reign ? reignView(state, reign) : null };
    });
}

export function reignView(state: UniverseState, reign: TitleReign): ReignView {
  const championship = state.championships.find((c) => c.id === reign.championship_id)!;
  return {
    reign,
    championship,
    holders: reignHolders(state, reign.id),
    team: reign.team_id ? (state.teams.find((t) => t.id === reign.team_id) ?? null) : null,
    days: daysBetween(reign.started_on, reign.ended_on ?? state.universe.game_date),
  };
}

export function lineage(state: UniverseState, championshipId: string): ReignView[] {
  return state.titleReigns
    .filter((r) => r.championship_id === championshipId)
    .sort((a, b) => (a.started_on < b.started_on ? -1 : a.started_on > b.started_on ? 1 : a.created_at < b.created_at ? -1 : 1))
    .map((r) => reignView(state, r));
}

export function titlesHeldBy(state: UniverseState, wrestlerId: string): Championship[] {
  const current = new Set(state.titleReigns.filter((r) => r.ended_on === null).map((r) => r.id));
  const reignIds = state.titleReignHolders.filter((h) => h.wrestler_id === wrestlerId && current.has(h.reign_id)).map((h) => h.reign_id);
  const champIds = new Set(state.titleReigns.filter((r) => reignIds.includes(r.id)).map((r) => r.championship_id));
  return state.championships.filter((c) => champIds.has(c.id));
}

export function upcomingShows(state: UniverseState, promotionIds?: Set<string>): Show[] {
  return state.shows
    .filter((s) => (s.status === "draft" || s.status === "booked") && (!promotionIds || promotionIds.has(s.promotion_id)))
    .sort((a, b) => (a.show_date < b.show_date ? -1 : a.show_date > b.show_date ? 1 : 0));
}

export function completedShows(state: UniverseState): Show[] {
  return state.shows.filter((s) => s.status === "completed").sort((a, b) => (a.show_date > b.show_date ? -1 : a.show_date < b.show_date ? 1 : 0));
}

export function segmentsOf(state: UniverseState, showId: string): Segment[] {
  return state.segments.filter((s) => s.show_id === showId).sort((a, b) => a.position - b.position);
}

export function participantsOf(state: UniverseState, segmentId: string): SegmentParticipant[] {
  return state.segmentParticipants.filter((p) => p.segment_id === segmentId).sort((a, b) => a.side - b.side);
}

export function activeStorylines(state: UniverseState): Storyline[] {
  return state.storylines.filter((s) => s.status !== "resolved" && s.status !== "abandoned");
}

export function teamMembers(state: UniverseState, teamId: string, includeFormer = false): Array<{ wrestler: Wrestler; role: string; joined_on: string; left_on: string | null }> {
  const byId = indexById(state.wrestlers);
  return state.teamMemberships
    .filter((m) => m.team_id === teamId && (includeFormer || m.left_on === null))
    .map((m) => ({ wrestler: byId.get(m.wrestler_id)!, role: m.role, joined_on: m.joined_on, left_on: m.left_on }))
    .filter((m) => m.wrestler);
}

export function teamsOf(state: UniverseState, wrestlerId: string): Team[] {
  const ids = new Set(state.teamMemberships.filter((m) => m.wrestler_id === wrestlerId && m.left_on === null).map((m) => m.team_id));
  return state.teams.filter((t) => ids.has(t.id) && !t.disbanded_on);
}

export interface Record3 {
  wins: number;
  losses: number;
  draws: number;
}

/** Win/loss record computed from loaded history (may be partial for long saves). */
export function recordsFromState(state: UniverseState): Map<string, Record3> {
  const matchSegments = new Set(state.segments.filter((s) => s.kind === "match").map((s) => s.id));
  const out = new Map<string, Record3>();
  for (const p of state.segmentParticipants) {
    if (!matchSegments.has(p.segment_id) || p.role !== "competitor" || !p.outcome) continue;
    const r = out.get(p.wrestler_id) ?? { wins: 0, losses: 0, draws: 0 };
    if (p.outcome === "win") r.wins++;
    else if (p.outcome === "loss") r.losses++;
    else r.draws++;
    out.set(p.wrestler_id, r);
  }
  return out;
}

export function storylinesOf(state: UniverseState, wrestlerId: string): Storyline[] {
  const ids = new Set(state.storylineParticipants.filter((p) => p.wrestler_id === wrestlerId).map((p) => p.storyline_id));
  return state.storylines.filter((s) => ids.has(s.id));
}

export function rivalriesOf(state: UniverseState, wrestlerId: string) {
  return state.rivalries
    .filter((r) => r.ended_on === null && (r.wrestler_a === wrestlerId || r.wrestler_b === wrestlerId))
    .sort((a, b) => b.intensity - a.intensity);
}
