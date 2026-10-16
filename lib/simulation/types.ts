import type { CrowdReaction, Finish, InjurySeverity, SegmentKind } from "@/lib/domain/enums";

/** Dynamic stat changes for one wrestler, expressed as deltas. */
export interface WrestlerDelta {
  popularity: number;
  momentum: number;
  morale: number;
  fatigue: number;
  reputation: number;
  attributes: Partial<Record<string, number>>;
}

export interface SimInjury {
  wrestlerId: string;
  description: string;
  severity: InjurySeverity;
  days: number;
  isStoryline: boolean;
}

export interface TitleOutcome {
  championshipId: string;
  result: "retained" | "new_champion" | "vacant_filled" | "no_change";
  previousHolderIds: string[];
  newHolderIds: string[];
  previousReignId: string | null;
  /** Explains why the title did not change hands (e.g. DQ finish). */
  note: string;
}

export interface StorylineEffect {
  storylineId: string;
  intensityDelta: number;
  summary: string;
}

export interface ParticipantResult {
  wrestlerId: string;
  side: number;
  role: "competitor" | "manager" | "participant";
  outcome: "win" | "loss" | "draw" | "no_contest" | null;
  performance: number;
  delta: WrestlerDelta;
}

export interface MatchDetails {
  matchType: string;
  stipulation: string;
  sides: Array<{ side: number; wrestlerIds: string[]; strength: number; winProbability: number }>;
  winnerSide: number | null;
  winnerIds: string[];
  loserIds: string[];
  finish: Finish;
  finisherMove: string | null;
  decisiveWrestlerId: string | null;
  predetermined: boolean;
  interference: Array<{ wrestlerId: string; favorsSide: number }>;
  upset: boolean;
  botch: boolean;
}

export interface SegmentOutcome {
  segmentId: string;
  kind: SegmentKind;
  position: number;
  title: string;
  quality: number;
  starRating: number;
  crowdReaction: CrowdReaction;
  heat: number;
  durationMin: number;
  participants: ParticipantResult[];
  match: MatchDetails | null;
  title_outcome: TitleOutcome | null;
  storyline: StorylineEffect | null;
  injuries: SimInjury[];
  recap: string;
  /** Plain-language factors that influenced the quality score. */
  factors: string[];
}

export interface ShowRatingBreakdown {
  segmentAverage: number;
  mainEvent: number;
  opener: number;
  pacing: number;
  starPower: number;
  stakes: number;
  storyProgression: number;
  repetition: number;
  length: number;
  crowd: number;
  expectations: number;
  total: number;
  notes: string[];
}

export interface ShowFinances {
  enabled: boolean;
  attendance: number;
  capacity: number;
  lines: Array<{ category: string; amount: number; description: string }>;
  revenue: number;
  expenses: number;
  profit: number;
  explanation: string[];
}

export interface ShowSimulation {
  showId: string;
  seed: string;
  segments: SegmentOutcome[];
  rating: number;
  ratingScore: number;
  breakdown: ShowRatingBreakdown;
  finances: ShowFinances;
  promotionPopularityDelta: number;
  promotionReputationDelta: number;
  summary: string;
}

export function emptyDelta(): WrestlerDelta {
  return { popularity: 0, momentum: 0, morale: 0, fatigue: 0, reputation: 0, attributes: {} };
}
