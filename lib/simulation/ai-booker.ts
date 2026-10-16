/**
 * Automatic booker used for AI-controlled rival promotions, the "auto-book"
 * helper in the booking screen, and to generate starter-universe history.
 * Returns plain entity objects; persistence is the caller's job.
 */
import type { Segment, SegmentParticipant, Show, Team, UniverseState, Wrestler } from "@/lib/domain/entities";
import type { ShowType } from "@/lib/domain/enums";
import { currentReignsFor, pairKey } from "./context";
import { createRng, rngUuid, type Rng } from "./rng";

export interface AutoBookedShow {
  show: Show;
  segments: Segment[];
  participants: SegmentParticipant[];
}

export interface AutoBookOptions {
  promotionId: string;
  date: string;
  showType: ShowType;
  name: string;
  seed: string;
  venueId?: string | null;
  /** Reuse an existing show row instead of creating one. */
  existingShow?: Show;
}

const NOW = "1970-01-01T00:00:00.000Z";

export function availableRoster(state: UniverseState, promotionId: string, date: string): Wrestler[] {
  const members = new Set(
    state.rosterMemberships
      .filter((m) => m.promotion_id === promotionId && m.started_on <= date && (m.ended_on === null || m.ended_on >= date))
      .map((m) => m.wrestler_id),
  );
  const injured = new Set(state.injuries.filter((i) => i.healed_on === null && i.started_on <= date).map((i) => i.wrestler_id));
  return state.wrestlers.filter(
    (w) => members.has(w.id) && !w.archived_at && w.career_status === "active" && !injured.has(w.id),
  );
}

