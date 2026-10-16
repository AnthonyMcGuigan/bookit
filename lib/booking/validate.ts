/**
 * Non-blocking booking warnings for a show's card. The player can always
 * simulate anyway; these explain what the simulation will penalise or what
 * might not be intended. Blocking problems live in simulation/plan.ts.
 */
import type { UniverseState } from "@/lib/domain/entities";
import { addDays } from "@/lib/domain/dates";
import { parseSettings } from "@/lib/domain/settings";
import { MATCH_TYPE_LABELS } from "@/lib/domain/enums";
import { currentReignsFor, groupSides, matchupKey } from "@/lib/simulation/context";

export interface BookingWarning {
  segmentId: string | null;
  level: "info" | "warning";
  message: string;
}

const SIDE_SIZE: Partial<Record<string, number>> = { singles: 1, tag: 2, trios: 3 };
const SIDE_COUNT: Partial<Record<string, number>> = { singles: 2, tag: 2, trios: 2, triple_threat: 3, fatal_four_way: 4 };
const FORMAT_SIZE = { singles: 1, tag: 2, trios: 3 } as const;

export function validateCard(state: UniverseState, showId: string): BookingWarning[] {
  const show = state.shows.find((s) => s.id === showId);
  if (!show) return [];
  const settings = parseSettings(state.universe.settings);
  const rules = settings.bookingRules;
  const warnings: BookingWarning[] = [];
  const names = new Map(state.wrestlers.map((w) => [w.id, w]));
  const name = (id: string) => names.get(id)?.ring_name ?? "Unknown";
  const segments = state.segments.filter((s) => s.show_id === showId).sort((a, b) => a.position - b.position);
  const reigns = currentReignsFor(state);
  const injuries = new Map(state.injuries.filter((i) => i.healed_on === null).map((i) => [i.wrestler_id, i]));
  const roster = new Set(
    state.rosterMemberships.filter((m) => m.promotion_id === show.promotion_id && m.ended_on === null).map((m) => m.wrestler_id),
  );
  const appearances = new Map<string, number>();

  // Recent matchups for repetition warnings.
  const windowStart = addDays(show.show_date, -rules.repeatMatchupWindowDays);
  const recentShows = new Set(state.shows.filter((s) => s.status === "completed" && s.show_date >= windowStart && s.promotion_id === show.promotion_id).map((s) => s.id));
  const recent = new Set<string>();
  for (const seg of state.segments) {
    if (!recentShows.has(seg.show_id) || seg.kind !== "match") continue;
    const sides = groupSides(state.segmentParticipants.filter((p) => p.segment_id === seg.id && p.role === "competitor"));
    if (sides.length >= 2) recent.add(matchupKey(sides.map((s) => s.map((p) => p.wrestler_id))));
  }

  for (const seg of segments) {
    const label = seg.title || (seg.kind === "match" ? `${MATCH_TYPE_LABELS[seg.match_type ?? "singles"]} match` : "Segment");
    const parts = state.segmentParticipants.filter((p) => p.segment_id === seg.id);
    const warn = (message: string, level: BookingWarning["level"] = "warning") => warnings.push({ segmentId: seg.id, level, message: `${label}: ${message}` });
    for (const p of parts) {
      appearances.set(p.wrestler_id, (appearances.get(p.wrestler_id) ?? 0) + 1);
      const w = names.get(p.wrestler_id);
      if (!w) continue;
      const injury = injuries.get(p.wrestler_id);
      if (injury && p.role === "competitor") {
        warn(injury.is_storyline ? `${w.ring_name} is out with a storyline injury.` : `${w.ring_name} is injured (${injury.description}) and risks making it worse.`);
      }
      if (!roster.has(p.wrestler_id)) warn(`${w.ring_name} isn't signed to this promotion (appearance).`, "info");
      if (w.career_status !== "active") warn(`${w.ring_name} is ${w.career_status}.`);
      if (p.role === "competitor" && w.fatigue >= rules.warnFatigueAbove) warn(`${w.ring_name} is fatigued (${w.fatigue}); expect a weaker performance.`);
      if (p.role === "competitor" && w.role === "manager") warn(`${w.ring_name} is a manager, not a wrestler.`, "info");
    }
    if (seg.kind !== "match") continue;
    const competitors = parts.filter((p) => p.role === "competitor");
    const sides = groupSides(competitors);
    const type = seg.match_type ?? "singles";
    const size = SIDE_SIZE[type];
    if (size && sides.some((s) => s.length !== size)) warn(`${MATCH_TYPE_LABELS[type]} matches usually have ${size} per side.`, "info");
    const count = SIDE_COUNT[type];
    if (count && sides.length !== count) warn(`${MATCH_TYPE_LABELS[type]} matches usually have ${count} sides.`, "info");
    if (sides.length >= 2 && recent.has(matchupKey(sides.map((s) => s.map((p) => p.wrestler_id))))) {
      warn(
        `This exact matchup happened in the last ${rules.repeatMatchupWindowDays} days; fans may tire of it${seg.storyline_id ? " (storyline matches are hurt less)" : ""}.`,
        seg.storyline_id ? "info" : "warning",
      );
    }
    if (seg.championship_id) {
      const champ = state.championships.find((c) => c.id === seg.championship_id);
      if (champ) {
        if (champ.status !== "active") warn(`${champ.name} is retired.`);
        const reign = reigns.get(champ.id);
        const inMatch = new Set(competitors.map((p) => p.wrestler_id));
        if (reign && rules.requireChampionInTitleMatch && !reign.holderIds.some((h) => inMatch.has(h))) {
          warn(`The ${champ.name} holder isn't in the match; a win would still crown a new champion.`);
        }
        if (sides.some((s) => s.length !== FORMAT_SIZE[champ.format]) && type !== "battle_royal" && type !== "rumble") {
          warn(`${champ.name} is a ${champ.format} title but sides don't have ${FORMAT_SIZE[champ.format]} competitor(s).`);
        }
        if (rules.enforceDivisionEligibility && champ.division !== "open") {
          for (const p of competitors) {
            const w = names.get(p.wrestler_id);
            if (w && w.division !== "open" && w.division !== champ.division) warn(`${w.ring_name} isn't eligible for the ${champ.name} (${champ.division} division).`);
          }
        }
        if (champ.eligibility.cardPositions?.length) {
          for (const p of competitors) {
            const w = names.get(p.wrestler_id);
            if (w && !champ.eligibility.cardPositions.includes(w.card_position)) warn(`${w.ring_name}'s card position isn't listed for the ${champ.name}.`, "info");
          }
        }
        const sameTitle = segments.filter((s) => s.championship_id === champ.id);
        if (sameTitle.length > 1 && sameTitle[0].id === seg.id) warn(`${champ.name} is defended more than once on this card.`);
      }
    }
    if (seg.predetermined_winner_side !== null && seg.finish_plan === "draw") warn("A planned winner conflicts with a draw finish; the draw wins.", "info");
    for (const i of seg.interference) {
      if (!names.has(i.wrestlerId)) continue;
      if (competitors.some((p) => p.wrestler_id === i.wrestlerId)) warn(`${name(i.wrestlerId)} can't interfere in their own match.`);
    }
  }

  for (const [id, n] of appearances) {
    if (n > rules.maxSegmentsPerWrestler) warnings.push({ segmentId: null, level: "warning", message: `${name(id)} appears in ${n} segments (house limit ${rules.maxSegmentsPerWrestler}).` });
  }
  const runtime = segments.reduce((t, s) => t + s.duration_min, 0);
  if (segments.length > 0 && runtime > show.target_duration_min * 1.15) warnings.push({ segmentId: null, level: "info", message: `The card runs ${runtime} minutes, over the ${show.target_duration_min}-minute target.` });
  if (segments.length > 0 && runtime < show.target_duration_min * 0.6) warnings.push({ segmentId: null, level: "info", message: `The card runs only ${runtime} of ${show.target_duration_min} minutes; short shows rate lower.` });
  if (segments.length > 0 && segments[segments.length - 1].kind !== "match") warnings.push({ segmentId: null, level: "info", message: "The show doesn't end with a match. That's allowed, but main events usually are matches." });
  return warnings;
}
