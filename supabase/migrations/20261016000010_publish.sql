-- =============================================================================
-- Community publishing. Server code builds and validates the package and
-- copies images to the public bucket; this function performs every check that
-- must not be bypassed (ownership, restrictions, quota, remix permission,
-- moderation routing) and writes the creation and its new version atomically.
-- =============================================================================

create or replace function public.creation_needs_review(p_title text, p_summary text, p_description text, p_tags text[], p_has_media boolean)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg record;
  haystack text := lower(coalesce(p_title, '') || ' ' || coalesce(p_summary, '') || ' ' || coalesce(p_description, '') || ' ' || array_to_string(coalesce(p_tags, '{}'), ' '));
  term text;
begin
  select * into cfg from public.app_config where id;
  if cfg.community_moderation_mode = 'review' then
    return 'All publications are reviewed by moderators before they appear.';
  end if;
  if p_has_media and cfg.review_creations_with_images then
    return 'Creations with custom images are reviewed before they appear.';
  end if;
  foreach term in array coalesce(cfg.flagged_terms, '{}') loop
    if term <> '' and position(lower(term) in haystack) > 0 then
      return 'This text needs a quick moderator review before it appears.';
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.active_creation_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.community_creations
   where owner_id = p_user and visibility in ('published', 'unlisted') and moderation_state <> 'removed';
$$;

create or replace function public.publish_creation(
  p_creation uuid,
  p_category text,
  p_title text,
  p_summary text,
  p_description text,
  p_tags text[],
  p_visibility text,
  p_is_fan_content boolean,
  p_allow_derivatives boolean,
  p_source_creation uuid,
  p_source_version integer,
  p_lineage jsonb,
  p_package jsonb,
  p_package_bytes integer,
  p_schema_version integer,
  p_media uuid[],
  p_thumbnail uuid,
  p_changelog text,
  p_entity_counts jsonb)
