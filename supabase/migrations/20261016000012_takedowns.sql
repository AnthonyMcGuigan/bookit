-- IP takedown requests can be filed by anyone (rights holders may not have
-- accounts). Requests are throttled per claimant email, recorded in the audit
-- log, and a named creation is hidden pending review (conservative policy).
create or replace function public.submit_takedown(
  p_claimant_name text,
  p_claimant_email text,
  p_claimant_organization text,
  p_relationship text,
  p_work_description text,
  p_creation uuid,
  p_infringing_url text,
  p_good_faith boolean,
  p_accuracy boolean,
  p_signature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  recent integer;
begin
  select count(*) into recent from public.ip_takedown_requests
   where lower(claimant_email) = lower(p_claimant_email) and created_at > now() - interval '1 day';
  if recent >= 5 then
    raise exception 'RATE_LIMITED: takedown (limit 5 per day)' using errcode = 'P0429';
  end if;
  select count(*) into recent from public.ip_takedown_requests where created_at > now() - interval '1 hour';
  if recent >= 100 then
    raise exception 'RATE_LIMITED: takedown (service busy)' using errcode = 'P0429';
  end if;
  if p_creation is not null and not exists (select 1 from public.community_creations where id = p_creation) then
    p_creation := null;
  end if;

  insert into public.ip_takedown_requests (
    submitted_by, claimant_name, claimant_email, claimant_organization, rights_holder_relationship,
    work_description, creation_id, infringing_url, good_faith_statement, accuracy_statement, signature)
  values (
    auth.uid(), p_claimant_name, p_claimant_email, coalesce(p_claimant_organization, ''), p_relationship,
    p_work_description, p_creation, p_infringing_url, p_good_faith, p_accuracy, p_signature)
  returning id into rid;

  insert into public.moderation_actions (moderator_id, action, creation_id, reason, metadata)
  values (null, 'takedown_received', p_creation, 'IP takedown request received.', jsonb_build_object('request_id', rid));

  if p_creation is not null then
    update public.community_creations
       set moderation_state = 'hidden',
           moderation_reason = 'Hidden pending review of an intellectual-property takedown request.'
     where id = p_creation and moderation_state in ('approved', 'pending');
    if found then
      insert into public.moderation_actions (moderator_id, action, creation_id, reason, metadata)
      values (null, 'auto_hide', p_creation, 'Hidden pending review of an IP takedown request.', jsonb_build_object('request_id', rid));
    end if;
  end if;
  return rid;
end;
$$;
grant execute on function public.submit_takedown(text, text, text, text, text, uuid, text, boolean, boolean, text) to anon, authenticated;
