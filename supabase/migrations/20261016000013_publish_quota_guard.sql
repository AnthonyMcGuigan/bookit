-- The owner-update guard runs with the caller's privileges, which can't
-- execute feature_limit(). It now calls a narrow security-definer check that
-- only answers for the caller's own account.
create or replace function public.at_publish_limit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and public.active_creation_count(auth.uid()) + 1 > public.feature_limit(auth.uid(), 'published_creations');
$$;
revoke execute on function public.at_publish_limit() from anon, public;
grant execute on function public.at_publish_limit() to authenticated;

revoke execute on function public.active_creation_count(uuid) from anon, authenticated, public;

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
    if new.visibility in ('published', 'unlisted') and old.visibility = 'draft' then
      if public.at_publish_limit() then
        raise exception 'PUBLISH_LIMIT_REACHED';
      end if;
    end if;
    if new.visibility = 'published' and old.visibility <> 'published' and old.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;
