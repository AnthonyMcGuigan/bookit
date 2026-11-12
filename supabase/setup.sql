-- Book It: Community database setup for Supabase.
-- Paste all of this into Supabase → SQL Editor → New query, then press Run. Safe to run again.

-- One row per player per collection: creations/<player id>, reports/<player id>, feedback/<player id>.
-- creations/featured is the owner's featured pack and tip link.
create table if not exists public.docs (
  col text not null check (col in ('creations', 'reports', 'feedback')),
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
