-- =============================================================================
-- Core: profiles, roles, application configuration, shared helpers.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Generic updated_at trigger.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Application configuration (single row). Only readable; changed by operators
-- via SQL or the service role. Never writable by end users.
-- -----------------------------------------------------------------------------
create table public.app_config (
  id boolean primary key default true check (id),
  -- When true, development-only entitlement grants are honoured. MUST be false
  -- in production (see README "Deployment").
  dev_entitlements_enabled boolean not null default false,
  -- Community moderation: 'auto' publishes validated content immediately unless
  -- it contains custom images or trips the term filter; 'review' requires
  -- moderator approval for every publication.
  community_moderation_mode text not null default 'auto'
    check (community_moderation_mode in ('auto', 'review')),
  -- Creations with custom images need moderator review before they are public.
  review_creations_with_images boolean not null default true,
  -- Number of open reports that automatically hides a creation pending review.
  auto_hide_report_threshold integer not null default 3 check (auto_hide_report_threshold > 0),
  -- Words that send a publication to review (lowercase, matched as substrings).
  flagged_terms text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.app_config (id) values (true);

alter table public.app_config enable row level security;
create policy "app_config readable by everyone" on public.app_config
  for select using (true);

-- -----------------------------------------------------------------------------
-- Profiles: public creator identity only. Email and auth data stay in auth.users.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 500),
  website_url text check (website_url is null or website_url ~ '^https://[^\s]{3,200}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles
  for select using (true);
create policy "users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- Profiles are created by the trigger below; users cannot insert or delete them.
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (handle, display_name, bio, website_url) on public.profiles to authenticated;

-- Create a profile for every new auth user with a unique generated handle.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_handle text;
  candidate text;
  suffix integer := 0;
  requested_name text;
begin
  requested_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                             split_part(new.email, '@', 1), 'Booker');
  base_handle := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'handle', requested_name), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_handle) < 3 then
    base_handle := 'booker' || base_handle;
  end if;
  base_handle := left(base_handle, 18);
  candidate := base_handle;
  while exists (select 1 from public.profiles where handle = candidate) loop
    suffix := suffix + 1;
    candidate := base_handle || suffix::text;
  end loop;

  insert into public.profiles (id, handle, display_name)
  values (new.id, candidate, left(requested_name, 40));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Roles. Users can never grant themselves roles: there are no insert/update
-- policies, and grants happen only through admin-only functions or the
-- service role.
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
create policy "users read their own roles" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_roles from anon, authenticated;

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and (r.role = p_role or r.role = 'admin')
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('moderator');
$$;

-- Moderators can see all roles.
create policy "moderators read all roles" on public.user_roles
  for select to authenticated using ((select public.is_moderator()));

-- -----------------------------------------------------------------------------
-- Account restrictions (suspensions). Created only by moderation functions.
-- -----------------------------------------------------------------------------
create table public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('suspended', 'publishing_disabled')),
  reason text not null check (char_length(reason) between 3 and 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  lifted_at timestamptz,
  lifted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index account_restrictions_user_idx on public.account_restrictions (user_id);
alter table public.account_restrictions enable row level security;
create policy "users read their own restrictions" on public.account_restrictions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_moderator()));
revoke insert, update, delete on public.account_restrictions from anon, authenticated;

create or replace function public.is_restricted(p_user uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_restrictions a
    where a.user_id = p_user
      and a.lifted_at is null
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
      and (a.kind = p_kind or a.kind = 'suspended')
  );
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting. Events are recorded by security-definer functions only.
-- -----------------------------------------------------------------------------
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup on public.rate_limit_events (user_id, action, created_at desc);
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;

-- Records an attempt and raises RATE_LIMITED when the user exceeded p_max
-- attempts within p_window. Returns remaining attempts.
create or replace function public.consume_rate_limit(p_action text, p_max integer, p_window interval)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select count(*) into used from public.rate_limit_events
   where user_id = uid and action = p_action and created_at > now() - p_window;
  if used >= p_max then
    raise exception 'RATE_LIMITED: % (limit % per %)', p_action, p_max, p_window using errcode = 'P0429';
  end if;
  insert into public.rate_limit_events (user_id, action) values (uid, p_action);
  -- Opportunistic cleanup of old events for this user.
  delete from public.rate_limit_events where user_id = uid and created_at < now() - interval '2 days';
  return p_max - used - 1;
end;
$$;
revoke execute on function public.consume_rate_limit(text, integer, interval) from anon;