returns table (creation_id uuid, version integer, moderation_state text, review_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c record;
  v_id uuid := p_creation;
  v_version integer;
  v_reason text;
  v_state text;
  v_limit bigint;
  v_media uuid[] := coalesce(p_media, '{}');
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if public.is_restricted(uid, 'suspended') or public.is_restricted(uid, 'publishing_disabled') then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;
  if p_visibility not in ('draft', 'published', 'unlisted') then raise exception 'INVALID_VISIBILITY'; end if;
  perform public.consume_rate_limit('publish_creation', 20, interval '1 hour');

  -- Every bundled image must be the publisher's own public copy.
  if p_thumbnail is not null then v_media := array_append(v_media, p_thumbnail); end if;
  if exists (
    select 1 from unnest(v_media) m(id)
     where not exists (select 1 from public.media_assets a
                        where a.id = m.id and a.owner_id = uid and a.bucket = 'media-public' and a.status = 'active')
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Remixes need the source to allow derivatives (creators may always remix their own work).
  if p_source_creation is not null and not exists (
    select 1 from public.community_creations s
     where s.id = p_source_creation
       and (s.owner_id = uid or (public.creation_is_public(s.id) and s.allow_derivatives))
  ) then
    raise exception 'REMIX_NOT_ALLOWED' using errcode = '42501';
  end if;

  v_reason := public.creation_needs_review(p_title, p_summary, p_description, p_tags, cardinality(v_media) > 0);

  if v_id is null then
    if p_visibility <> 'draft' then
      v_limit := public.feature_limit(uid, 'published_creations');
      if public.active_creation_count(uid) + 1 > v_limit then raise exception 'PUBLISH_LIMIT_REACHED'; end if;
    end if;
    v_state := case when v_reason is null then 'approved' else 'pending' end;
    insert into public.community_creations (
      owner_id, category, title, summary, description, tags, visibility, moderation_state,
      is_fan_content, allow_derivatives, source_creation_id, source_version, lineage,
      current_version, thumbnail_asset_id, published_at)
    values (
      uid, p_category, p_title, coalesce(p_summary, ''), coalesce(p_description, ''), coalesce(p_tags, '{}'),
      p_visibility, v_state, coalesce(p_is_fan_content, false), coalesce(p_allow_derivatives, true),
      p_source_creation, p_source_version, coalesce(p_lineage, '[]'::jsonb), 0, p_thumbnail,
      case when p_visibility = 'published' then now() end)
    returning id into v_id;
    v_version := 1;
  else
    select * into c from public.community_creations where id = v_id for update;
    if not found or c.owner_id <> uid then raise exception 'CREATION_NOT_FOUND' using errcode = 'P0002'; end if;
    if c.moderation_state = 'removed' then raise exception 'CREATION_REMOVED' using errcode = '42501'; end if;
    if c.category <> p_category then raise exception 'CATEGORY_MISMATCH'; end if;
    if p_visibility <> 'draft' and c.visibility = 'draft' then
      v_limit := public.feature_limit(uid, 'published_creations');
      if public.active_creation_count(uid) + 1 > v_limit then raise exception 'PUBLISH_LIMIT_REACHED'; end if;
    end if;
    -- A new version of hidden or rejected content goes back to review; approved
    -- content stays approved unless the new version itself needs review.
    v_state := case
      when c.moderation_state in ('hidden', 'rejected', 'pending') then 'pending'
      when v_reason is not null then 'pending'
      else 'approved' end;
    if v_state = 'pending' and v_reason is null then v_reason := 'Updated content is waiting for moderator review.'; end if;
    v_version := c.current_version + 1;
    update public.community_creations
       set title = p_title, summary = coalesce(p_summary, ''), description = coalesce(p_description, ''),
           tags = coalesce(p_tags, '{}'), visibility = p_visibility, moderation_state = v_state,
           moderation_reason = case when v_state = 'pending' then v_reason else moderation_reason end,
           is_fan_content = coalesce(p_is_fan_content, false), allow_derivatives = coalesce(p_allow_derivatives, true),
           thumbnail_asset_id = coalesce(p_thumbnail, thumbnail_asset_id),
           published_at = case when p_visibility = 'published' and published_at is null then now() else published_at end
     where id = v_id;
  end if;

  insert into public.creation_versions (creation_id, version, package_schema_version, package, package_bytes, media_asset_ids, changelog, entity_counts)
  values (v_id, v_version, p_schema_version, p_package, p_package_bytes, coalesce(p_media, '{}'), left(coalesce(p_changelog, ''), 1000), coalesce(p_entity_counts, '{}'::jsonb));
  update public.community_creations set current_version = v_version where id = v_id;

  if v_state = 'pending' then
    update public.community_creations set moderation_reason = v_reason where id = v_id;
    insert into public.moderation_actions (moderator_id, action, creation_id, reason, metadata)
    values (null, 'auto_review', v_id, v_reason, jsonb_build_object('version', v_version));
  end if;

  return query select v_id, v_version, v_state, v_reason;
end;
$$;
revoke execute on function public.publish_creation(uuid, text, text, text, text, text[], text, boolean, boolean, uuid, integer, jsonb, jsonb, integer, integer, uuid[], uuid, text, jsonb) from anon, public;
grant execute on function public.publish_creation(uuid, text, text, text, text, text[], text, boolean, boolean, uuid, integer, jsonb, jsonb, integer, integer, uuid[], uuid, text, jsonb) to authenticated;

-- Owners switching a draft to published/unlisted directly must respect the quota too.
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
    if new.visibility in ('published', 'unlisted') and old.visibility = 'draft'
       and public.active_creation_count(old.owner_id) + 1 > public.feature_limit(old.owner_id, 'published_creations') then
      raise exception 'PUBLISH_LIMIT_REACHED';
    end if;
    if new.visibility = 'published' and old.visibility <> 'published' and old.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Owners delete their own creations; returns the public media to clean up.
create or replace function public.delete_creation(p_creation uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_media uuid[];
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if not exists (select 1 from public.community_creations where id = p_creation and owner_id = uid) then
    raise exception 'CREATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Removed creations stay for the audit trail and appeals.
  if exists (select 1 from public.community_creations where id = p_creation and moderation_state = 'removed') then
    raise exception 'CREATION_REMOVED' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct m), '{}') into v_media
    from (select unnest(media_asset_ids) m from public.creation_versions where creation_id = p_creation
          union select thumbnail_asset_id from public.community_creations where id = p_creation and thumbnail_asset_id is not null) s;
  delete from public.community_creations where id = p_creation;
  return v_media;
end;
$$;
revoke execute on function public.delete_creation(uuid) from anon, public;
grant execute on function public.delete_creation(uuid) to authenticated;
