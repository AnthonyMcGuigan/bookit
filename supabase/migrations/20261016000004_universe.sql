-- =============================================================================
-- Private game state. Every universe-owned table carries universe_id and uses
-- composite foreign keys (universe_id, x_id) so that rows can only reference
-- entities from the same universe. RLS restricts all access to the universe
-- owner.
-- =============================================================================

create table public.universes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  origin text not null default 'blank'
    check (origin in ('blank', 'starter', 'community_import', 'file_import')),
  -- Attribution for universes imported from community creations or files.
  source_creation_id uuid,
  source_version integer,
  attribution jsonb not null default '[]'::jsonb check (jsonb_typeof(attribution) = 'array'),
  start_date date not null,
  game_date date not null,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  schema_version integer not null default 1,
  -- Incremented by state-changing RPCs; used for optimistic concurrency.
  revision integer not null default 0,
  -- Prevents double submission of the "create universe" form.
  idempotency_key uuid,
  archived_at timestamptz,
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);
create index universes_owner_idx on public.universes (owner_id, archived_at);
create trigger universes_touch before update on public.universes
  for each row execute function public.touch_updated_at();

create or replace function public.owns_universe(p_universe uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.universes u
    where u.id = p_universe and u.owner_id = auth.uid()
  );
$$;

alter table public.universes enable row level security;
create policy "owners manage universes" on public.universes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Server-side universe slot enforcement (premium-aware). Existing universes
-- are never locked when a premium plan lapses; only new creation is blocked.
create or replace function public.enforce_universe_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
  allowed bigint;
begin
  if new.owner_id is distinct from auth.uid() and auth.uid() is not null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select count(*) into used from public.universes where owner_id = new.owner_id;
  allowed := public.feature_limit(new.owner_id, 'universe_slots');
  if used >= allowed then
    raise exception 'UNIVERSE_LIMIT_REACHED: % of % universe slots used', used, allowed
      using errcode = 'P0402';
  end if;
  return new;
end;
$$;
create trigger universes_limit before insert on public.universes
  for each row execute function public.enforce_universe_limit();

-- Ownership of universe_id cannot change after creation.
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'OWNER_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger universes_owner_immutable before update on public.universes
  for each row execute function public.prevent_owner_change();

-- Helper to attach the standard owner policy + updated_at trigger.
create or replace function public._universe_table_setup(p_table text, p_touch boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format(
    'create policy "universe owner access" on public.%I for all to authenticated '
    'using ((select public.owns_universe(universe_id))) '
    'with check ((select public.owns_universe(universe_id)))', p_table);
  execute format('revoke all on public.%I from anon', p_table);
  if p_touch then
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      p_table || '_touch', p_table);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Promotions and venues
-- -----------------------------------------------------------------------------
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  abbreviation text not null check (char_length(abbreviation) between 1 and 8),
  tagline text not null default '' check (char_length(tagline) <= 120),
  description text not null default '' check (char_length(description) <= 4000),
  region text not null default 'National' check (char_length(region) <= 60),
  audience_profile text not null default 'mainstream'
    check (audience_profile in ('mainstream', 'family', 'workrate', 'hardcore', 'sports_entertainment', 'strong_style', 'lucha')),
  primary_color text not null default '#b91c1c' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null default '#111827' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_asset_id uuid references public.media_assets (id) on delete set null,
  reputation integer not null default 50 check (reputation between 0 and 100),
  popularity integer not null default 50 check (popularity between 0 and 100),
  controlled_by text not null default 'player' check (controlled_by in ('player', 'ai')),
  -- Cash in whole currency units (cents not needed for game economy).
  cash_balance bigint not null default 0,
  founded_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id)
);
create index promotions_universe_idx on public.promotions (universe_id);
select public._universe_table_setup('promotions');

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  city text not null default '' check (char_length(city) <= 80),
  region text not null default '' check (char_length(region) <= 60),
  capacity integer not null default 2000 check (capacity between 50 and 150000),
  rental_cost integer not null default 5000 check (rental_cost >= 0),
  prestige integer not null default 50 check (prestige between 0 and 100),
  image_asset_id uuid references public.media_assets (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id)
);
create index venues_universe_idx on public.venues (universe_id);
select public._universe_table_setup('venues');

