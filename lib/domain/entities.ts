/**
 * Domain entities. Property names intentionally match the PostgreSQL columns
 * (snake_case) so the same shapes flow through persistence, packages and the
 * simulation engine without lossy mapping layers. These schemas have no
 * dependency on React, Next.js or Supabase.
 */
import { z } from "zod";
import {
  ALIGNMENTS,
  AUDIENCE_PROFILES,
  CARD_POSITIONS,
  CAREER_STATUSES,
  CHAMPIONSHIP_FORMATS,
  CHAMPIONSHIP_STATUSES,
  CHAMPIONSHIP_TIERS,
  CONTROLLERS,
  CROWD_REACTIONS,
  DEAL_KINDS,
  DEVELOPMENT_KINDS,
  DIVISIONS,
  FINISH_PLANS,
  GENDERS,
  INJURY_SEVERITIES,
  MATCH_TYPES,
  MEMBERSHIP_END_REASONS,
  REIGN_END_REASONS,
  SEGMENT_KINDS,
  SHOW_STATUSES,
  SHOW_TYPES,
  STIPULATIONS,
  STORYLINE_KINDS,
  STORYLINE_ROLES,
  STORYLINE_STATUSES,
  TEAM_KINDS,
  TEAM_ROLES,
  TIMELINE_KINDS,
  TRANSACTION_CATEGORIES,
  UNIVERSE_ORIGINS,
  WRESTLER_ROLES,
} from "./enums";
import { universeSettingsSchema } from "./settings";

export const id = z.uuid();
export const isoDate = z.iso.date();
const timestamp = z.string();
const score = z.int().min(0).max(100);
const signedScore = z.int().min(-100).max(100);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #b91c1c");
const text = (max: number) => z.string().max(max);
const name = (max: number) => z.string().trim().min(1, "Required").max(max);

const universeOwned = {
  id,
  universe_id: id,
  created_at: timestamp,
  updated_at: timestamp,
};

export const universeSchema = z.object({
  id,
  owner_id: id,
  name: name(80),
  description: text(2000),
  origin: z.enum(UNIVERSE_ORIGINS),
  source_creation_id: id.nullable(),
  source_version: z.int().nullable(),
  attribution: z.array(z.unknown()),
  start_date: isoDate,
  game_date: isoDate,
  settings: universeSettingsSchema,
  schema_version: z.int(),
  revision: z.int(),
  idempotency_key: id.nullable(),
  archived_at: timestamp.nullable(),
  last_played_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
});
export type Universe = z.infer<typeof universeSchema>;

export const promotionSchema = z.object({
  ...universeOwned,
  name: name(80),
  abbreviation: name(8),
  tagline: text(120),
  description: text(4000),
  region: text(60),
  audience_profile: z.enum(AUDIENCE_PROFILES),
  primary_color: hexColor,
  secondary_color: hexColor,
  logo_asset_id: id.nullable(),
  reputation: score,
  popularity: score,
  controlled_by: z.enum(CONTROLLERS),
  cash_balance: z.number().int(),
  founded_on: isoDate.nullable(),
  archived_at: timestamp.nullable(),
});
export type Promotion = z.infer<typeof promotionSchema>;

export const venueSchema = z.object({
  ...universeOwned,
  name: name(80),
  city: text(80),
  region: text(60),
  capacity: z.int().min(50).max(150000),
  rental_cost: z.int().min(0),
  prestige: score,
  image_asset_id: id.nullable(),
  archived_at: timestamp.nullable(),
});
export type Venue = z.infer<typeof venueSchema>;

export const ATTRIBUTE_KEYS = [
  "in_ring",
  "technical",
  "power",
  "speed",
  "stamina",
  "charisma",
  "mic_skills",
  "selling",
  "psychology",
  "reliability",
  "big_match",
] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  in_ring: "In-ring",
  technical: "Technical",
  power: "Power",
  speed: "Speed",
  stamina: "Stamina",
  charisma: "Charisma",
  mic_skills: "Mic skills",
  selling: "Selling",
  psychology: "Psychology",
  reliability: "Reliability",
  big_match: "Big-match",
};
export const ATTRIBUTE_GROUPS: Array<{ label: string; keys: AttributeKey[] }> = [
  { label: "In-ring", keys: ["in_ring", "technical", "power", "speed", "stamina", "selling", "psychology"] },
  { label: "Presentation", keys: ["charisma", "mic_skills"] },
  { label: "Professional", keys: ["reliability", "big_match"] },
];

