-- Public images are only served while a creation that bundles them is
-- visible (or to their owner and moderators), so removing a creation also
-- stops its images from being served.
create or replace function public.public_asset_visible(p_asset uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.media_assets a where a.id = p_asset and a.owner_id = auth.uid())
      or public.is_moderator()
      or exists (
        select 1 from public.community_creations c
         where public.creation_is_public(c.id)
           and (c.thumbnail_asset_id = p_asset
                or exists (select 1 from public.creation_versions v
                            where v.creation_id = c.id and v.version = c.current_version and p_asset = any (v.media_asset_ids))));
$$;
grant execute on function public.public_asset_visible(uuid) to anon, authenticated;

-- Community images are always served through the app's /media route (which
-- applies the visibility rule above), never by direct bucket URL.
update storage.buckets set public = false where id = 'media-public';