-- -----------------------------------------------------------------------------
-- Wrestlers. Attributes use a documented 0-100 scale (see lib/domain/attributes).
-- -----------------------------------------------------------------------------
create table public.wrestlers (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  ring_name text not null check (char_length(ring_name) between 1 and 60),
  alternate_name text not null default '' check (char_length(alternate_name) <= 60),
  real_name text not null default '' check (char_length(real_name) <= 80),
  gender text not null default 'male' check (gender in ('male', 'female', 'nonbinary')),
  division text not null default 'open' check (division in ('mens', 'womens', 'open')),
  billed_from text not null default '' check (char_length(billed_from) <= 80),
  height_cm integer check (height_cm between 120 and 250),
  weight_kg integer check (weight_kg between 40 and 250),
  birth_date date,
  debut_date date,
  biography text not null default '' check (char_length(biography) <= 4000),
  finisher text not null default '' check (char_length(finisher) <= 60),
  portrait_asset_id uuid references public.media_assets (id) on delete set null,
  career_status text not null default 'active' check (career_status in ('active', 'inactive', 'retired')),
  alignment text not null default 'face' check (alignment in ('face', 'heel', 'tweener')),
  role text not null default 'wrestler' check (role in ('wrestler', 'manager', 'wrestler_manager')),
  card_position text not null default 'midcard'
    check (card_position in ('main_event', 'upper_midcard', 'midcard', 'lower_card', 'prospect')),
  -- In-ring and character attributes (0-100).
  in_ring integer not null default 50 check (in_ring between 0 and 100),
  technical integer not null default 50 check (technical between 0 and 100),
  power integer not null default 50 check (power between 0 and 100),
  speed integer not null default 50 check (speed between 0 and 100),
  stamina integer not null default 50 check (stamina between 0 and 100),
  charisma integer not null default 50 check (charisma between 0 and 100),
  mic_skills integer not null default 50 check (mic_skills between 0 and 100),
  selling integer not null default 50 check (selling between 0 and 100),
  psychology integer not null default 50 check (psychology between 0 and 100),
  reliability integer not null default 50 check (reliability between 0 and 100),
  big_match integer not null default 50 check (big_match between 0 and 100),
  -- Dynamic career values.
  popularity integer not null default 40 check (popularity between 0 and 100),
  momentum integer not null default 0 check (momentum between -100 and 100),
  morale integer not null default 70 check (morale between 0 and 100),
  fatigue integer not null default 0 check (fatigue between 0 and 100),
  reputation integer not null default 50 check (reputation between 0 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id)
);
create index wrestlers_universe_idx on public.wrestlers (universe_id);
create index wrestlers_name_idx on public.wrestlers (universe_id, ring_name);
select public._universe_table_setup('wrestlers');

create table public.roster_memberships (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  wrestler_id uuid not null,
  promotion_id uuid not null,
  started_on date not null,
  ended_on date,
  end_reason text check (end_reason in ('released', 'contract_expired', 'transferred', 'retired', 'signed_elsewhere', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, wrestler_id) references public.wrestlers (universe_id, id) on delete cascade,
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete cascade,
  check (ended_on is null or ended_on >= started_on)
);
create index roster_memberships_wrestler_idx on public.roster_memberships (universe_id, wrestler_id);
create index roster_memberships_promotion_idx on public.roster_memberships (universe_id, promotion_id) where ended_on is null;
-- A wrestler can only have one open membership per promotion.
create unique index roster_memberships_open_unique on public.roster_memberships (wrestler_id, promotion_id) where ended_on is null;
select public._universe_table_setup('roster_memberships');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  wrestler_id uuid not null,
  promotion_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  weekly_salary integer not null default 1000 check (weekly_salary >= 0),
  appearance_fee integer not null default 0 check (appearance_fee >= 0),
  exclusive boolean not null default true,
  status text not null default 'active' check (status in ('active', 'expired', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, wrestler_id) references public.wrestlers (universe_id, id) on delete cascade,
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete cascade,
  check (ends_on >= starts_on)
);
create index contracts_wrestler_idx on public.contracts (universe_id, wrestler_id);
create unique index contracts_active_unique on public.contracts (wrestler_id, promotion_id) where status = 'active';
select public._universe_table_setup('contracts');

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  wrestler_id uuid not null,
  description text not null check (char_length(description) between 1 and 120),
  severity text not null default 'minor' check (severity in ('minor', 'moderate', 'severe', 'career_threatening')),
  started_on date not null,
  expected_return_on date not null,
  healed_on date,
  segment_id uuid,
  is_storyline boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, wrestler_id) references public.wrestlers (universe_id, id) on delete cascade,
  check (expected_return_on >= started_on)
);
create index injuries_active_idx on public.injuries (universe_id, wrestler_id) where healed_on is null;
select public._universe_table_setup('injuries');

