-- BookIt: Community database setup for Supabase.
-- Paste all of this into Supabase → SQL Editor → New query, then press Run. Safe to run again.

-- One row per player per collection: creations/<player id>, reports/<player id>, feedback/<player id>.
-- creations/featured is the owner's featured pack and tip link.
create table if not exists public.docs (
  col text not null,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  data jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now(),
  primary key (col, id),
  constraint docs_size check (pg_column_size(data) < 2500000)
);
create index if not exists docs_col_updated on public.docs (col, updated desc);

-- Moderators. Add yourself after you sign in once (see the steps in the README).
create table if not exists public.admins (uid uuid primary key references auth.users (id) on delete cascade);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where uid = auth.uid()) $$;

alter table public.docs enable row level security;
alter table public.admins enable row level security;

-- Everyone can read creations. Reports and feedback: only the player who sent them, and moderators.
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to anon, authenticated
  using (col = 'creations' or id = (select auth.uid())::text or (select public.is_admin()));

-- Players can only write their own rows. Moderators can write any row.
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check (id = (select auth.uid())::text or (select public.is_admin()));

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (id = (select auth.uid())::text or (select public.is_admin()))
  with check (id = (select auth.uid())::text or (select public.is_admin()));

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated
  using (id = (select auth.uid())::text or (select public.is_admin()));

revoke all on public.docs from anon, authenticated;
grant select on public.docs to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
revoke all on public.admins from anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Hardening (added in v1.5.1, safe to run again):
-- 1. Cap each row by its real size. pg_column_size measures the compressed size, so a row that
--    compresses well could be far bigger once every player downloads it. The game itself stays under 240 KB.
alter table public.docs drop constraint if exists docs_text_size;
alter table public.docs add constraint docs_text_size check (octet_length(data::text) < 400000) not valid;
-- 2. The server sets the "updated" time, so nobody can pin their post to the top by sending a future date.
create or replace function public.docs_touch() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated := now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();
revoke all on function public.docs_touch() from public, anon, authenticated;

-- Cloud saves (added in v1.6, safe to run again): one row per player per cloud slot, cloud1..cloud3.
-- The read rule above already limits these rows to the player who owns them (and moderators).
alter table public.docs drop constraint if exists docs_col_check;
alter table public.docs add constraint docs_col_check check (col in ('creations', 'reports', 'feedback', 'cloud1', 'cloud2', 'cloud3'));

-- Space guard (added in v1.6.1, safe to run again). The free plan has 500 MB of database, and going over it
-- makes the whole database read-only. So past 400 MB, new uploads and cloud saves are refused with 'bookit_full'
-- (the game says the online space is full and keeps playing offline). Past 460 MB, rows can only get smaller.
-- Reports and feedback are tiny and always allowed. Raise or remove the limits after moving to a paid plan.
create or replace function public.docs_space() returns trigger
language plpgsql set search_path = ''
as $$
declare used bigint;
begin
  if new.col in ('reports', 'feedback') then return new; end if;
  -- the game saves with an upsert, which runs this as an INSERT first even when the row exists; the UPDATE check then follows
  if tg_op = 'INSERT' and exists (select 1 from public.docs where col = new.col and id = new.id) then return new; end if;
  used := pg_database_size(current_database());
  if used > 460 * 1024 * 1024 and (tg_op = 'INSERT' or octet_length(new.data::text) > octet_length(old.data::text)) then
    raise exception 'bookit_full' using errcode = 'P0001';
  end if;
  if used > 400 * 1024 * 1024 and tg_op = 'INSERT' then
    raise exception 'bookit_full' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists docs_space on public.docs;
create trigger docs_space before insert or update on public.docs for each row execute function public.docs_space();
revoke all on function public.docs_space() from public, anon, authenticated;

-- BookIt Supporter (added in v1.7, safe to run again). Stripe tells the stripe-webhook edge function about
-- each subscription, and the function writes one row per player here. Players can only read their own row.
create table if not exists public.supporters (
  uid uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active',
  plan text not null default '',
  period_end timestamptz not null default now(),
  stripe_customer text not null default '',
  stripe_sub text not null default '',
  updated timestamptz not null default now()
);
create index if not exists supporters_sub on public.supporters (stripe_sub);
alter table public.supporters enable row level security;
drop policy if exists supporters_read on public.supporters;
create policy supporters_read on public.supporters for select to authenticated
  using (uid = (select auth.uid()) or (select public.is_admin()));
