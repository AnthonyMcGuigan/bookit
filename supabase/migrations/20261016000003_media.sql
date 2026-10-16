-- =============================================================================
-- Media assets: metadata + storage references. The binary data lives in
-- Supabase Storage; uploads are validated and re-encoded by the server before
-- they are stored (see lib/media).
-- =============================================================================

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'portrait', 'promotion_logo', 'championship', 'team_logo', 'venue',
    'event_poster', 'show_graphic', 'creation_thumbnail')),
  bucket text not null check (bucket in ('media-private', 'media-public')),
  storage_path text not null,
  thumb_path text,
  mime_type text not null check (mime_type in ('image/webp', 'image/png', 'image/jpeg')),
  bytes integer not null check (bytes > 0 and bytes <= 5242880),
  thumb_bytes integer not null default 0 check (thumb_bytes >= 0),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  original_filename text check (char_length(original_filename) <= 200),
  -- Set when this public copy was made from a private asset during publishing.
  source_asset_id uuid references public.media_assets (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, storage_path)
);
create index media_assets_owner_idx on public.media_assets (owner_id, status);

alter table public.media_assets enable row level security;
create policy "owners read their media" on public.media_assets
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "public media metadata is readable" on public.media_assets
  for select using (bucket = 'media-public' and status = 'active');
-- Inserts and status changes go through the server (validated pipeline).
revoke insert, update, delete on public.media_assets from anon, authenticated;

create or replace function public.media_bytes_used(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(bytes + thumb_bytes), 0)::bigint
    from public.media_assets
   where owner_id = p_user and status = 'active';
$$;

-- Storage buckets. Private bucket: only owners (first path segment = user id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-private', 'media-private', false, 5242880, array['image/webp', 'image/png', 'image/jpeg']),
  ('media-public',  'media-public',  true,  5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "owners read private media objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'media-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Uploads to both buckets are performed by the server after validation using
-- the service role, so no insert/update/delete policies exist for clients.