export function autoBookShow(state: UniverseState, opts: AutoBookOptions): AutoBookedShow {
  const rng = createRng(opts.seed);
  const newId = () => rngUuid(rng);
  const universeId = state.universe.id;
  const show: Show = opts.existingShow ?? {
    id: newId(),
    universe_id: universeId,
    promotion_id: opts.promotionId,
    venue_id: opts.venueId ?? null,
    name: opts.name,
    show_type: opts.showType,
    custom_type_label: "",
    show_date: opts.date,
    status: "booked",
    target_duration_min: opts.showType === "major_event" ? 180 : opts.showType === "house_show" ? 100 : 120,
    ticket_price: opts.showType === "major_event" ? 60 : opts.showType === "house_show" ? 20 : 30,
    poster_asset_id: null,
    notes: "",
    rating: null,
    rating_breakdown: null,
    attendance: null,
    sim_seed: null,
    simulated_at: null,
    version: 0,
    created_at: NOW,
    updated_at: NOW,
  };

  const roster = availableRoster(state, opts.promotionId, opts.date);
  const wrestlers = roster.filter((w) => w.role !== "manager");
  const used = new Set<string>();
  const segments: Segment[] = [];
  const participants: SegmentParticipant[] = [];
  const reigns = currentReignsFor(state);
  const championships = state.championships
    .filter((c) => c.promotion_id === opts.promotionId && c.status === "active")
    .sort((a, b) => b.prestige - a.prestige);
  const isMajor = opts.showType === "major_event";
  const slots = isMajor ? 8 : opts.showType === "house_show" ? 6 : 6;

  const free = (w: Wrestler) => !used.has(w.id);
  const byPopularity = (list: Wrestler[]) => list.slice().sort((a, b) => b.popularity + b.momentum / 4 - (a.popularity + a.momentum / 4));

  const teamsOf = (kind: Team["kind"]) =>
    state.teams
      .filter((t) => t.kind === kind && t.promotion_id === opts.promotionId && !t.disbanded_on && !t.archived_at)
      .map((t) => ({
        team: t,
        members: state.teamMemberships
          .filter((m) => m.team_id === t.id && m.left_on === null && m.role !== "manager")
          .map((m) => roster.find((w) => w.id === m.wrestler_id))
          .filter((w): w is Wrestler => Boolean(w)),
      }))
      .filter((t) => t.members.length >= (kind === "trio" ? 3 : 2));

  const pushSegment = (seg: Partial<Segment> & Pick<Segment, "kind">, sides: Array<{ wrestlers: Wrestler[]; teamId?: string | null }>) => {
    const segment: Segment = {
      id: newId(),
      universe_id: universeId,
      show_id: show.id,
      position: 0,
      title: "",
      custom_kind_label: "",
      description: "",
      duration_min: 10,
      storyline_id: null,
      match_type: null,
      stipulation: null,
      championship_id: null,
      tournament_id: null,
      tournament_round: null,
      stakes: "",
      finish_plan: null,
      predetermined_winner_side: null,
      interference: [],
      title_changes_on_dq: false,
      created_at: NOW,
      updated_at: NOW,
      ...seg,
    };
    if (segment.kind === "match") {
      segment.stipulation ??= "standard";
      segment.finish_plan ??= "auto";
    }
    segments.push(segment);
    sides.forEach((side, sideIndex) => {
      for (const w of side.wrestlers) {
        used.add(w.id);
        participants.push({
          id: newId(),
          universe_id: universeId,
          segment_id: segment.id,
          wrestler_id: w.id,
          side: sideIndex,
          team_id: side.teamId ?? null,
          role: segment.kind === "match" ? "competitor" : "participant",
          outcome: null,
          created_at: NOW,
          updated_at: NOW,
        });
      }
    });
    return segment;
  };

  const rivalOf = (w: Wrestler): Wrestler | undefined => {
    const candidates = state.rivalries
      .filter((r) => r.ended_on === null && (r.wrestler_a === w.id || r.wrestler_b === w.id))
      .sort((a, b) => b.intensity - a.intensity)
      .map((r) => (r.wrestler_a === w.id ? r.wrestler_b : r.wrestler_a));
    for (const id of candidates) {
      const opp = wrestlers.find((x) => x.id === id && free(x));
      if (opp) return opp;
    }
    return undefined;
  };

  const eligible = (w: Wrestler, division: string) => division === "open" || w.division === division || w.division === "open";

  // Championship matches (main title always on major events, others sometimes).
  const titleSegments: Segment[] = [];
  for (const [index, c] of championships.entries()) {
    const reign = reigns.get(c.id);
    const defendChance = isMajor ? 1 : index === 0 ? 0.35 : 0.3;
    if (!rng.chance(defendChance)) continue;
    if (c.format === "singles") {
      const champ = reign ? wrestlers.find((w) => reign.holderIds.includes(w.id) && free(w)) : undefined;
      const pool = byPopularity(wrestlers.filter((w) => free(w) && w.id !== champ?.id && eligible(w, c.division)));
      if (reign && !champ) continue; // champion unavailable
      const challenger = (champ && rivalOf(champ)) ?? pool[0];
      const second = champ ?? pool.find((w) => w.id !== challenger?.id);
      if (!challenger || !second || challenger.id === second.id) continue;
      titleSegments.push(
        pushSegment(
          { kind: "match", match_type: "singles", championship_id: c.id, duration_min: c.tier === "world" ? (isMajor ? 22 : 16) : 12, title: `${c.name} match` },
          [{ wrestlers: [second] }, { wrestlers: [challenger] }],
        ),
      );
    } else {
      const teams = teamsOf(c.format === "tag" ? "tag_team" : "trio").filter((t) => t.members.every(free));
      const size = c.format === "tag" ? 2 : 3;
      const champs = reign ? teams.find((t) => t.members.some((m) => reign.holderIds.includes(m.id))) : undefined;
      const challengers = teams.filter((t) => t !== champs).sort((a, b) => b.team.experience - a.team.experience);
      const first = champs ?? challengers.shift();
      const second = challengers.find((t) => t !== first);
      if (!first || !second) continue;
      titleSegments.push(
        pushSegment(
          { kind: "match", match_type: c.format === "tag" ? "tag" : "trios", championship_id: c.id, duration_min: 12, title: `${c.name} match` },
          [
            { wrestlers: first.members.slice(0, size), teamId: first.team.id },
            { wrestlers: second.members.slice(0, size), teamId: second.team.id },
          ],
        ),
      );
    }
  }

  // Storyline promo (one per show when available).
  const activeStorylines = state.storylines.filter(
    (s) => s.promotion_id === opts.promotionId && (s.status === "active" || s.status === "building" || s.status === "climax"),
  );
  if (activeStorylines.length && segments.length < slots - 2) {
    const storyline = rng.pick(activeStorylines);
    const people = state.storylineParticipants
      .filter((p) => p.storyline_id === storyline.id && p.wrestler_id)
      .map((p) => roster.find((w) => w.id === p.wrestler_id))
      .filter((w): w is Wrestler => Boolean(w) && free(w!));
    if (people.length >= 1) {
      const kind = people.length >= 2 && rng.chance(0.5) ? "confrontation" : "promo";
      pushSegment(
        { kind, storyline_id: storyline.id, duration_min: 7, title: storyline.title },
        kind === "confrontation" ? [{ wrestlers: people.slice(0, 1) }, { wrestlers: people.slice(1, 2) }] : [{ wrestlers: people.slice(0, 1) }],
      );
    }
  }

  // Tag match if teams are available.
  const tagTeams = teamsOf("tag_team").filter((t) => t.members.slice(0, 2).every(free));
  if (tagTeams.length >= 2 && segments.length < slots - 1) {
    const [a, b] = rng.shuffle(tagTeams);
    pushSegment({ kind: "match", match_type: "tag", duration_min: 11 }, [
      { wrestlers: a.members.slice(0, 2), teamId: a.team.id },
      { wrestlers: b.members.slice(0, 2), teamId: b.team.id },
    ]);
  }

  // Fill remaining slots with singles matches, pairing by popularity and rivalry.
  let guard = 0;
  while (segments.length < slots && guard++ < 30) {
    const pool = byPopularity(wrestlers.filter(free));
    if (pool.length < 2) break;
    const first = rng.chance(0.6) ? pool[0] : rng.pick(pool.slice(0, Math.min(6, pool.length)));
    const opponent =
      rivalOf(first) ??
      pool.find((w) => w.id !== first.id && w.division === first.division && w.alignment !== first.alignment) ??
      pool.find((w) => w.id !== first.id && w.division === first.division) ??
      pool.find((w) => w.id !== first.id)!;
    const rivalry = state.rivalries.find((r) => r.ended_on === null && pairKey(r.wrestler_a, r.wrestler_b) === pairKey(first.id, opponent.id));
    pushSegment(
      {
        kind: "match",
        match_type: "singles",
        duration_min: 8 + Math.round((first.popularity + opponent.popularity) / 25),
        storyline_id: rivalry?.storyline_id ?? null,
      },
      [{ wrestlers: [first] }, { wrestlers: [opponent] }],
    );
  }

  // Order the card: opener = strong mid-level match, main event = most important.
  const importance = (s: Segment) => {
    const ids = participants.filter((p) => p.segment_id === s.id).map((p) => p.wrestler_id);
    const pop = ids.reduce((sum, id) => sum + (roster.find((w) => w.id === id)?.popularity ?? 0), 0) / Math.max(1, ids.length);
    const title = s.championship_id ? (state.championships.find((c) => c.id === s.championship_id)?.prestige ?? 0) / 2 : 0;
    return pop + title + (s.kind === "match" ? 5 : -15);
  };
  const ordered = segments.slice().sort((a, b) => importance(a) - importance(b));
  // Move the second-best match to the opener for a hot start.
  if (ordered.length >= 4) {
    const opener = ordered.splice(ordered.length - 2, 1)[0];
    ordered.unshift(opener);
  }
  ordered.forEach((s, i) => (s.position = i));
  void titleSegments;
  return { show, segments: ordered, participants };
}

export function seedFor(...parts: string[]): string {
  return parts.join(":");
}

export function pickRng(seed: string): Rng {
  return createRng(seed);
}