revoke all on public.supporters from anon, authenticated;
grant select (uid, status, plan, period_end) on public.supporters to authenticated;

-- A supporter is someone whose subscription is paid up, with 3 days of grace for a late card payment.
create or replace function public.is_supporter() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.supporters where uid = auth.uid()
  and status in ('active', 'trialing', 'past_due') and period_end > now() - interval '3 days') $$;
revoke all on function public.is_supporter() from public;
grant execute on function public.is_supporter() to anon, authenticated;

-- The Supporter badge: ids of current supporters who have a Community space (those ids are already public).
create or replace function public.supporter_ids() returns setof text
language sql stable security definer set search_path = ''
as $$ select s.uid::text from public.supporters s
  where s.status in ('active', 'trialing', 'past_due') and s.period_end > now() - interval '3 days'
  and exists (select 1 from public.docs d where d.col = 'creations' and d.id = s.uid::text) limit 5000 $$;
revoke all on function public.supporter_ids() from public;
grant execute on function public.supporter_ids() to anon, authenticated;

-- Cloud slots 4 to 6 are for supporters. Anyone can still load or delete what is already there.
alter table public.docs drop constraint if exists docs_col_check;
alter table public.docs add constraint docs_col_check check (col in ('creations', 'reports', 'feedback', 'cloud1', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6'));
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check ((id = (select auth.uid())::text and (col not in ('cloud4', 'cloud5', 'cloud6') or (select public.is_supporter()))) or (select public.is_admin()));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (id = (select auth.uid())::text or (select public.is_admin()))
  with check ((id = (select auth.uid())::text and (col not in ('cloud4', 'cloud5', 'cloud6') or (select public.is_supporter()))) or (select public.is_admin()));

-- Row size: 400 KB for everyone, 800 KB for a supporter's Community space. The constraint is the hard ceiling.
alter table public.docs drop constraint if exists docs_text_size;
alter table public.docs add constraint docs_text_size check (octet_length(data::text) < 1000000) not valid;
create or replace function public.docs_rowsize() returns trigger
language plpgsql set search_path = ''
as $$
declare n int := octet_length(new.data::text);
begin
  if n >= 800000 or (n >= 400000 and not (new.col = 'creations' and public.is_supporter())) then
    raise exception 'bookit_big' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists docs_rowsize on public.docs;
create trigger docs_rowsize before insert or update on public.docs for each row execute function public.docs_rowsize();
revoke all on function public.docs_rowsize() from public, anon, authenticated;

-- Roster photos (added in v1.9.21, safe to run again). A shared roster's photos sit in their own gzipped row,
-- pix1/<player id> to pix10/<player id>, so a big roster with photos doesn't fill the player's Community space.
-- Slots 1-3 are for everyone, 4-10 for supporters. Anyone can read them, like creations.
alter table public.docs drop constraint if exists docs_col_check;
alter table public.docs add constraint docs_col_check check (col in ('creations', 'reports', 'feedback', 'cloud1', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6',
  'pix1', 'pix2', 'pix3', 'pix4', 'pix5', 'pix6', 'pix7', 'pix8', 'pix9', 'pix10'));
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to anon, authenticated
  using (col = 'creations' or col in ('pix1', 'pix2', 'pix3', 'pix4', 'pix5', 'pix6', 'pix7', 'pix8', 'pix9', 'pix10') or id = (select auth.uid())::text or (select public.is_admin()));
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check ((id = (select auth.uid())::text and (col not in ('cloud4', 'cloud5', 'cloud6', 'pix4', 'pix5', 'pix6', 'pix7', 'pix8', 'pix9', 'pix10') or (select public.is_supporter()))) or (select public.is_admin()));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (id = (select auth.uid())::text or (select public.is_admin()))
  with check ((id = (select auth.uid())::text and (col not in ('cloud4', 'cloud5', 'cloud6', 'pix4', 'pix5', 'pix6', 'pix7', 'pix8', 'pix9', 'pix10') or (select public.is_supporter()))) or (select public.is_admin()));
-- Row size: 400 KB for everyone, 800 KB for a supporter's Community space and photo rows.
create or replace function public.docs_rowsize() returns trigger
language plpgsql set search_path = ''
as $$
declare n int := octet_length(new.data::text);
begin
  if n >= 800000 or (n >= 400000 and not ((new.col = 'creations' or new.col like 'pix%') and public.is_supporter())) then
    raise exception 'bookit_big' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.docs_rowsize() from public, anon, authenticated;

-- Play stats (added in v1.9.22, safe to run again). Anonymous: each device makes up a random id that is never
-- linked to a Community account, an email or an IP address. The game sends small batches through log_play(),
-- and only the owner can read them, through play_stats() (Community → Inbox → Stats) or the views below.
create table if not exists public.play_devices (
  dev text primary key check (dev ~ '^[a-z0-9]{16,40}$'),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  plat text not null default 'web',
  v text not null default '',
  sessions int not null default 0,
  shows int not null default 0
);
create table if not exists public.play_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  dev text not null,
  sid text not null default '',
  ev text not null check (ev in ('open', 'time', 'show', 'new_game', 'feature', 'tutorial', 'crash')),
  x text not null default '' check (length(x) <= 40),
  n int not null default 0,
  v text not null default '' check (length(v) <= 12),
  plat text not null default 'web' check (plat in ('web', 'app', 'play'))
);
create index if not exists play_events_at on public.play_events (at);
create index if not exists play_events_dev_at on public.play_events (dev, at);
alter table public.play_devices enable row level security;
alter table public.play_events enable row level security;
-- no policies and no grants: players can't read or write these tables directly, only through the functions below
revoke all on public.play_devices, public.play_events from anon, authenticated;

-- p = {"d": device id, "s": session id, "v": version, "p": "web" | "app" | "play", "e": [[event, detail, number], ...]}
create or replace function public.log_play(p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d text := p->>'d'; s text := left(coalesce(p->>'s', ''), 24); ver text := left(coalesce(p->>'v', ''), 12);
  pl text := case when p->>'p' in ('web', 'app', 'play') then p->>'p' else 'web' end;
  e jsonb; ev text; nn int; opens int := 0; shows int := 0;
begin
  if d is null or d !~ '^[a-z0-9]{16,40}$' or jsonb_typeof(p->'e') <> 'array' then return; end if;
  -- keep the free plan safe: nothing new past 400 MB, at most 300 events per device an hour and 3000 a minute overall
  if pg_database_size(current_database()) > 400 * 1024 * 1024 then return; end if;
  if (select count(*) from public.play_events where dev = d and at > now() - interval '1 hour') > 300 then return; end if;
  if (select count(*) from public.play_events where at > now() - interval '1 minute') > 3000 then return; end if;
  for e in select value from jsonb_array_elements(p->'e') limit 40 loop
    ev := e->>0;
    continue when ev is null or ev not in ('open', 'time', 'show', 'new_game', 'feature', 'tutorial', 'crash');
    nn := case when jsonb_typeof(e->2) = 'number' then least(greatest((e->>2)::numeric, -1000000), 1000000)::int else 0 end;
    if ev = 'time' then nn := least(greatest(nn, 0), 3600); end if;
    insert into public.play_events (dev, sid, ev, x, n, v, plat)
      values (d, s, ev, left(regexp_replace(coalesce(e->>1, ''), '[^A-Za-z0-9:_.-]', '', 'g'), 40), nn, ver, pl);
    if ev = 'open' then opens := opens + 1; elsif ev = 'show' then shows := shows + 1; end if;
  end loop;
  insert into public.play_devices as t (dev, plat, v, sessions, shows) values (d, pl, ver, opens, shows)
    on conflict (dev) do update set last_at = now(), plat = excluded.plat, v = case when excluded.v <> '' then excluded.v else t.v end,
      sessions = t.sessions + excluded.sessions, shows = t.shows + excluded.shows;
  -- now and then, drop events older than 400 days (the device list keeps first and last seen)
  if random() < 0.01 then delete from public.play_events where at < now() - interval '400 days'; end if;
end $$;
revoke all on function public.log_play(jsonb) from public;
grant execute on function public.log_play(jsonb) to anon, authenticated;

-- The owner's dashboard: everything as one JSON answer, with days counted in the owner's time zone.
create or replace function public.play_stats(days int default 30, tz text default 'UTC') returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r jsonb; since timestamptz; z text := tz;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = z) then z := 'UTC'; end if;
  days := least(greatest(coalesce(days, 30), 1), 365);
  since := ((now() at time zone z)::date - (days - 1)) at time zone z;
  with ev as (select e.*, (e.at at time zone z)::date as day from public.play_events e where e.at >= since),
  dv as (select d.*, (d.first_at at time zone z)::date as fday from public.play_devices d),
  today as (select (now() at time zone z)::date as t),
  cal as (select generate_series((select t from today) - (days - 1), (select t from today), interval '1 day')::date as day),
  daily as (
    select c.day,
      count(distinct ev.dev) as players,
      count(distinct ev.dev) filter (where dv.fday = c.day) as new,
      count(distinct ev.sid) filter (where ev.ev = 'open') as sessions,
      count(*) filter (where ev.ev = 'show') as shows,
      coalesce(sum(ev.n) filter (where ev.ev = 'time'), 0) as secs
    from cal c left join ev on ev.day = c.day left join dv on dv.dev = ev.dev
    group by c.day order by c.day)
  select jsonb_build_object(
    'tz', z, 'days', days,
    'all_players', (select count(*) from dv),
    'today', (select count(distinct dev) from ev where day = (select t from today)),
    'active7', (select count(distinct dev) from ev where day > (select t from today) - 7),
    'active30', (select count(distinct dev) from ev where day > (select t from today) - 30),
    'new7', (select count(*) from dv where fday > (select t from today) - 7),
    'shows_all', (select coalesce(sum(shows), 0) from dv),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', day, 'p', players, 'n', new, 's', sessions, 'sh', shows, 'm', round(secs / 60.0))), '[]') from daily),
    'plat', (select coalesce(jsonb_object_agg(plat, c), '{}') from (select plat, count(distinct dev) c from ev group by plat) x),
    'ver', (select coalesce(jsonb_agg(jsonb_build_array(v, c) order by c desc), '[]') from (select v, count(distinct dev) c from ev where v <> '' group by v order by c desc limit 8) x),
    'feat', (select coalesce(jsonb_agg(jsonb_build_array(x, p, u) order by p desc, u desc), '[]') from (select x, count(distinct dev) p, sum(greatest(n, 1)) u from ev where ev = 'feature' and x <> '' group by x order by p desc, u desc limit 40) f),
    'kinds', (select coalesce(jsonb_object_agg(k, c), '{}') from (select ev || ':' || x as k, count(*) c from ev where ev in ('show', 'new_game', 'tutorial') group by 1) x),
    'crashes', (select count(*) from ev where ev.ev = 'crash'),
    -- of the players who started 2 to 60 days ago, how many came back on a later day, after a day, and after a week
    'ret', (select jsonb_build_object('cohort', count(*),
        'd1', count(*) filter (where exists (select 1 from public.play_events e where e.dev = c.dev and (e.at at time zone z)::date = c.fday + 1)),
        'later', count(*) filter (where exists (select 1 from public.play_events e where e.dev = c.dev and (e.at at time zone z)::date > c.fday)),
        'd7', count(*) filter (where c.fday <= (select t from today) - 8 and exists (select 1 from public.play_events e where e.dev = c.dev and (e.at at time zone z)::date >= c.fday + 7)),
        'cohort7', count(*) filter (where c.fday <= (select t from today) - 8))
      from dv c where c.fday between (select t from today) - 60 and (select t from today) - 2)
  ) into r;
  return r;
end $$;
revoke all on function public.play_stats(int, text) from public;
grant execute on function public.play_stats(int, text) to authenticated;

-- For the SQL Editor: select * from play_daily;  (owner only, players can't read these)
create or replace view public.play_daily with (security_invoker = true) as
  select (e.at at time zone 'UTC')::date as day, count(distinct e.dev) as players,
    count(distinct e.sid) filter (where e.ev = 'open') as sessions, count(*) filter (where e.ev = 'show') as shows,
    round(coalesce(sum(e.n) filter (where e.ev = 'time'), 0) / 60.0) as minutes
  from public.play_events e group by 1 order by 1 desc;
create or replace view public.play_features with (security_invoker = true) as
  select x as feature, count(distinct dev) as players, sum(greatest(n, 1)) as uses
  from public.play_events where ev = 'feature' and at > now() - interval '30 days' group by 1 order by 2 desc, 3 desc;
revoke all on public.play_daily, public.play_features from anon, authenticated;