-- -----------------------------------------------------------------------------
-- Teams, trios and factions (one table, explicit kind) with membership history.
-- -----------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid,
  kind text not null check (kind in ('tag_team', 'trio', 'faction')),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  logo_asset_id uuid references public.media_assets (id) on delete set null,
  formed_on date not null,
  disbanded_on date,
  experience integer not null default 0 check (experience between 0 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete set null (promotion_id)
);
create index teams_universe_idx on public.teams (universe_id);
select public._universe_table_setup('teams');

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  team_id uuid not null,
  wrestler_id uuid not null,
  role text not null default 'member' check (role in ('member', 'leader', 'manager')),
  joined_on date not null,
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, team_id) references public.teams (universe_id, id) on delete cascade,
  foreign key (universe_id, wrestler_id) references public.wrestlers (universe_id, id) on delete cascade,
  check (left_on is null or left_on >= joined_on)
);
create index team_memberships_team_idx on public.team_memberships (universe_id, team_id);
create index team_memberships_wrestler_idx on public.team_memberships (universe_id, wrestler_id);
create unique index team_memberships_open_unique on public.team_memberships (team_id, wrestler_id) where left_on is null;
select public._universe_table_setup('team_memberships');

-- Chemistry between two wrestlers (wrestler_a < wrestler_b).
create table public.chemistry (
  universe_id uuid not null references public.universes (id) on delete cascade,
  wrestler_a uuid not null,
  wrestler_b uuid not null,
  partner_score integer not null default 0 check (partner_score between -100 and 100),
  opponent_score integer not null default 0 check (opponent_score between -100 and 100),
  matches_together integer not null default 0,
  matches_against integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (universe_id, wrestler_a, wrestler_b),
  check (wrestler_a < wrestler_b),
  foreign key (universe_id, wrestler_a) references public.wrestlers (universe_id, id) on delete cascade,
  foreign key (universe_id, wrestler_b) references public.wrestlers (universe_id, id) on delete cascade
);
select public._universe_table_setup('chemistry');

-- -----------------------------------------------------------------------------
-- Championships and reigns
-- -----------------------------------------------------------------------------
create table public.championships (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  image_asset_id uuid references public.media_assets (id) on delete set null,
  division text not null default 'open' check (division in ('mens', 'womens', 'open')),
  format text not null default 'singles' check (format in ('singles', 'tag', 'trios')),
  tier text not null default 'secondary' check (tier in ('world', 'secondary', 'tertiary', 'tag', 'specialty')),
  prestige integer not null default 50 check (prestige between 0 and 100),
  status text not null default 'active' check (status in ('active', 'retired')),
  established_on date not null,
  retired_on date,
  -- Eligibility rules (validated by the app): {"divisions": [...], "cardPositions": [...], "notes": "..."}
  eligibility jsonb not null default '{}'::jsonb check (jsonb_typeof(eligibility) = 'object'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete cascade
);
create index championships_universe_idx on public.championships (universe_id);
select public._universe_table_setup('championships');

-- -----------------------------------------------------------------------------
-- Shows and segments (segments of kind 'match' carry the match setup).
-- -----------------------------------------------------------------------------
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid not null,
  venue_id uuid,
  name text not null check (char_length(name) between 1 and 80),
  show_type text not null default 'weekly_tv'
    check (show_type in ('weekly_tv', 'house_show', 'major_event', 'tournament', 'special', 'custom')),
  custom_type_label text not null default '' check (char_length(custom_type_label) <= 40),
  show_date date not null,
  status text not null default 'draft' check (status in ('draft', 'booked', 'completed', 'cancelled')),
  target_duration_min integer not null default 120 check (target_duration_min between 15 and 600),
  ticket_price integer not null default 30 check (ticket_price between 0 and 1000),
  poster_asset_id uuid references public.media_assets (id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 2000),
  -- Results (filled exactly once by apply_show_result).
  rating numeric(4, 2) check (rating between 0 and 5),
  rating_breakdown jsonb,
  attendance integer,
  sim_seed text,
  simulated_at timestamptz,
  -- Optimistic concurrency token for the booking editor.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete cascade,
  foreign key (universe_id, venue_id) references public.venues (universe_id, id) on delete set null (venue_id)
);
create index shows_universe_date_idx on public.shows (universe_id, show_date);
select public._universe_table_setup('shows');

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid not null,
  championship_id uuid,
  name text not null check (char_length(name) between 1 and 80),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  -- Ordered list of entrant wrestler ids (power of two); bracket is derived.
  entrant_ids uuid[] not null default '{}',
  -- Recorded winners per round: [[uuid, uuid, ...], [uuid, ...], ...]
  round_winners jsonb not null default '[]'::jsonb,
  winner_wrestler_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete cascade,
  foreign key (universe_id, championship_id) references public.championships (universe_id, id) on delete set null (championship_id),
  foreign key (universe_id, winner_wrestler_id) references public.wrestlers (universe_id, id) on delete set null (winner_wrestler_id)
);
select public._universe_table_setup('tournaments');