export const wrestlerSchema = z.object({
  ...universeOwned,
  ring_name: name(60),
  alternate_name: text(60),
  real_name: text(80),
  gender: z.enum(GENDERS),
  division: z.enum(DIVISIONS),
  billed_from: text(80),
  height_cm: z.int().min(120).max(250).nullable(),
  weight_kg: z.int().min(40).max(250).nullable(),
  birth_date: isoDate.nullable(),
  debut_date: isoDate.nullable(),
  biography: text(4000),
  finisher: text(60),
  portrait_asset_id: id.nullable(),
  career_status: z.enum(CAREER_STATUSES),
  alignment: z.enum(ALIGNMENTS),
  role: z.enum(WRESTLER_ROLES),
  card_position: z.enum(CARD_POSITIONS),
  in_ring: score,
  technical: score,
  power: score,
  speed: score,
  stamina: score,
  charisma: score,
  mic_skills: score,
  selling: score,
  psychology: score,
  reliability: score,
  big_match: score,
  popularity: score,
  momentum: signedScore,
  morale: score,
  fatigue: score,
  reputation: score,
  archived_at: timestamp.nullable(),
});
export type Wrestler = z.infer<typeof wrestlerSchema>;

export const rosterMembershipSchema = z.object({
  ...universeOwned,
  wrestler_id: id,
  promotion_id: id,
  started_on: isoDate,
  ended_on: isoDate.nullable(),
  end_reason: z.enum(MEMBERSHIP_END_REASONS).nullable(),
});
export type RosterMembership = z.infer<typeof rosterMembershipSchema>;

export const contractSchema = z.object({
  ...universeOwned,
  wrestler_id: id,
  promotion_id: id,
  starts_on: isoDate,
  ends_on: isoDate,
  weekly_salary: z.int().min(0),
  appearance_fee: z.int().min(0),
  exclusive: z.boolean(),
  status: z.enum(["active", "expired", "terminated"]),
});
export type Contract = z.infer<typeof contractSchema>;

export const injurySchema = z.object({
  ...universeOwned,
  wrestler_id: id,
  description: name(120),
  severity: z.enum(INJURY_SEVERITIES),
  started_on: isoDate,
  expected_return_on: isoDate,
  healed_on: isoDate.nullable(),
  segment_id: id.nullable(),
  is_storyline: z.boolean(),
});
export type Injury = z.infer<typeof injurySchema>;

export const teamSchema = z.object({
  ...universeOwned,
  promotion_id: id.nullable(),
  kind: z.enum(TEAM_KINDS),
  name: name(80),
  description: text(2000),
  logo_asset_id: id.nullable(),
  formed_on: isoDate,
  disbanded_on: isoDate.nullable(),
  experience: score,
  archived_at: timestamp.nullable(),
});
export type Team = z.infer<typeof teamSchema>;

export const teamMembershipSchema = z.object({
  ...universeOwned,
  team_id: id,
  wrestler_id: id,
  role: z.enum(TEAM_ROLES),
  joined_on: isoDate,
  left_on: isoDate.nullable(),
});
export type TeamMembership = z.infer<typeof teamMembershipSchema>;

export const chemistrySchema = z.object({
  universe_id: id,
  wrestler_a: id,
  wrestler_b: id,
  partner_score: signedScore,
  opponent_score: signedScore,
  matches_together: z.int().min(0),
  matches_against: z.int().min(0),
  updated_at: timestamp,
});
export type Chemistry = z.infer<typeof chemistrySchema>;

export const eligibilitySchema = z.object({
  divisions: z.array(z.enum(DIVISIONS)).optional(),
  cardPositions: z.array(z.enum(CARD_POSITIONS)).optional(),
  notes: z.string().max(300).optional(),
});
export type Eligibility = z.infer<typeof eligibilitySchema>;

export const championshipSchema = z.object({
  ...universeOwned,
  promotion_id: id,
  name: name(80),
  description: text(2000),
  image_asset_id: id.nullable(),
  division: z.enum(DIVISIONS),
  format: z.enum(CHAMPIONSHIP_FORMATS),
  tier: z.enum(CHAMPIONSHIP_TIERS),
  prestige: score,
  status: z.enum(CHAMPIONSHIP_STATUSES),
  established_on: isoDate,
  retired_on: isoDate.nullable(),
  eligibility: eligibilitySchema,
  sort_order: z.int(),
});
export type Championship = z.infer<typeof championshipSchema>;

