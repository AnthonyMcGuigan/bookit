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