create table public.storylines (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid,
  title text not null check (char_length(title) between 1 and 100),
  kind text not null default 'rivalry' check (kind in (
    'rivalry', 'feud', 'title_pursuit', 'betrayal', 'revenge', 'underdog',
    'team_breakup', 'return', 'faction_war', 'custom')),
  status text not null default 'active' check (status in ('building', 'active', 'climax', 'resolved', 'abandoned')),
  intensity integer not null default 30 check (intensity between 0 and 100),
  objective text not null default '' check (char_length(objective) <= 500),
  resolution text not null default '' check (char_length(resolution) <= 1000),
  description text not null default '' check (char_length(description) <= 4000),
  auto_progress boolean not null default true,
  started_on date not null,
  resolved_on date,
  championship_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete set null (promotion_id),
  foreign key (universe_id, championship_id) references public.championships (universe_id, id) on delete set null (championship_id)
);
create index storylines_universe_idx on public.storylines (universe_id, status);
select public._universe_table_setup('storylines');

create table public.storyline_participants (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  storyline_id uuid not null,
  wrestler_id uuid,
  team_id uuid,
  side integer not null default 0 check (side between 0 and 7),
  role text not null default 'participant' check (role in ('protagonist', 'antagonist', 'participant', 'manager', 'authority')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, storyline_id) references public.storylines (universe_id, id) on delete cascade,
  foreign key (universe_id, wrestler_id) references public.wrestlers (universe_id, id) on delete cascade,
  foreign key (universe_id, team_id) references public.teams (universe_id, id) on delete cascade,
  check ((wrestler_id is not null) <> (team_id is not null))
);
create index storyline_participants_idx on public.storyline_participants (universe_id, storyline_id);
select public._universe_table_setup('storyline_participants');

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  show_id uuid not null,
  position integer not null check (position >= 0),
  kind text not null check (kind in (
    'match', 'promo', 'interview', 'confrontation', 'backstage', 'return', 'debut',
    'contract_signing', 'injury_angle', 'storyline', 'custom')),
  title text not null default '' check (char_length(title) <= 120),
  custom_kind_label text not null default '' check (char_length(custom_kind_label) <= 40),
  description text not null default '' check (char_length(description) <= 2000),
  duration_min integer not null default 10 check (duration_min between 1 and 120),
  storyline_id uuid,
  -- Match setup (null for non-match segments).
  match_type text check (match_type in (
    'singles', 'tag', 'trios', 'triple_threat', 'fatal_four_way', 'multi_person',
    'handicap', 'battle_royal', 'rumble', 'tournament')),
  stipulation text check (stipulation in (
    'standard', 'no_dq', 'falls_count_anywhere', 'ladder', 'steel_cage', 'submission',
    'last_man_standing', 'iron_man', 'street_fight', 'tables', 'hardcore', 'elimination')),
  championship_id uuid,
  tournament_id uuid,
  tournament_round integer check (tournament_round between 0 and 10),
  stakes text not null default '' check (char_length(stakes) <= 200),
  finish_plan text check (finish_plan in (
    'auto', 'clean', 'pinfall', 'submission', 'knockout', 'dq', 'countout',
    'interference', 'roll_up', 'draw', 'no_contest')),
  -- Side index of the predetermined winner (null = simulate).
  predetermined_winner_side integer check (predetermined_winner_side between 0 and 40),
  -- Interference plan: [{"wrestlerId": uuid, "favorsSide": int}]
  interference jsonb not null default '[]'::jsonb check (jsonb_typeof(interference) = 'array'),
  title_changes_on_dq boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id),
  foreign key (universe_id, show_id) references public.shows (universe_id, id) on delete cascade,
  foreign key (universe_id, storyline_id) references public.storylines (universe_id, id) on delete set null (storyline_id),
  foreign key (universe_id, championship_id) references public.championships (universe_id, id) on delete set null (championship_id),
  foreign key (universe_id, tournament_id) references public.tournaments (universe_id, id) on delete set null (tournament_id),
  check ((kind = 'match') = (match_type is not null))
);
create index segments_show_idx on public.segments (universe_id, show_id, position);
select public._universe_table_setup('segments');

