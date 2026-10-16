/**
 * Booking analytics from loaded universe state (pure; used by the Premium
 * analytics page and unit tests).
 */
import type { UniverseState } from "@/lib/domain/entities";

export interface PerformerStat {
  wrestlerId: string;
  name: string;
  matches: number;
  avgStars: number;
  wins: number;
}

export interface BookingAnalytics {
  showTrend: Array<{ showId: string; name: string; date: string; rating: number }>;
  performers: PerformerStat[];
  overexposed: PerformerStat[];
  underused: Array<{ wrestlerId: string; name: string; popularity: number }>;
  matchTypes: Array<{ matchType: string; count: number; avgStars: number }>;
  segmentShare: { matches: number; promos: number; avgMatchStars: number; avgPromoStars: number };
}

export function computeAnalytics(state: UniverseState, promotionIds: Set<string>): BookingAnalytics {
  const shows = state.shows
    .filter((s) => s.status === "completed" && promotionIds.has(s.promotion_id) && s.rating !== null)
    .sort((a, b) => (a.show_date < b.show_date ? -1 : 1));
  const showIds = new Set(shows.map((s) => s.id));
  const segments = state.segments.filter((s) => showIds.has(s.show_id));
  const results = new Map(state.segmentResults.map((r) => [r.segment_id, r]));
  const names = new Map(state.wrestlers.map((w) => [w.id, w.ring_name]));

  const perf = new Map<string, { matches: number; stars: number; wins: number }>();
  const types = new Map<string, { count: number; stars: number }>();
  let matches = 0, promos = 0, matchStars = 0, promoStars = 0;
  for (const seg of segments) {
    const result = results.get(seg.id);
    if (!result) continue;
    if (seg.kind === "match") {
      matches++;
      matchStars += result.star_rating;
      const key = seg.match_type ?? "standard";
      const t = types.get(key) ?? { count: 0, stars: 0 };
      t.count++;
      t.stars += result.star_rating;
      types.set(key, t);
      for (const p of state.segmentParticipants.filter((x) => x.segment_id === seg.id)) {
        const entry = perf.get(p.wrestler_id) ?? { matches: 0, stars: 0, wins: 0 };
        entry.matches++;
        entry.stars += result.star_rating;
        if (result.winner_side !== null && p.side === result.winner_side) entry.wins++;
        perf.set(p.wrestler_id, entry);
      }
    } else {
      promos++;
      promoStars += result.star_rating;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const performers: PerformerStat[] = [...perf].map(([id, p]) => ({
    wrestlerId: id,
    name: names.get(id) ?? "Unknown",
    matches: p.matches,
    avgStars: round(p.stars / p.matches),
    wins: p.wins,
  }));
  const used = new Set(perf.keys());
  const roster = new Set(state.rosterMemberships.filter((m) => m.ended_on === null && promotionIds.has(m.promotion_id)).map((m) => m.wrestler_id));
  const avgMatches = performers.length ? performers.reduce((n, p) => n + p.matches, 0) / performers.length : 0;
  return {
    showTrend: shows.slice(-20).map((s) => ({ showId: s.id, name: s.name, date: s.show_date, rating: s.rating ?? 0 })),
    performers: performers.filter((p) => p.matches >= 2).sort((a, b) => b.avgStars - a.avgStars).slice(0, 10),
    overexposed: performers.filter((p) => p.matches > avgMatches * 1.6 && p.matches >= 4).sort((a, b) => b.matches - a.matches).slice(0, 5),
    underused: state.wrestlers
      .filter((w) => roster.has(w.id) && !used.has(w.id) && !w.archived_at && w.career_status === "active" && w.role !== "manager")
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 8)
      .map((w) => ({ wrestlerId: w.id, name: w.ring_name, popularity: w.popularity })),
    matchTypes: [...types].map(([k, t]) => ({ matchType: k, count: t.count, avgStars: round(t.stars / t.count) })).sort((a, b) => b.count - a.count),
    segmentShare: { matches, promos, avgMatchStars: matches ? round(matchStars / matches) : 0, avgPromoStars: promos ? round(promoStars / promos) : 0 },
  };
}
