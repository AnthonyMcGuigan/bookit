/**
 * Enumerations shared by the domain, simulation, persistence and UI layers.
 * Values mirror the CHECK constraints in supabase/migrations.
 */

function labels<T extends string>(map: Record<T, string>) {
  return map;
}

export const GENDERS = ["male", "female", "nonbinary"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS = labels<Gender>({ male: "Male", female: "Female", nonbinary: "Non-binary" });

export const DIVISIONS = ["mens", "womens", "open"] as const;
export type Division = (typeof DIVISIONS)[number];
export const DIVISION_LABELS = labels<Division>({ mens: "Men's", womens: "Women's", open: "Open" });

export const CAREER_STATUSES = ["active", "inactive", "retired"] as const;
export type CareerStatus = (typeof CAREER_STATUSES)[number];
export const CAREER_STATUS_LABELS = labels<CareerStatus>({ active: "Active", inactive: "Inactive", retired: "Retired" });

export const ALIGNMENTS = ["face", "heel", "tweener"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];
export const ALIGNMENT_LABELS = labels<Alignment>({ face: "Face", heel: "Heel", tweener: "Tweener" });

export const WRESTLER_ROLES = ["wrestler", "manager", "wrestler_manager"] as const;
export type WrestlerRole = (typeof WRESTLER_ROLES)[number];
export const WRESTLER_ROLE_LABELS = labels<WrestlerRole>({
  wrestler: "Wrestler",
  manager: "Manager",
  wrestler_manager: "Wrestler & manager",
});

export const CARD_POSITIONS = ["main_event", "upper_midcard", "midcard", "lower_card", "prospect"] as const;
export type CardPosition = (typeof CARD_POSITIONS)[number];
export const CARD_POSITION_LABELS = labels<CardPosition>({
  main_event: "Main event",
  upper_midcard: "Upper midcard",
  midcard: "Midcard",
  lower_card: "Lower card",
  prospect: "Prospect",
});

export const AUDIENCE_PROFILES = [
  "mainstream",
  "family",
  "workrate",
  "hardcore",
  "sports_entertainment",
  "strong_style",
  "lucha",
] as const;
export type AudienceProfile = (typeof AUDIENCE_PROFILES)[number];
export const AUDIENCE_PROFILE_LABELS = labels<AudienceProfile>({
  mainstream: "Mainstream",
  family: "Family friendly",
  workrate: "Workrate purist",
  hardcore: "Hardcore",
  sports_entertainment: "Sports entertainment",
  strong_style: "Strong style",
  lucha: "Lucha libre",
});

export const CONTROLLERS = ["player", "ai"] as const;
export type Controller = (typeof CONTROLLERS)[number];

export const TEAM_KINDS = ["tag_team", "trio", "faction"] as const;
export type TeamKind = (typeof TEAM_KINDS)[number];
export const TEAM_KIND_LABELS = labels<TeamKind>({ tag_team: "Tag team", trio: "Trio", faction: "Faction" });

export const TEAM_ROLES = ["member", "leader", "manager"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const CHAMPIONSHIP_FORMATS = ["singles", "tag", "trios"] as const;
export type ChampionshipFormat = (typeof CHAMPIONSHIP_FORMATS)[number];
export const CHAMPIONSHIP_FORMAT_LABELS = labels<ChampionshipFormat>({ singles: "Singles", tag: "Tag team", trios: "Trios" });

export const CHAMPIONSHIP_TIERS = ["world", "secondary", "tertiary", "tag", "specialty"] as const;
export type ChampionshipTier = (typeof CHAMPIONSHIP_TIERS)[number];
export const CHAMPIONSHIP_TIER_LABELS = labels<ChampionshipTier>({
  world: "World",
  secondary: "Secondary",
  tertiary: "Tertiary",
  tag: "Tag team",
  specialty: "Specialty",
});

export const CHAMPIONSHIP_STATUSES = ["active", "retired"] as const;
export type ChampionshipStatus = (typeof CHAMPIONSHIP_STATUSES)[number];

export const REIGN_END_REASONS = ["lost", "vacated", "stripped", "retired", "injury", "manual"] as const;
export type ReignEndReason = (typeof REIGN_END_REASONS)[number];

export const SHOW_TYPES = ["weekly_tv", "house_show", "major_event", "tournament", "special", "custom"] as const;
export type ShowType = (typeof SHOW_TYPES)[number];
export const SHOW_TYPE_LABELS = labels<ShowType>({
  weekly_tv: "Weekly TV",
  house_show: "House show",
  major_event: "Major event",
  tournament: "Tournament",
  special: "Special episode",
  custom: "Custom",
});

export const SHOW_STATUSES = ["draft", "booked", "completed", "cancelled"] as const;
export type ShowStatus = (typeof SHOW_STATUSES)[number];

export const SEGMENT_KINDS = [
  "match",
  "promo",
  "interview",
  "confrontation",
  "backstage",
  "return",
  "debut",
  "contract_signing",
  "injury_angle",
  "storyline",
  "custom",
] as const;
export type SegmentKind = (typeof SEGMENT_KINDS)[number];
export const SEGMENT_KIND_LABELS = labels<SegmentKind>({
  match: "Match",
  promo: "Promo",
  interview: "Interview",
  confrontation: "Confrontation",
  backstage: "Backstage segment",
  return: "Return",
  debut: "Debut",
  contract_signing: "Contract signing",
  injury_angle: "Injury angle",
  storyline: "Storyline development",
  custom: "Custom segment",
});

export const MATCH_TYPES = [
  "singles",
  "tag",
  "trios",
  "triple_threat",
  "fatal_four_way",
  "multi_person",
  "handicap",
  "battle_royal",
  "rumble",
  "tournament",
] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
export const MATCH_TYPE_LABELS = labels<MatchType>({
  singles: "Singles",
  tag: "Tag team",
  trios: "Trios",
  triple_threat: "Triple threat",
  fatal_four_way: "Fatal four-way",
  multi_person: "Multi-person",
  handicap: "Handicap",
  battle_royal: "Battle royal",
  rumble: "Rumble (timed entries)",
  tournament: "Tournament match",
});

export const STIPULATIONS = [
  "standard",
  "no_dq",
  "falls_count_anywhere",
  "ladder",
  "steel_cage",
  "submission",
  "last_man_standing",
  "iron_man",
  "street_fight",
  "tables",
  "hardcore",
  "elimination",
] as const;
export type Stipulation = (typeof STIPULATIONS)[number];
export const STIPULATION_LABELS = labels<Stipulation>({
  standard: "Standard rules",
  no_dq: "No disqualification",
  falls_count_anywhere: "Falls count anywhere",
  ladder: "Ladder",
  steel_cage: "Steel cage",
  submission: "Submission only",
  last_man_standing: "Last one standing",
  iron_man: "Iron match (timed)",
  street_fight: "Street fight",
  tables: "Tables",
  hardcore: "Hardcore",
  elimination: "Elimination",
});

export const FINISH_PLANS = [
  "auto",
  "clean",
  "pinfall",
  "submission",
  "knockout",
  "dq",
  "countout",
  "interference",
  "roll_up",
  "draw",
  "no_contest",
] as const;
export type FinishPlan = (typeof FINISH_PLANS)[number];
export const FINISH_PLAN_LABELS = labels<FinishPlan>({
  auto: "Let the simulation decide",
  clean: "Clean finish",
  pinfall: "Pinfall",
  submission: "Submission",
  knockout: "Knockout / referee stoppage",
  dq: "Disqualification",
  countout: "Count-out",
  interference: "Win via interference",
  roll_up: "Surprise roll-up",
  draw: "Draw / time limit",
  no_contest: "No contest",
});

/** Finishes that actually happen in a simulated match. */
export const FINISHES = [
  "pinfall",
  "submission",
  "knockout",
  "dq",
  "countout",
  "roll_up",
  "interference",
  "elimination",
  "ladder_retrieval",
  "escape",
  "draw",
  "no_contest",
] as const;
export type Finish = (typeof FINISHES)[number];
export const FINISH_LABELS = labels<Finish>({
  pinfall: "Pinfall",
  submission: "Submission",
  knockout: "Knockout",
  dq: "Disqualification",
  countout: "Count-out",
  roll_up: "Roll-up",
  interference: "Pinfall after interference",
  elimination: "Final elimination",
  ladder_retrieval: "Retrieved the prize",
  escape: "Escaped the cage",
  draw: "Draw",
  no_contest: "No contest",
});

export const CROWD_REACTIONS = ["dead", "mild", "warm", "hot", "electric"] as const;
export type CrowdReaction = (typeof CROWD_REACTIONS)[number];
export const CROWD_REACTION_LABELS = labels<CrowdReaction>({
  dead: "Dead silent",
  mild: "Mild",
  warm: "Warm",
  hot: "Hot",
  electric: "Electric",
});

export const STORYLINE_KINDS = [
  "rivalry",
  "feud",
  "title_pursuit",
  "betrayal",
  "revenge",
  "underdog",
  "team_breakup",
  "return",
  "faction_war",
  "custom",
] as const;
export type StorylineKind = (typeof STORYLINE_KINDS)[number];
export const STORYLINE_KIND_LABELS = labels<StorylineKind>({
  rivalry: "Rivalry",
  feud: "Feud",
  title_pursuit: "Title pursuit",
  betrayal: "Betrayal",
  revenge: "Revenge story",
  underdog: "Underdog rise",
  team_breakup: "Team breakup",
  return: "Return",
  faction_war: "Faction war",
  custom: "Custom arc",
});

export const STORYLINE_STATUSES = ["building", "active", "climax", "resolved", "abandoned"] as const;
export type StorylineStatus = (typeof STORYLINE_STATUSES)[number];
export const STORYLINE_STATUS_LABELS = labels<StorylineStatus>({
  building: "Building",
  active: "Active",
  climax: "Climax",
  resolved: "Resolved",
  abandoned: "Abandoned",
});

export const STORYLINE_ROLES = ["protagonist", "antagonist", "participant", "manager", "authority"] as const;
export type StorylineRole = (typeof STORYLINE_ROLES)[number];

export const DEVELOPMENT_KINDS = [
  "started",
  "development",
  "match",
  "promo",
  "betrayal",
  "escalation",
  "setback",
  "climax",
  "resolved",
  "note",
] as const;
export type DevelopmentKind = (typeof DEVELOPMENT_KINDS)[number];

export const INJURY_SEVERITIES = ["minor", "moderate", "severe", "career_threatening"] as const;
export type InjurySeverity = (typeof INJURY_SEVERITIES)[number];
export const INJURY_SEVERITY_LABELS = labels<InjurySeverity>({
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
  career_threatening: "Career-threatening",
});

export const DEAL_KINDS = ["broadcast", "sponsorship"] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

export const TRANSACTION_CATEGORIES = [
  "starting_capital",
  "tickets",
  "merchandise",
  "sponsorship",
  "broadcast",
  "payroll",
  "appearance_fees",
  "venue",
  "production",
  "travel",
  "signing_bonus",
  "adjustment",
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];
export const TRANSACTION_CATEGORY_LABELS = labels<TransactionCategory>({
  starting_capital: "Starting capital",
  tickets: "Ticket sales",
  merchandise: "Merchandise",
  sponsorship: "Sponsorship",
  broadcast: "Broadcast rights",
  payroll: "Payroll",
  appearance_fees: "Appearance fees",
  venue: "Venue rental",
  production: "Production",
  travel: "Travel",
  signing_bonus: "Signing bonus",
  adjustment: "Manual adjustment",
});

export const TIMELINE_KINDS = [
  "show",
  "match",
  "title_change",
  "title_vacated",
  "signing",
  "release",
  "transfer",
  "debut",
  "return",
  "injury",
  "recovery",
  "retirement",
  "team_formed",
  "team_disbanded",
  "faction_joined",
  "faction_left",
  "storyline",
  "business",
  "news",
  "contract",
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const MEMBERSHIP_END_REASONS = [
  "released",
  "contract_expired",
  "transferred",
  "retired",
  "signed_elsewhere",
  "manual",
] as const;
export type MembershipEndReason = (typeof MEMBERSHIP_END_REASONS)[number];

export const UNIVERSE_ORIGINS = ["blank", "starter", "community_import", "file_import"] as const;
export type UniverseOrigin = (typeof UNIVERSE_ORIGINS)[number];

export const MEDIA_KINDS = [
  "portrait",
  "promotion_logo",
  "championship",
  "team_logo",
  "venue",
  "event_poster",
  "show_graphic",
  "creation_thumbnail",
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