create table public.segment_participants (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  segment_id uuid not null,
  wrestler_id uuid not null,
  side integer not null default 0 check (side between 0 and 40),
  team_id uuid,
  role text not null default 'competitor' check (role in ('competitor', 'manager', 'participant')),
  -- Filled when the result is applied.
  outcome text check (outcome in ('win', 'loss', 'draw', 'no_contest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, segment_id) references public.segments (universe_id, id) on delete cascade,
  foreign key (universe_id, wrestler_id) references public.wrestlers (universe_id, id) on delete cascade,
  foreign key (universe_id, team_id) references public.teams (universe_id, id) on delete set null (team_id),
  unique (segment_id, wrestler_id)
);
create index segment_participants_wrestler_idx on public.segment_participants (universe_id, wrestler_id);
create index segment_participants_segment_idx on public.segment_participants (universe_id, segment_id);
select public._universe_table_setup('segment_participants');

create table public.segment_results (
  segment_id uuid primary key,
  universe_id uuid not null references public.universes (id) on delete cascade,
  show_id uuid not null,
  quality integer not null check (quality between 0 and 100),
  star_rating numeric(3, 2) not null check (star_rating between 0 and 5),
  crowd_reaction text not null check (crowd_reaction in ('dead', 'mild', 'warm', 'hot', 'electric')),
  duration_min integer not null check (duration_min between 1 and 120),
  winner_side integer,
  finish text,
  title_changed boolean not null default false,
  recap text not null,
  -- Full structured result (MatchResult / SegmentResult in lib/simulation).
  details jsonb not null,
  manually_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, segment_id) references public.segments (universe_id, id) on delete cascade,
  foreign key (universe_id, show_id) references public.shows (universe_id, id) on delete cascade
);
create index segment_results_show_idx on public.segment_results (universe_id, show_id);
select public._universe_table_setup('segment_results');

-- Injuries can reference the segment that caused them.
alter table public.injuries
  add foreign key (universe_id, segment_id) references public.segments (universe_id, id) on delete set null (segment_id);

create table public.title_reigns (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  championship_id uuid not null,
  team_id uuid,
  started_on date not null,
  ended_on date,
  end_reason text check (end_reason in ('lost', 'vacated', 'stripped', 'retired', 'injury', 'manual')),
  won_segment_id uuid,
  lost_segment_id uuid,
  defenses integer not null default 0 check (defenses >= 0),
  notes text not null default '' check (char_length(notes) <= 500),
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, id),
  foreign key (universe_id, championship_id) references public.championships (universe_id, id) on delete cascade,
  foreign key (universe_id, team_id) references public.teams (universe_id, id) on delete set null (team_id),
  foreign key (universe_id, won_segment_id) references public.segments (universe_id, id) on delete set null (won_segment_id),
  foreign key (universe_id, lost_segment_id) references public.segments (universe_id, id) on delete set null (lost_segment_id),
  check (ended_on is null or ended_on >= started_on)
);
create index title_reigns_championship_idx on public.title_reigns (universe_id, championship_id, started_on);
-- Only one current reign per championship.
create unique index title_reigns_current_unique on public.title_reigns (championship_id) where ended_on is null;
select public._universe_table_setup('title_reigns');

create table public.title_reign_holders (
  universe_id uuid not null references public.universes (id) on delete cascade,
  reign_id uuid not null,
  wrestler_id uuid not null,
  primary key (reign_id, wrestler_id),
  foreign key (universe_id, reign_id) references public.title_reigns (universe_id, id) on delete cascade,
  foreign key (universe_id, wrestler_id) references public.wrestlers (universe_id, id) on delete cascade
);
create index title_reign_holders_wrestler_idx on public.title_reign_holders (universe_id, wrestler_id);
select public._universe_table_setup('title_reign_holders', false);

