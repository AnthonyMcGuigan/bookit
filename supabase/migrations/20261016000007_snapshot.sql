-- =============================================================================
-- Universe snapshot loader. Returns the whole private state of a universe as
-- one JSON document (keys match UniverseState in lib/domain/entities.ts).
-- SECURITY INVOKER: row-level security limits it to the owner's rows.
--
-- p_history_from limits high-volume history tables (segments, results,
-- timeline, ledger, storyline developments) to recent rows plus anything not
-- yet completed, which keeps simulation loads fast for long-running saves.
-- =============================================================================
create or replace function public.get_universe_snapshot(
  p_universe uuid,
  p_history_from date default null,
  p_collections text[] default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  result jsonb;
  want_all boolean := p_collections is null;
begin
  select to_jsonb(u) into result from public.universes u where u.id = p_universe;
  if result is null then
    return null;
  end if;

  return jsonb_build_object(
    'universe', result,
    'promotions', case when want_all or 'promotions' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at, t.name) from public.promotions t where t.universe_id = p_universe), '[]') else '[]' end,
    'venues', case when want_all or 'venues' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from public.venues t where t.universe_id = p_universe), '[]') else '[]' end,
    'wrestlers', case when want_all or 'wrestlers' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.ring_name) from public.wrestlers t where t.universe_id = p_universe), '[]') else '[]' end,
    'rosterMemberships', case when want_all or 'rosterMemberships' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.roster_memberships t where t.universe_id = p_universe), '[]') else '[]' end,
    'contracts', case when want_all or 'contracts' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.contracts t where t.universe_id = p_universe), '[]') else '[]' end,
    'injuries', case when want_all or 'injuries' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.started_on) from public.injuries t where t.universe_id = p_universe), '[]') else '[]' end,
    'teams', case when want_all or 'teams' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from public.teams t where t.universe_id = p_universe), '[]') else '[]' end,
    'teamMemberships', case when want_all or 'teamMemberships' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.team_memberships t where t.universe_id = p_universe), '[]') else '[]' end,
    'chemistry', case when want_all or 'chemistry' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.chemistry t where t.universe_id = p_universe), '[]') else '[]' end,
    'championships', case when want_all or 'championships' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.name) from public.championships t where t.universe_id = p_universe), '[]') else '[]' end,
    'titleReigns', case when want_all or 'titleReigns' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.started_on) from public.title_reigns t where t.universe_id = p_universe), '[]') else '[]' end,
    'titleReignHolders', case when want_all or 'titleReignHolders' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.title_reign_holders t where t.universe_id = p_universe), '[]') else '[]' end,
    'shows', case when want_all or 'shows' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.show_date, t.created_at) from public.shows t where t.universe_id = p_universe), '[]') else '[]' end,
    'tournaments', case when want_all or 'tournaments' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.tournaments t where t.universe_id = p_universe), '[]') else '[]' end,
    'segments', case when want_all or 'segments' = any(p_collections) then coalesce((
      select jsonb_agg(to_jsonb(t) order by t.position) from public.segments t
       where t.universe_id = p_universe
         and (p_history_from is null or t.show_id in (
              select s.id from public.shows s where s.universe_id = p_universe and (s.show_date >= p_history_from or s.status <> 'completed')))), '[]') else '[]' end,
    'segmentParticipants', case when want_all or 'segmentParticipants' = any(p_collections) then coalesce((
      select jsonb_agg(to_jsonb(t)) from public.segment_participants t
       where t.universe_id = p_universe
         and (p_history_from is null or t.segment_id in (
              select g.id from public.segments g join public.shows s on s.id = g.show_id
               where g.universe_id = p_universe and (s.show_date >= p_history_from or s.status <> 'completed')))), '[]') else '[]' end,
    'segmentResults', case when want_all or 'segmentResults' = any(p_collections) then coalesce((
      select jsonb_agg(to_jsonb(t)) from public.segment_results t
       where t.universe_id = p_universe
         and (p_history_from is null or t.show_id in (
              select s.id from public.shows s where s.universe_id = p_universe and s.show_date >= p_history_from))), '[]') else '[]' end,
    'storylines', case when want_all or 'storylines' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t) order by t.started_on) from public.storylines t where t.universe_id = p_universe), '[]') else '[]' end,
    'storylineParticipants', case when want_all or 'storylineParticipants' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.storyline_participants t where t.universe_id = p_universe), '[]') else '[]' end,
    'storylineDevelopments', case when want_all or 'storylineDevelopments' = any(p_collections) then coalesce((
      select jsonb_agg(to_jsonb(t) order by t.occurred_on) from public.storyline_developments t
       where t.universe_id = p_universe and (p_history_from is null or t.occurred_on >= p_history_from)), '[]') else '[]' end,
    'rivalries', case when want_all or 'rivalries' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.rivalries t where t.universe_id = p_universe), '[]') else '[]' end,
    'businessDeals', case when want_all or 'businessDeals' = any(p_collections) then coalesce((select jsonb_agg(to_jsonb(t)) from public.business_deals t where t.universe_id = p_universe), '[]') else '[]' end,
    'financialTransactions', case when want_all or 'financialTransactions' = any(p_collections) then coalesce((
      select jsonb_agg(to_jsonb(t) order by t.occurred_on, t.created_at) from public.financial_transactions t
       where t.universe_id = p_universe and (p_history_from is null or t.occurred_on >= p_history_from)), '[]') else '[]' end,
    'timelineEvents', case when want_all or 'timelineEvents' = any(p_collections) then coalesce((
      select jsonb_agg(to_jsonb(t) order by t.occurred_on, t.created_at) from public.timeline_events t
       where t.universe_id = p_universe and (p_history_from is null or t.occurred_on >= p_history_from)), '[]') else '[]' end
  );
end;
$$;
revoke execute on function public.get_universe_snapshot(uuid, date, text[]) from anon;

-- Career records per wrestler (wins/losses/draws), computed from all history.
create or replace function public.wrestler_records(p_universe uuid)
returns table (wrestler_id uuid, wins bigint, losses bigint, draws bigint, matches bigint)
language sql
stable
set search_path = ''
as $$
  select sp.wrestler_id,
         count(*) filter (where sp.outcome = 'win'),
         count(*) filter (where sp.outcome = 'loss'),
         count(*) filter (where sp.outcome in ('draw', 'no_contest')),
         count(*) filter (where sp.outcome is not null)
    from public.segment_participants sp
    join public.segments g on g.id = sp.segment_id
   where sp.universe_id = p_universe and g.kind = 'match' and sp.role = 'competitor'
   group by sp.wrestler_id;
$$;
revoke execute on function public.wrestler_records(uuid) from anon;
