-- Self-service entitlement summary for the signed-in user. Internal helpers
-- (effective_plan, feature_limit, media_bytes_used) are not callable by clients
-- directly so users cannot probe other accounts.
create or replace function public.my_entitlements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan', public.effective_plan(auth.uid()),
    'limits', coalesce((select jsonb_object_agg(l.feature, l.limit_value)
                          from public.plan_limits l where l.plan = public.effective_plan(auth.uid())), '{}'),
    'usage', jsonb_build_object(
      'universe_slots', (select count(*) from public.universes where owner_id = auth.uid()),
      'media_storage_bytes', public.media_bytes_used(auth.uid()),
      'published_creations', (select count(*) from public.community_creations
                               where owner_id = auth.uid() and moderation_state <> 'removed' and visibility <> 'draft')),
    'entitlements', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'plan', e.plan, 'source', e.source, 'status', e.status,
        'starts_at', e.starts_at, 'expires_at', e.expires_at, 'auto_renews', e.auto_renews,
        'honoured', (e.source <> 'development' or (select c.dev_entitlements_enabled from public.app_config c where c.id)))
        order by e.created_at desc)
      from public.entitlements e where e.user_id = auth.uid()), '[]'),
    'dev_entitlements_enabled', (select c.dev_entitlements_enabled from public.app_config c where c.id)
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.my_entitlements() from anon;

revoke execute on function public.effective_plan(uuid) from anon, authenticated, public;
revoke execute on function public.feature_limit(uuid, text) from anon, authenticated, public;
revoke execute on function public.media_bytes_used(uuid) from anon, authenticated, public;
revoke execute on function public.is_restricted(uuid, text) from anon, authenticated, public;