export const titleReignSchema = z.object({
  ...universeOwned,
  championship_id: id,
  team_id: id.nullable(),
  started_on: isoDate,
  ended_on: isoDate.nullable(),
  end_reason: z.enum(REIGN_END_REASONS).nullable(),
  won_segment_id: id.nullable(),
  lost_segment_id: id.nullable(),
  defenses: z.int().min(0),
  notes: text(500),
  is_manual: z.boolean(),
});
export type TitleReign = z.infer<typeof titleReignSchema>;

export const titleReignHolderSchema = z.object({
  universe_id: id,
  reign_id: id,
  wrestler_id: id,
});
export type TitleReignHolder = z.infer<typeof titleReignHolderSchema>;

export const showSchema = z.object({
  ...universeOwned,
  promotion_id: id,
  venue_id: id.nullable(),
  name: name(80),
  show_type: z.enum(SHOW_TYPES),
  custom_type_label: text(40),
  show_date: isoDate,
  status: z.enum(SHOW_STATUSES),
  target_duration_min: z.int().min(15).max(600),
  ticket_price: z.int().min(0).max(1000),
  poster_asset_id: id.nullable(),
  notes: text(2000),
  rating: z.number().min(0).max(5).nullable(),
  rating_breakdown: z.record(z.string(), z.unknown()).nullable(),
  attendance: z.int().nullable(),
  sim_seed: z.string().nullable(),
  simulated_at: timestamp.nullable(),
  version: z.int(),
});
export type Show = z.infer<typeof showSchema>;

export const tournamentSchema = z.object({
  ...universeOwned,
  promotion_id: id,
  championship_id: id.nullable(),
  name: name(80),
  status: z.enum(["active", "completed", "cancelled"]),
  entrant_ids: z.array(id),
  round_winners: z.array(z.array(id)),
  winner_wrestler_id: id.nullable(),
});
export type Tournament = z.infer<typeof tournamentSchema>;

export const interferenceSchema = z.object({ wrestlerId: id, favorsSide: z.int().min(0).max(40) });
export type Interference = z.infer<typeof interferenceSchema>;

export const segmentSchema = z.object({
  ...universeOwned,
  show_id: id,
  position: z.int().min(0),
  kind: z.enum(SEGMENT_KINDS),
  title: text(120),
  custom_kind_label: text(40),
  description: text(2000),
  duration_min: z.int().min(1).max(120),
  storyline_id: id.nullable(),
  match_type: z.enum(MATCH_TYPES).nullable(),
  stipulation: z.enum(STIPULATIONS).nullable(),
  championship_id: id.nullable(),
  tournament_id: id.nullable(),
  tournament_round: z.int().min(0).max(10).nullable(),
  stakes: text(200),
  finish_plan: z.enum(FINISH_PLANS).nullable(),
  predetermined_winner_side: z.int().min(0).max(40).nullable(),
  interference: z.array(interferenceSchema),
  title_changes_on_dq: z.boolean(),
});
export type Segment = z.infer<typeof segmentSchema>;

export const segmentParticipantSchema = z.object({
  ...universeOwned,
  segment_id: id,
  wrestler_id: id,
  side: z.int().min(0).max(40),
  team_id: id.nullable(),
  role: z.enum(["competitor", "manager", "participant"]),
  outcome: z.enum(["win", "loss", "draw", "no_contest"]).nullable(),
});
export type SegmentParticipant = z.infer<typeof segmentParticipantSchema>;