create table public.rivalries (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  wrestler_a uuid not null,
  wrestler_b uuid not null,
  intensity integer not null default 20 check (intensity between 0 and 100),
  matches integer not null default 0,
  started_on date not null,
  last_interaction_on date not null,
  ended_on date,
  storyline_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (wrestler_a < wrestler_b),
  foreign key (universe_id, wrestler_a) references public.wrestlers (universe_id, id) on delete cascade,
  foreign key (universe_id, wrestler_b) references public.wrestlers (universe_id, id) on delete cascade,
  foreign key (universe_id, storyline_id) references public.storylines (universe_id, id) on delete set null (storyline_id)
);
create unique index rivalries_active_unique on public.rivalries (universe_id, wrestler_a, wrestler_b) where ended_on is null;
select public._universe_table_setup('rivalries');

create table public.storyline_developments (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  storyline_id uuid not null,
  occurred_on date not null,
  show_id uuid,
  segment_id uuid,
  kind text not null default 'development' check (kind in (
    'started', 'development', 'match', 'promo', 'betrayal', 'escalation', 'setback', 'climax', 'resolved', 'note')),
  summary text not null check (char_length(summary) between 1 and 1000),
  intensity_delta integer not null default 0 check (intensity_delta between -100 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, storyline_id) references public.storylines (universe_id, id) on delete cascade,
  foreign key (universe_id, show_id) references public.shows (universe_id, id) on delete set null (show_id),
  foreign key (universe_id, segment_id) references public.segments (universe_id, id) on delete set null (segment_id)
);
create index storyline_developments_idx on public.storyline_developments (universe_id, storyline_id, occurred_on);
select public._universe_table_setup('storyline_developments');

-- -----------------------------------------------------------------------------
-- Business: deals and financial ledger (whole currency units, signed amounts).
-- -----------------------------------------------------------------------------
create table public.business_deals (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid not null,
  kind text not null check (kind in ('broadcast', 'sponsorship')),
  partner_name text not null check (char_length(partner_name) between 1 and 80),
  -- Paid per show of the promotion (broadcast: weekly TV + major events).
  amount_per_show integer not null check (amount_per_show >= 0),
  applies_to text[] not null default '{weekly_tv,major_event,special}',
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete cascade,
  check (ends_on >= starts_on)
);
select public._universe_table_setup('business_deals');

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid not null,
  occurred_on date not null,
  category text not null check (category in (
    'starting_capital', 'tickets', 'merchandise', 'sponsorship', 'broadcast',
    'payroll', 'appearance_fees', 'venue', 'production', 'travel', 'signing_bonus', 'adjustment')),
  amount bigint not null,
  show_id uuid,
  description text not null default '' check (char_length(description) <= 300),
  created_at timestamptz not null default now(),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete cascade,
  foreign key (universe_id, show_id) references public.shows (universe_id, id) on delete set null (show_id)
);
create index financial_transactions_idx on public.financial_transactions (universe_id, promotion_id, occurred_on);
select public._universe_table_setup('financial_transactions', false);

-- -----------------------------------------------------------------------------
-- Persistent timeline of notable events.
-- -----------------------------------------------------------------------------
create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes (id) on delete cascade,
  promotion_id uuid,
  occurred_on date not null,
  kind text not null check (kind in (
    'show', 'match', 'title_change', 'title_vacated', 'signing', 'release', 'transfer',
    'debut', 'return', 'injury', 'recovery', 'retirement', 'team_formed', 'team_disbanded',
    'faction_joined', 'faction_left', 'storyline', 'business', 'news', 'contract')),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 2000),
  wrestler_ids uuid[] not null default '{}',
  show_id uuid,
  segment_id uuid,
  championship_id uuid,
  importance integer not null default 1 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  foreign key (universe_id, promotion_id) references public.promotions (universe_id, id) on delete set null (promotion_id),
  foreign key (universe_id, show_id) references public.shows (universe_id, id) on delete set null (show_id),
  foreign key (universe_id, segment_id) references public.segments (universe_id, id) on delete set null (segment_id),
  foreign key (universe_id, championship_id) references public.championships (universe_id, id) on delete set null (championship_id)
);
create index timeline_events_idx on public.timeline_events (universe_id, occurred_on desc);
create index timeline_events_wrestlers_idx on public.timeline_events using gin (wrestler_ids);
select public._universe_table_setup('timeline_events', false);

drop function public._universe_table_setup(text, boolean);
