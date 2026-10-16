/**
 * Builds the read-only simulation context for a show from a universe state.
 * The simulation engine never touches persistence; it only reads this context.
 */
import type {
  BusinessDeal,
  Championship,
  Chemistry,
  Contract,
  Injury,
  Promotion,
  Rivalry,
  Segment,
  SegmentParticipant,
  Show,
  Storyline,
  StorylineParticipant,
  Team,
  TeamMembership,
  TitleReign,
  Tournament,
  UniverseState,
  Venue,
  Wrestler,
} from "@/lib/domain/entities";
import { addDays } from "@/lib/domain/dates";
import { parseSettings, type UniverseSettings } from "@/lib/domain/settings";

export interface BookedSegment {
  segment: Segment;
  participants: SegmentParticipant[];
}

export interface CurrentReign {
  reign: TitleReign;
  holderIds: string[];
}

export interface SimContext {
  universeId: string;
  gameDate: string;
  settings: UniverseSettings;
  show: Show;
  promotion: Promotion;
  venue: Venue | null;
  segments: BookedSegment[];
  wrestlers: Map<string, Wrestler>;
  activeInjuries: Map<string, Injury>;
  chemistry: Map<string, Chemistry>;
  rivalries: Map<string, Rivalry>;
  storylines: Map<string, Storyline>;
  storylineParticipants: StorylineParticipant[];
  championships: Map<string, Championship>;
  currentReigns: Map<string, CurrentReign>;
  teams: Map<string, Team>;
  teamMemberships: TeamMembership[];
  tournaments: Map<string, Tournament>;
  contracts: Contract[];
  businessDeals: BusinessDeal[];
  /** Matchup keys booked within the repeat window before this show. */
  recentMatchups: Map<string, number>;
  /** Number of segments each wrestler appeared in during the past 14 days. */
  recentAppearances: Map<string, number>;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function matchupKey(sides: string[][]): string {
  return sides
    .map((side) => side.slice().sort().join("+"))
    .sort()
    .join(" vs ");
}

export function currentReignsFor(state: Pick<UniverseState, "titleReigns" | "titleReignHolders">): Map<string, CurrentReign> {
  const holders = new Map<string, string[]>();
  for (const h of state.titleReignHolders) {
    const list = holders.get(h.reign_id) ?? [];
    list.push(h.wrestler_id);
    holders.set(h.reign_id, list);
  }
  const result = new Map<string, CurrentReign>();
  for (const reign of state.titleReigns) {
    if (reign.ended_on === null) result.set(reign.championship_id, { reign, holderIds: holders.get(reign.id) ?? [] });
  }
  return result;
}

export function bookedSegmentsForShow(state: UniverseState, showId: string): BookedSegment[] {
  const participantsBySegment = new Map<string, SegmentParticipant[]>();
  for (const p of state.segmentParticipants) {
    const list = participantsBySegment.get(p.segment_id) ?? [];
    list.push(p);
    participantsBySegment.set(p.segment_id, list);
  }
  return state.segments
    .filter((s) => s.show_id === showId)
    .sort((a, b) => a.position - b.position)
    .map((segment) => ({
      segment,
      participants: (participantsBySegment.get(segment.id) ?? []).sort((a, b) => a.side - b.side),
    }));
}

export function buildSimContext(state: UniverseState, showId: string): SimContext {
  const show = state.shows.find((s) => s.id === showId);
  if (!show) throw new Error(`Show ${showId} not found in universe`);
  const promotion = state.promotions.find((p) => p.id === show.promotion_id);
  if (!promotion) throw new Error(`Promotion for show ${showId} not found`);
  const settings = parseSettings(state.universe.settings);

  const activeInjuries = new Map<string, Injury>();
  for (const injury of state.injuries) {
    if (injury.healed_on === null && !injury.is_storyline) activeInjuries.set(injury.wrestler_id, injury);
  }

  const rivalries = new Map<string, Rivalry>();
  for (const r of state.rivalries) if (r.ended_on === null) rivalries.set(pairKey(r.wrestler_a, r.wrestler_b), r);

  const chemistry = new Map<string, Chemistry>();
  for (const c of state.chemistry) chemistry.set(pairKey(c.wrestler_a, c.wrestler_b), c);

  // Repetition and workload windows look at completed shows before this one.
  const repeatWindow = settings.bookingRules.repeatMatchupWindowDays;
  const windowStart = addDays(show.show_date, -repeatWindow);
  const workloadStart = addDays(show.show_date, -14);
  const pastShows = new Set(
    state.shows
      .filter((s) => s.id !== show.id && s.status === "completed" && s.show_date <= show.show_date)
      .map((s) => s.id),
  );
  const showDates = new Map(state.shows.map((s) => [s.id, s.show_date]));
  const recentMatchups = new Map<string, number>();
  const recentAppearances = new Map<string, number>();
  for (const seg of state.segments) {
    if (!pastShows.has(seg.show_id)) continue;
    const date = showDates.get(seg.show_id)!;
    const participants = state.segmentParticipants.filter((p) => p.segment_id === seg.id);
    if (date >= workloadStart) {
      for (const p of participants) recentAppearances.set(p.wrestler_id, (recentAppearances.get(p.wrestler_id) ?? 0) + 1);
    }
    if (seg.kind === "match" && date >= windowStart) {
      const sides = groupSides(participants.filter((p) => p.role === "competitor"));
      if (sides.length >= 2) {
        const key = matchupKey(sides.map((s) => s.map((p) => p.wrestler_id)));
        recentMatchups.set(key, (recentMatchups.get(key) ?? 0) + 1);
      }
    }
  }

  return {
    universeId: state.universe.id,
    gameDate: state.universe.game_date,
    settings,
    show,
    promotion,
    venue: state.venues.find((v) => v.id === show.venue_id) ?? null,
    segments: bookedSegmentsForShow(state, showId),
    wrestlers: new Map(state.wrestlers.map((w) => [w.id, w])),
    activeInjuries,
    chemistry,
    rivalries,
    storylines: new Map(state.storylines.map((s) => [s.id, s])),
    storylineParticipants: state.storylineParticipants,
    championships: new Map(state.championships.map((c) => [c.id, c])),
    currentReigns: currentReignsFor(state),
    teams: new Map(state.teams.map((t) => [t.id, t])),
    teamMemberships: state.teamMemberships,
    tournaments: new Map(state.tournaments.map((t) => [t.id, t])),
    contracts: state.contracts,
    businessDeals: state.businessDeals,
    recentMatchups,
    recentAppearances,
  };
}

/** Groups participants into sides ordered by side index. */
export function groupSides<T extends { side: number }>(participants: T[]): T[][] {
  const map = new Map<number, T[]>();
  for (const p of participants) {
    const list = map.get(p.side) ?? [];
    list.push(p);
    map.set(p.side, list);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);
}

export function sideIndexes<T extends { side: number }>(participants: T[]): number[] {
  return [...new Set(participants.map((p) => p.side))].sort((a, b) => a - b);
}