export const segmentResultSchema = z.object({
  segment_id: id,
  universe_id: id,
  show_id: id,
  quality: score,
  star_rating: z.number().min(0).max(5),
  crowd_reaction: z.enum(CROWD_REACTIONS),
  duration_min: z.int().min(1).max(120),
  winner_side: z.int().nullable(),
  finish: z.string().nullable(),
  title_changed: z.boolean(),
  recap: z.string(),
  details: z.record(z.string(), z.unknown()),
  manually_edited: z.boolean(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type SegmentResultRow = z.infer<typeof segmentResultSchema>;

export const storylineSchema = z.object({
  ...universeOwned,
  promotion_id: id.nullable(),
  title: name(100),
  kind: z.enum(STORYLINE_KINDS),
  status: z.enum(STORYLINE_STATUSES),
  intensity: score,
  objective: text(500),
  resolution: text(1000),
  description: text(4000),
  auto_progress: z.boolean(),
  started_on: isoDate,
  resolved_on: isoDate.nullable(),
  championship_id: id.nullable(),
});
export type Storyline = z.infer<typeof storylineSchema>;

export const storylineParticipantSchema = z.object({
  ...universeOwned,
  storyline_id: id,
  wrestler_id: id.nullable(),
  team_id: id.nullable(),
  side: z.int().min(0).max(7),
  role: z.enum(STORYLINE_ROLES),
});
export type StorylineParticipant = z.infer<typeof storylineParticipantSchema>;

export const storylineDevelopmentSchema = z.object({
  ...universeOwned,
  storyline_id: id,
  occurred_on: isoDate,
  show_id: id.nullable(),
  segment_id: id.nullable(),
  kind: z.enum(DEVELOPMENT_KINDS),
  summary: name(1000),
  intensity_delta: signedScore,
});
export type StorylineDevelopment = z.infer<typeof storylineDevelopmentSchema>;

export const rivalrySchema = z.object({
  ...universeOwned,
  wrestler_a: id,
  wrestler_b: id,
  intensity: score,
  matches: z.int().min(0),
  started_on: isoDate,
  last_interaction_on: isoDate,
  ended_on: isoDate.nullable(),
  storyline_id: id.nullable(),
});
export type Rivalry = z.infer<typeof rivalrySchema>;

export const businessDealSchema = z.object({
  ...universeOwned,
  promotion_id: id,
  kind: z.enum(DEAL_KINDS),
  partner_name: name(80),
  amount_per_show: z.int().min(0),
  applies_to: z.array(z.enum(SHOW_TYPES)),
  starts_on: isoDate,
  ends_on: isoDate,
  status: z.enum(["active", "ended", "cancelled"]),
});
export type BusinessDeal = z.infer<typeof businessDealSchema>;

export const financialTransactionSchema = z.object({
  id,
  universe_id: id,
  promotion_id: id,
  occurred_on: isoDate,
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z.number().int(),
  show_id: id.nullable(),
  description: text(300),
  created_at: timestamp,
});
export type FinancialTransaction = z.infer<typeof financialTransactionSchema>;

export const timelineEventSchema = z.object({
  id,
  universe_id: id,
  promotion_id: id.nullable(),
  occurred_on: isoDate,
  kind: z.enum(TIMELINE_KINDS),
  title: name(200),
  summary: text(2000),
  wrestler_ids: z.array(id),
  show_id: id.nullable(),
  segment_id: id.nullable(),
  championship_id: id.nullable(),
  importance: z.int().min(1).max(5),
  created_at: timestamp,
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

/** The complete private state of one universe, as loaded for play. */
export interface UniverseState {
  universe: Universe;
  promotions: Promotion[];
  venues: Venue[];
  wrestlers: Wrestler[];
  rosterMemberships: RosterMembership[];
  contracts: Contract[];
  injuries: Injury[];
  teams: Team[];
  teamMemberships: TeamMembership[];
  chemistry: Chemistry[];
  championships: Championship[];
  titleReigns: TitleReign[];
  titleReignHolders: TitleReignHolder[];
  shows: Show[];
  tournaments: Tournament[];
  segments: Segment[];
  segmentParticipants: SegmentParticipant[];
  segmentResults: SegmentResultRow[];
  storylines: Storyline[];
  storylineParticipants: StorylineParticipant[];
  storylineDevelopments: StorylineDevelopment[];
  rivalries: Rivalry[];
  businessDeals: BusinessDeal[];
  financialTransactions: FinancialTransaction[];
  timelineEvents: TimelineEvent[];
}

/** Mapping from UniverseState keys to database tables. Order = safe insert order. */
export const UNIVERSE_TABLES = [
  ["promotions", "promotions"],
  ["venues", "venues"],
  ["wrestlers", "wrestlers"],
  ["rosterMemberships", "roster_memberships"],
  ["contracts", "contracts"],
  ["teams", "teams"],
  ["teamMemberships", "team_memberships"],
  ["chemistry", "chemistry"],
  ["championships", "championships"],
  ["shows", "shows"],
  ["tournaments", "tournaments"],
  ["storylines", "storylines"],
  ["storylineParticipants", "storyline_participants"],
  ["segments", "segments"],
  ["segmentParticipants", "segment_participants"],
  ["segmentResults", "segment_results"],
  ["injuries", "injuries"],
  ["titleReigns", "title_reigns"],
  ["titleReignHolders", "title_reign_holders"],
  ["rivalries", "rivalries"],
  ["storylineDevelopments", "storyline_developments"],
  ["businessDeals", "business_deals"],
  ["financialTransactions", "financial_transactions"],
  ["timelineEvents", "timeline_events"],
] as const satisfies ReadonlyArray<readonly [Exclude<keyof UniverseState, "universe">, string]>;

export type UniverseCollectionKey = (typeof UNIVERSE_TABLES)[number][0];
