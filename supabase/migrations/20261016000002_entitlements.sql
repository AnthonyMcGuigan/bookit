-- =============================================================================
-- Premium entitlements (provider independent) and billing references.
-- Clients can read their own entitlements but can never write them.
-- =============================================================================

create table public.plan_limits (
  plan text not null check (plan in ('free', 'premium')),
  feature text not null,
  limit_value bigint not null check (limit_value >= 0),
  description text not null,
  primary key (plan, feature)
);
alter table public.plan_limits enable row level security;
create policy "plan limits are public" on public.plan_limits for select using (true);
revoke insert, update, delete on public.plan_limits from anon, authenticated;

insert into public.plan_limits (plan, feature, limit_value, description) values
  ('free',    'universe_slots',       3,          'Cloud universe saves'),
  ('premium', 'universe_slots',       12,         'Cloud universe saves'),
  ('free',    'media_storage_bytes',  52428800,   'Custom image storage (50 MB)'),
  ('premium', 'media_storage_bytes',  524288000,  'Custom image storage (500 MB)'),
  ('free',    'advanced_analytics',   0,          'Advanced booking analytics'),
  ('premium', 'advanced_analytics',   1,          'Advanced booking analytics'),
  ('free',    'published_creations',  50,         'Active community creations'),
  ('premium', 'published_creations',  250,        'Active community creations');

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'premium' check (plan in ('premium')),
  -- 'development' grants are only honoured while app_config.dev_entitlements_enabled.
  source text not null check (source in ('development', 'purchase', 'grant')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  auto_renews boolean not null default false,
  provider text,
  provider_reference text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at),
  check (source <> 'purchase' or (provider is not null and provider_reference is not null))
);
create index entitlements_user_idx on public.entitlements (user_id);
create unique index entitlements_provider_ref_idx on public.entitlements (provider, provider_reference)
  where provider_reference is not null;
create trigger entitlements_touch before update on public.entitlements
  for each row execute function public.touch_updated_at();

alter table public.entitlements enable row level security;
create policy "users read their own entitlements" on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.entitlements from anon, authenticated;

-- Billing customer references for a future payment provider (written by the
-- server with the service role from verified webhooks only).
create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;

-- Raw, verified billing webhook events kept for idempotency and audit.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;

-- Effective plan for a user, derived only from server-side records.
create or replace function public.effective_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1
      from public.entitlements e
     where e.user_id = p_user
       and e.status in ('active', 'cancelled')   -- cancelled = runs until expiry
       and e.starts_at <= now()
       and (e.expires_at is null or e.expires_at > now())
       and (e.source <> 'development'
            or (select c.dev_entitlements_enabled from public.app_config c where c.id))
  ) then 'premium' else 'free' end;
$$;

create or replace function public.feature_limit(p_user uuid, p_feature text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select l.limit_value from public.plan_limits l
      where l.plan = public.effective_plan(p_user) and l.feature = p_feature),
    0);
$$;

-- Development-only entitlement switcher. Refuses unless dev entitlements are
-- enabled in app_config; grants are marked source = 'development' so they
-- can never be confused with real purchases.
create or replace function public.dev_set_entitlement_state(p_state text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not (select c.dev_entitlements_enabled from public.app_config c where c.id) then
    raise exception 'DEV_ENTITLEMENTS_DISABLED' using errcode = '42501';
  end if;
  if p_state not in ('none', 'active', 'expired', 'cancelled_active') then
    raise exception 'INVALID_STATE';
  end if;

  delete from public.entitlements where user_id = uid and source = 'development';

  if p_state = 'active' then
    insert into public.entitlements (user_id, source, status, starts_at, expires_at, note)
    values (uid, 'development', 'active', now() - interval '1 minute', now() + interval '30 days', 'Development test grant');
  elsif p_state = 'cancelled_active' then
    insert into public.entitlements (user_id, source, status, starts_at, expires_at, note)
    values (uid, 'development', 'cancelled', now() - interval '1 minute', now() + interval '3 days', 'Development grant: cancelled, active until expiry');
  elsif p_state = 'expired' then
    insert into public.entitlements (user_id, source, status, starts_at, expires_at, note)
    values (uid, 'development', 'expired', now() - interval '40 days', now() - interval '10 days', 'Development grant: expired');
  end if;
  return public.effective_plan(uid);
end;
$$;
revoke execute on function public.dev_set_entitlement_state(text) from anon;
