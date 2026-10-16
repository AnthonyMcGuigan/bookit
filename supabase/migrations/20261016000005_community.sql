-- =============================================================================
-- Community creations, versions, ratings, downloads, reports, appeals,
-- IP takedown requests and moderation audit log.
--
-- Public creation metadata is kept apart from private game state. Counters,
-- moderation state and ownership are never writable by clients; they are
-- maintained by security-definer functions and server code using the service
-- role after authentication and validation.
-- =============================================================================

create table public.community_creations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'wrestler', 'team', 'championship', 'promotion', 'venue', 'storyline', 'scenario', 'universe')),
  title text not null check (char_length(title) between 3 and 80),
  summary text not null default '' check (char_length(summary) <= 200),
  description text not null default '' check (char_length(description) <= 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  -- Owner-controlled visibility.
  visibility text not null default 'draft' check (visibility in ('draft', 'published', 'unlisted')),
  -- Moderation-controlled state.
  moderation_state text not null default 'pending'
    check (moderation_state in ('pending', 'approved', 'rejected', 'hidden', 'removed')),
  moderation_reason text,
  is_fan_content boolean not null default false,
  allow_derivatives boolean not null default true,
  -- Remix lineage.
  source_creation_id uuid references public.community_creations (id) on delete set null,
  source_version integer,
  lineage jsonb not null default '[]'::jsonb check (jsonb_typeof(lineage) = 'array'),
  current_version integer not null default 0,
  thumbnail_asset_id uuid references public.media_assets (id) on delete set null,
  -- Counters (maintained server-side).
  download_count integer not null default 0,
  rating_count integer not null default 0,
  rating_sum integer not null default 0,
  report_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_creations_listing_idx on public.community_creations (category, published_at desc)
  where visibility = 'published' and moderation_state = 'approved';
create index community_creations_owner_idx on public.community_creations (owner_id);
create index community_creations_tags_idx on public.community_creations using gin (tags);
create index community_creations_search_idx on public.community_creations
  using gin (to_tsvector('simple', title || ' ' || summary || ' ' || description));
create trigger community_creations_touch before update on public.community_creations
  for each row execute function public.touch_updated_at();

create or replace function public.creation_is_public(p_creation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_creations c
     where c.id = p_creation
       and c.visibility in ('published', 'unlisted')
       and c.moderation_state = 'approved'
       and c.current_version > 0
  );
$$;

create or replace function public.can_view_creation(p_creation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.creation_is_public(p_creation)
      or exists (select 1 from public.community_creations c where c.id = p_creation and c.owner_id = auth.uid())
      or public.is_moderator();
$$;

alter table public.community_creations enable row level security;
create policy "public creations are visible" on public.community_creations
  for select using (
    (visibility in ('published', 'unlisted') and moderation_state = 'approved' and current_version > 0)
    or owner_id = (select auth.uid())
    or (select public.is_moderator())
  );
-- Owners may edit descriptive metadata and visibility only.
create policy "owners edit their creations" on public.community_creations
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
revoke insert, update, delete on public.community_creations from anon, authenticated;
grant update (title, summary, description, tags, visibility, allow_derivatives, is_fan_content)
  on public.community_creations to authenticated;

-- Owners cannot use visibility changes to escape moderation: removed or
-- rejected creations cannot be re-published by the owner.
create or replace function public.guard_creation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if old.moderation_state in ('removed') and new.visibility <> 'draft' and new.visibility is distinct from old.visibility then
      raise exception 'CREATION_REMOVED' using errcode = '42501';
    end if;
    if new.visibility = 'published' and old.visibility <> 'published' and old.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger community_creations_guard before update on public.community_creations
  for each row execute function public.guard_creation_update();

create table public.creation_versions (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.community_creations (id) on delete cascade,
  version integer not null check (version > 0),
  package_schema_version integer not null,
  package jsonb not null,
  package_bytes integer not null check (package_bytes > 0 and package_bytes <= 4194304),
  -- Public media assets bundled with this version.
  media_asset_ids uuid[] not null default '{}',
  changelog text not null default '' check (char_length(changelog) <= 1000),
  entity_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (creation_id, version)
);
alter table public.creation_versions enable row level security;
create policy "versions visible with creation" on public.creation_versions
  for select using ((select public.can_view_creation(creation_id)));
revoke insert, update, delete on public.creation_versions from anon, authenticated;

-- Ratings: one per user and creation, 1-5 stars. Owners cannot rate their own.
create table public.creation_ratings (
  creation_id uuid not null references public.community_creations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (creation_id, user_id)
);
alter table public.creation_ratings enable row level security;
create policy "users read their own ratings" on public.creation_ratings
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.creation_ratings from anon, authenticated;
grant select on public.creation_ratings to authenticated;

create or replace function public.rate_creation(p_creation uuid, p_stars integer)
returns table (rating_count integer, rating_sum integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c record;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'INVALID_RATING'; end if;
  if public.is_restricted(uid, 'publishing_disabled') then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;
  select * into c from public.community_creations where id = p_creation for update;
  if not found or not public.creation_is_public(p_creation) then
    raise exception 'CREATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if c.owner_id = uid then raise exception 'CANNOT_RATE_OWN_CREATION' using errcode = '42501'; end if;
  perform public.consume_rate_limit('rate_creation', 60, interval '1 hour');

  insert into public.creation_ratings (creation_id, user_id, stars)
  values (p_creation, uid, p_stars)
  on conflict (creation_id, user_id) do update set stars = excluded.stars, updated_at = now();

  update public.community_creations cc
     set rating_count = s.cnt, rating_sum = s.total
    from (select count(*)::integer cnt, coalesce(sum(stars), 0)::integer total
            from public.creation_ratings where creation_id = p_creation) s
   where cc.id = p_creation;

  return query select cc.rating_count, cc.rating_sum from public.community_creations cc where cc.id = p_creation;
end;
$$;

create or replace function public.remove_creation_rating(p_creation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  delete from public.creation_ratings where creation_id = p_creation and user_id = uid;
  update public.community_creations cc
     set rating_count = s.cnt, rating_sum = s.total
    from (select count(*)::integer cnt, coalesce(sum(stars), 0)::integer total
            from public.creation_ratings where creation_id = p_creation) s
   where cc.id = p_creation;
end;
$$;

-- Downloads: counted once per user and creation.
create table public.creation_downloads (
  creation_id uuid not null references public.community_creations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null,
  first_downloaded_at timestamptz not null default now(),
  last_downloaded_at timestamptz not null default now(),
  primary key (creation_id, user_id)
);
alter table public.creation_downloads enable row level security;
create policy "users read their own downloads" on public.creation_downloads
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.creation_downloads from anon, authenticated;
grant select on public.creation_downloads to authenticated;

create or replace function public.record_creation_download(p_creation uuid, p_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  total integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_view_creation(p_creation) then
    raise exception 'CREATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.consume_rate_limit('download_creation', 200, interval '1 hour');
  insert into public.creation_downloads (creation_id, user_id, version)
  values (p_creation, uid, p_version)
  on conflict (creation_id, user_id) do update
     set version = excluded.version, last_downloaded_at = now();
  select count(*)::integer into total from public.creation_downloads where creation_id = p_creation;
  update public.community_creations set download_count = total where id = p_creation;
  return total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reports, appeals and IP takedown requests
-- -----------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('creation', 'user')),
  creation_id uuid references public.community_creations (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete cascade,
  category text not null check (category in (
    'ip_infringement', 'harassment', 'hateful', 'sexual', 'violent_real_world', 'spam', 'malicious_file', 'impersonation', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolution_note text,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  check ((target_type = 'creation' and creation_id is not null) or (target_type = 'user' and reported_user_id is not null))
);
create index reports_status_idx on public.reports (status, created_at);
create unique index reports_one_open_per_reporter on public.reports (reporter_id, coalesce(creation_id, reported_user_id))
  where status = 'open';
alter table public.reports enable row level security;
create policy "reporters and moderators read reports" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_moderator()));
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references auth.users (id) on delete set null,
  action text not null check (action in (
    'approve', 'reject', 'hide', 'remove', 'restore', 'dismiss_report', 'action_report',
    'suspend_user', 'restrict_publishing', 'lift_restriction', 'grant_role', 'revoke_role',
    'appeal_upheld', 'appeal_denied', 'auto_hide', 'auto_review', 'takedown_received', 'takedown_resolved')),
  creation_id uuid references public.community_creations (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index moderation_actions_idx on public.moderation_actions (created_at desc);
alter table public.moderation_actions enable row level security;
create policy "moderators read audit log" on public.moderation_actions
  for select to authenticated using ((select public.is_moderator()));
-- Owners can see actions taken on their own creations (transparency).
create policy "owners read actions on their creations" on public.moderation_actions
  for select to authenticated
  using (exists (select 1 from public.community_creations c where c.id = creation_id and c.owner_id = (select auth.uid())));
revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.community_creations (id) on delete cascade,
  appellant_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'upheld', 'denied')),
  moderator_note text,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index appeals_one_open on public.appeals (creation_id) where status = 'open';
alter table public.appeals enable row level security;
create policy "appellants and moderators read appeals" on public.appeals
  for select to authenticated
  using (appellant_id = (select auth.uid()) or (select public.is_moderator()));
revoke all on public.appeals from anon, authenticated;
grant select on public.appeals to authenticated;

create table public.ip_takedown_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users (id) on delete set null,
  claimant_name text not null check (char_length(claimant_name) between 2 and 120),
  claimant_email text not null check (claimant_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  claimant_organization text not null default '' check (char_length(claimant_organization) <= 120),
  rights_holder_relationship text not null check (rights_holder_relationship in ('owner', 'authorized_agent')),
  work_description text not null check (char_length(work_description) between 10 and 4000),
  creation_id uuid references public.community_creations (id) on delete set null,
  infringing_url text not null check (char_length(infringing_url) <= 500),
  good_faith_statement boolean not null check (good_faith_statement),
  accuracy_statement boolean not null check (accuracy_statement),
  signature text not null check (char_length(signature) between 2 and 120),
  status text not null default 'received' check (status in ('received', 'content_removed', 'rejected', 'counter_notice')),
  moderator_note text,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ip_takedown_requests enable row level security;
create policy "moderators read takedown requests" on public.ip_takedown_requests
  for select to authenticated using ((select public.is_moderator()));
revoke all on public.ip_takedown_requests from anon, authenticated;
grant select on public.ip_takedown_requests to authenticated;

-- File a report. Reports in the IP category, or creations reaching the
-- configured threshold, are hidden pending review (conservative policy).
create or replace function public.file_report(
  p_target_type text, p_creation uuid, p_user uuid, p_category text, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
  open_reports integer;
  threshold integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if public.is_restricted(uid, 'suspended') then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;
  perform public.consume_rate_limit('file_report', 20, interval '1 day');

  if p_target_type = 'creation' then
    if not public.can_view_creation(p_creation) then
      raise exception 'CREATION_NOT_FOUND' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.community_creations where id = p_creation and owner_id = uid) then
      raise exception 'CANNOT_REPORT_OWN_CREATION';
    end if;
  elsif p_target_type = 'user' then
    if p_user = uid then raise exception 'CANNOT_REPORT_SELF'; end if;
    if not exists (select 1 from public.profiles where id = p_user) then
      raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
    end if;
  else
    raise exception 'INVALID_TARGET';
  end if;

  begin
    insert into public.reports (reporter_id, target_type, creation_id, reported_user_id, category, details)
    values (uid, p_target_type,
            case when p_target_type = 'creation' then p_creation end,
            case when p_target_type = 'user' then p_user end,
            p_category, left(coalesce(p_details, ''), 2000))
    returning id into rid;
  exception when unique_violation then
    raise exception 'ALREADY_REPORTED' using errcode = '23505';
  end;

  if p_target_type = 'creation' then
    select count(*) into open_reports from public.reports
     where creation_id = p_creation and status = 'open';
    update public.community_creations set report_count = report_count + 1 where id = p_creation;
    select auto_hide_report_threshold into threshold from public.app_config where id;
    if (p_category = 'ip_infringement' or open_reports >= threshold) then
      update public.community_creations
         set moderation_state = 'hidden',
             moderation_reason = 'Hidden automatically pending review after reports.'
       where id = p_creation and moderation_state = 'approved';
      if found then
        insert into public.moderation_actions (moderator_id, action, creation_id, report_id, reason, metadata)
        values (null, 'auto_hide', p_creation, rid,
                'Automatically hidden pending review (conservative report policy).',
                jsonb_build_object('open_reports', open_reports, 'category', p_category));
      end if;
    end if;
  end if;
  return rid;
end;
$$;

create or replace function public.submit_appeal(p_creation uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if not exists (select 1 from public.community_creations
                  where id = p_creation and owner_id = uid
                    and moderation_state in ('hidden', 'removed', 'rejected')) then
    raise exception 'NOTHING_TO_APPEAL';
  end if;
  perform public.consume_rate_limit('submit_appeal', 5, interval '1 day');
  begin
    insert into public.appeals (creation_id, appellant_id, message) values (p_creation, uid, p_message)
    returning id into aid;
  exception when unique_violation then
    raise exception 'APPEAL_ALREADY_OPEN' using errcode = '23505';
  end;
  return aid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Moderator tools. Every action writes to the audit log in the same
-- transaction. Callers must hold the moderator (or admin) role.
-- -----------------------------------------------------------------------------
create or replace function public.moderate_creation(p_creation uuid, p_action text, p_reason text, p_report uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_state text;
begin
  if not public.is_moderator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'REASON_REQUIRED'; end if;
  new_state := case p_action
    when 'approve' then 'approved'
    when 'restore' then 'approved'
    when 'reject' then 'rejected'
    when 'hide' then 'hidden'
    when 'remove' then 'removed'
    else null end;
  if new_state is null then raise exception 'INVALID_ACTION'; end if;

  update public.community_creations
     set moderation_state = new_state, moderation_reason = p_reason
   where id = p_creation;
  if not found then raise exception 'CREATION_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.moderation_actions (moderator_id, action, creation_id, report_id, reason)
  values (uid, p_action, p_creation, p_report, p_reason);

  -- Resolve open reports on this creation when content is actioned or cleared.
  update public.reports
     set status = case when p_action in ('approve', 'restore') then 'dismissed' else 'actioned' end,
         resolution_note = p_reason, handled_by = uid, handled_at = now()
   where creation_id = p_creation and status = 'open';
  return new_state;
end;
$$;

create or replace function public.resolve_report(p_report uuid, p_resolution text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if not public.is_moderator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_resolution not in ('actioned', 'dismissed') then raise exception 'INVALID_RESOLUTION'; end if;
  if coalesce(char_length(trim(p_note)), 0) < 3 then raise exception 'REASON_REQUIRED'; end if;
  update public.reports
     set status = p_resolution, resolution_note = p_note, handled_by = uid, handled_at = now()
   where id = p_report and status = 'open';
  if not found then raise exception 'REPORT_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.moderation_actions (moderator_id, action, report_id, reason)
  values (uid, case when p_resolution = 'dismissed' then 'dismiss_report' else 'action_report' end, p_report, p_note);
end;
$$;

create or replace function public.restrict_account(p_user uuid, p_kind text, p_reason text, p_days integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if not public.is_moderator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_user = uid then raise exception 'CANNOT_RESTRICT_SELF'; end if;
  if exists (select 1 from public.user_roles where user_id = p_user and role = 'admin') and not public.has_role('admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_kind not in ('suspended', 'publishing_disabled') then raise exception 'INVALID_KIND'; end if;
  if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'REASON_REQUIRED'; end if;
  insert into public.account_restrictions (user_id, kind, reason, ends_at, created_by)
  values (p_user, p_kind, p_reason, case when p_days is null then null else now() + make_interval(days => p_days) end, uid)
  returning id into rid;
  insert into public.moderation_actions (moderator_id, action, target_user_id, reason, metadata)
  values (uid, case when p_kind = 'suspended' then 'suspend_user' else 'restrict_publishing' end, p_user, p_reason,
          jsonb_build_object('days', p_days));
  return rid;
end;
$$;

create or replace function public.lift_restriction(p_restriction uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if not public.is_moderator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.account_restrictions set lifted_at = now(), lifted_by = uid
   where id = p_restriction and lifted_at is null
  returning user_id into target;
  if target is null then raise exception 'RESTRICTION_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.moderation_actions (moderator_id, action, target_user_id, reason)
  values (uid, 'lift_restriction', target, p_reason);
end;
$$;

create or replace function public.decide_appeal(p_appeal uuid, p_uphold boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a record;
begin
  if not public.is_moderator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(char_length(trim(p_note)), 0) < 3 then raise exception 'REASON_REQUIRED'; end if;
  select * into a from public.appeals where id = p_appeal and status = 'open' for update;
  if not found then raise exception 'APPEAL_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.appeals
     set status = case when p_uphold then 'upheld' else 'denied' end,
         moderator_note = p_note, handled_by = uid, handled_at = now()
   where id = p_appeal;
  if p_uphold then
    update public.community_creations set moderation_state = 'approved', moderation_reason = p_note
     where id = a.creation_id;
  end if;
  insert into public.moderation_actions (moderator_id, action, creation_id, reason)
  values (uid, case when p_uphold then 'appeal_upheld' else 'appeal_denied' end, a.creation_id, p_note);
end;
$$;

create or replace function public.resolve_takedown(p_request uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t record;
begin
  if not public.is_moderator() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_status not in ('content_removed', 'rejected', 'counter_notice') then raise exception 'INVALID_STATUS'; end if;
  if coalesce(char_length(trim(p_note)), 0) < 3 then raise exception 'REASON_REQUIRED'; end if;
  select * into t from public.ip_takedown_requests where id = p_request for update;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.ip_takedown_requests
     set status = p_status, moderator_note = p_note, handled_by = uid, handled_at = now()
   where id = p_request;
  if p_status = 'content_removed' and t.creation_id is not null then
    update public.community_creations set moderation_state = 'removed', moderation_reason = 'Removed following an intellectual-property takedown request. ' || p_note
     where id = t.creation_id;
  end if;
  insert into public.moderation_actions (moderator_id, action, creation_id, reason, metadata)
  values (uid, 'takedown_resolved', t.creation_id, p_note, jsonb_build_object('request_id', p_request, 'status', p_status));
end;
$$;

-- Admin-only role management.
create or replace function public.set_user_role(p_user uuid, p_role text, p_grant boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if not public.has_role('admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_role not in ('moderator', 'admin') then raise exception 'INVALID_ROLE'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, uid)
    on conflict do nothing;
  else
    if p_user = uid and p_role = 'admin' then raise exception 'CANNOT_REVOKE_OWN_ADMIN'; end if;
    delete from public.user_roles where user_id = p_user and role = p_role;
  end if;
  insert into public.moderation_actions (moderator_id, action, target_user_id, reason, metadata)
  values (uid, case when p_grant then 'grant_role' else 'revoke_role' end, p_user, p_reason, jsonb_build_object('role', p_role));
end;
$$;

revoke execute on function public.rate_creation(uuid, integer) from anon;
revoke execute on function public.remove_creation_rating(uuid) from anon;
revoke execute on function public.record_creation_download(uuid, integer) from anon;
revoke execute on function public.file_report(text, uuid, uuid, text, text) from anon;
revoke execute on function public.submit_appeal(uuid, text) from anon;
revoke execute on function public.moderate_creation(uuid, text, text, uuid) from anon;
revoke execute on function public.resolve_report(uuid, text, text) from anon;
revoke execute on function public.restrict_account(uuid, text, text, integer) from anon;
revoke execute on function public.lift_restriction(uuid, text) from anon;
revoke execute on function public.decide_appeal(uuid, boolean, text) from anon;
revoke execute on function public.resolve_takedown(uuid, text, text) from anon;
revoke execute on function public.set_user_role(uuid, text, boolean, text) from anon;

-- Public, privacy-safe creator stats.
create or replace view public.creator_stats
with (security_invoker = true) as
  select c.owner_id as creator_id,
         count(*) filter (where c.visibility = 'published' and c.moderation_state = 'approved' and c.current_version > 0) as published_count,
         coalesce(sum(c.download_count) filter (where c.visibility = 'published' and c.moderation_state = 'approved'), 0) as total_downloads
    from public.community_creations c
   group by c.owner_id;
