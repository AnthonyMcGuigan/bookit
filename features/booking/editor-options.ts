import type { Segment, Show, UniverseState } from "@/lib/domain/entities";
import { currentReignsFor } from "@/lib/simulation/context";
import type { EditorOptions } from "./segment-editor";
import type { SegmentPayload } from "./segment-schema";

export function editorOptions(state: UniverseState, show: Show): EditorOptions {
  const promoAbbr = new Map(state.promotions.map((p) => [p.id, p.abbreviation]));
  const signedTo = new Map<string, string[]>();
  for (const m of state.rosterMemberships) if (m.ended_on === null) signedTo.set(m.wrestler_id, [...(signedTo.get(m.wrestler_id) ?? []), m.promotion_id]);
  const injuries = new Map(state.injuries.filter((i) => i.healed_on === null).map((i) => [i.wrestler_id, i.description]));
  const reigns = currentReignsFor(state);
  return {
    wrestlers: state.wrestlers
      .filter((w) => !w.archived_at && w.career_status !== "retired")
      .map((w) => {
        const promos = signedTo.get(w.id) ?? [];
        return {
          id: w.id,
          name: w.ring_name,
          signed: promos.includes(show.promotion_id),
          promotion: promos.map((p) => promoAbbr.get(p)).join("/") || "Free agent",
          injured: injuries.get(w.id) ?? null,
          fatigue: w.fatigue,
          division: w.division,
          role: w.role,
        };
      }),
    teams: state.teams
      .filter((t) => !t.disbanded_on && !t.archived_at && (t.promotion_id === null || t.promotion_id === show.promotion_id))
      .map((t) => ({ id: t.id, name: t.name, memberIds: state.teamMemberships.filter((m) => m.team_id === t.id && m.left_on === null && m.role !== "manager").map((m) => m.wrestler_id) })),
    championships: state.championships
      .filter((c) => c.status === "active" && c.promotion_id === show.promotion_id)
      .map((c) => ({ id: c.id, name: c.name, format: c.format, holderIds: reigns.get(c.id)?.holderIds ?? [] })),
    storylines: state.storylines
      .filter((s) => s.status !== "resolved" && s.status !== "abandoned" && (s.promotion_id === null || s.promotion_id === show.promotion_id))
      .map((s) => ({ id: s.id, title: s.title, participantIds: state.storylineParticipants.filter((p) => p.storyline_id === s.id && p.wrestler_id).map((p) => p.wrestler_id!) })),
    fatigueWarn: state.universe.settings.bookingRules.warnFatigueAbove,
  };
}

export function payloadFromSegment(state: UniverseState, segment: Segment): SegmentPayload {
  const parts = state.segmentParticipants.filter((p) => p.segment_id === segment.id).sort((a, b) => a.side - b.side);
  const maxSide = Math.max(1, ...parts.map((p) => p.side + 1), segment.kind === "match" ? 2 : 1);
  const sides: SegmentPayload["sides"] = Array.from({ length: maxSide }, (_, i) => {
    const members = parts.filter((p) => p.side === i);
    return { team_id: members.find((m) => m.team_id)?.team_id ?? null, members: members.map((m) => ({ wrestler_id: m.wrestler_id, role: m.role })) };
  });
  return {
    kind: segment.kind,
    title: segment.title,
    custom_kind_label: segment.custom_kind_label,
    description: segment.description,
    duration_min: segment.duration_min,
    storyline_id: segment.storyline_id,
    match_type: segment.match_type,
    stipulation: segment.stipulation,
    championship_id: segment.championship_id,
    stakes: segment.stakes,
    finish_plan: segment.finish_plan,
    predetermined_winner_side: segment.predetermined_winner_side,
    title_changes_on_dq: segment.title_changes_on_dq,
    interference: segment.interference,
    sides,
  };
}
