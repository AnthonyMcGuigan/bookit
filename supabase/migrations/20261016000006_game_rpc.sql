-- =============================================================================
-- Atomic game-state RPCs. All run as SECURITY INVOKER so row-level security
-- applies; ownership is additionally verified up front.
-- =============================================================================

-- Applies a WorldChanges payload (see lib/simulation/changes.ts) in a single
-- transaction. When the payload contains a show, the show row is locked and
-- must still be unsimulated with the expected version; otherwise the whole
-- call fails and nothing is written (exactly-once results).
create or replace function public.apply_world_changes(p_universe uuid, p_changes jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_show jsonb := p_changes -> 'show';
  v_show_row record;
  v_universe record;
  v_date date := nullif(p_changes ->> 'gameDate', '')::date;
  r jsonb;
  holder text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select * into v_universe from public.universes where id = p_universe and owner_id = auth.uid() for update;
  if not found then
    raise exception 'UNIVERSE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Show (exactly once).
  if v_show is not null and jsonb_typeof(v_show) = 'object' then
    select * into v_show_row from public.shows
     where id = (v_show ->> 'id')::uuid and universe_id = p_universe
     for update;
    if not found then raise exception 'SHOW_NOT_FOUND' using errcode = 'P0002'; end if;
    if v_show_row.status = 'completed' then
      raise exception 'SHOW_ALREADY_SIMULATED' using errcode = 'P0409';
    end if;
    if v_show_row.version <> (v_show ->> 'expectedVersion')::integer then
      raise exception 'SHOW_VERSION_CONFLICT' using errcode = 'P0409';
    end if;
    update public.shows
       set status = 'completed',
           rating = (v_show ->> 'rating')::numeric,
           rating_breakdown = v_show -> 'ratingBreakdown',
           attendance = (v_show ->> 'attendance')::integer,
           sim_seed = v_show ->> 'simSeed',
           simulated_at = now(),
           version = version + 1
     where id = v_show_row.id;
  end if;

  -- Segment results and participant outcomes.
  insert into public.segment_results
    (segment_id, universe_id, show_id, quality, star_rating, crowd_reaction, duration_min, winner_side, finish, title_changed, recap, details)
  select x.segment_id, p_universe, x.show_id, x.quality, x.star_rating, x.crowd_reaction, x.duration_min, x.winner_side, x.finish,
         x.title_changed, x.recap, x.details
    from jsonb_to_recordset(coalesce(p_changes -> 'segmentResults', '[]'))
      as x(segment_id uuid, show_id uuid, quality integer, star_rating numeric, crowd_reaction text, duration_min integer,
           winner_side integer, finish text, title_changed boolean, recap text, details jsonb);

  update public.segment_participants sp
     set outcome = x.outcome
    from jsonb_to_recordset(coalesce(p_changes -> 'participantOutcomes', '[]')) as x(segment_id uuid, wrestler_id uuid, outcome text)
   where sp.universe_id = p_universe and sp.segment_id = x.segment_id and sp.wrestler_id = x.wrestler_id;

  -- Wrestler deltas (clamped to their ranges).
  update public.wrestlers w
     set popularity = least(100, greatest(0, w.popularity + x.popularity)),
         momentum   = least(100, greatest(-100, w.momentum + x.momentum)),
         morale     = least(100, greatest(0, w.morale + x.morale)),
         fatigue    = least(100, greatest(0, w.fatigue + x.fatigue)),
         reputation = least(100, greatest(0, w.reputation + x.reputation)),
         in_ring     = least(100, greatest(0, w.in_ring     + coalesce((x.attributes ->> 'in_ring')::integer, 0))),
         technical   = least(100, greatest(0, w.technical   + coalesce((x.attributes ->> 'technical')::integer, 0))),
         power       = least(100, greatest(0, w.power       + coalesce((x.attributes ->> 'power')::integer, 0))),
         speed       = least(100, greatest(0, w.speed       + coalesce((x.attributes ->> 'speed')::integer, 0))),
         stamina     = least(100, greatest(0, w.stamina     + coalesce((x.attributes ->> 'stamina')::integer, 0))),
         charisma    = least(100, greatest(0, w.charisma    + coalesce((x.attributes ->> 'charisma')::integer, 0))),
         mic_skills  = least(100, greatest(0, w.mic_skills  + coalesce((x.attributes ->> 'mic_skills')::integer, 0))),
         selling     = least(100, greatest(0, w.selling     + coalesce((x.attributes ->> 'selling')::integer, 0))),
         psychology  = least(100, greatest(0, w.psychology  + coalesce((x.attributes ->> 'psychology')::integer, 0))),
         reliability = least(100, greatest(0, w.reliability + coalesce((x.attributes ->> 'reliability')::integer, 0))),
         big_match   = least(100, greatest(0, w.big_match   + coalesce((x.attributes ->> 'big_match')::integer, 0)))
    from jsonb_to_recordset(coalesce(p_changes -> 'wrestlerDeltas', '[]'))
      as x(wrestler_id uuid, popularity integer, momentum integer, morale integer, fatigue integer, reputation integer, attributes jsonb)
   where w.universe_id = p_universe and w.id = x.wrestler_id;

  update public.wrestlers w
     set career_status = x.career_status
    from jsonb_to_recordset(coalesce(p_changes -> 'wrestlerStatus', '[]')) as x(wrestler_id uuid, career_status text)
   where w.universe_id = p_universe and w.id = x.wrestler_id;

  -- Injuries.
  insert into public.injuries (id, universe_id, wrestler_id, description, severity, started_on, expected_return_on, segment_id, is_storyline)
  select x.id, p_universe, x.wrestler_id, x.description, x.severity, x.started_on, x.expected_return_on, x.segment_id, x.is_storyline
    from jsonb_to_recordset(coalesce(p_changes -> 'injuriesNew', '[]'))
      as x(id uuid, wrestler_id uuid, description text, severity text, started_on date, expected_return_on date, segment_id uuid, is_storyline boolean);

  update public.injuries i
     set healed_on = x.healed_on
    from jsonb_to_recordset(coalesce(p_changes -> 'injuriesHealed', '[]')) as x(id uuid, healed_on date)
   where i.universe_id = p_universe and i.id = x.id and i.healed_on is null;

  -- Championships: end reigns before starting new ones.
  update public.title_reigns t
     set ended_on = x.ended_on, end_reason = x.end_reason, lost_segment_id = x.lost_segment_id
    from jsonb_to_recordset(coalesce(p_changes -> 'reignsEnded', '[]'))
      as x(id uuid, ended_on date, end_reason text, lost_segment_id uuid)
   where t.universe_id = p_universe and t.id = x.id and t.ended_on is null;

  for r in select * from jsonb_array_elements(coalesce(p_changes -> 'reignsNew', '[]')) loop
    insert into public.title_reigns (id, universe_id, championship_id, team_id, started_on, won_segment_id)
    values ((r ->> 'id')::uuid, p_universe, (r ->> 'championship_id')::uuid, nullif(r ->> 'team_id', '')::uuid,
            (r ->> 'started_on')::date, nullif(r ->> 'won_segment_id', '')::uuid);
    for holder in select jsonb_array_elements_text(r -> 'holder_ids') loop
      insert into public.title_reign_holders (universe_id, reign_id, wrestler_id)
      values (p_universe, (r ->> 'id')::uuid, holder::uuid);
    end loop;
  end loop;

  update public.title_reigns t
     set defenses = t.defenses + x.count
    from jsonb_to_recordset(coalesce(p_changes -> 'reignDefenses', '[]')) as x(id uuid, count integer)
   where t.universe_id = p_universe and t.id = x.id;

  update public.championships c
     set prestige = least(100, greatest(0, c.prestige + x.delta))
    from (select id, sum(delta)::integer delta
            from jsonb_to_recordset(coalesce(p_changes -> 'championshipPrestige', '[]')) as y(id uuid, delta integer)
           group by id) x
   where c.universe_id = p_universe and c.id = x.id;

  -- Storylines.
  update public.storylines s
     set intensity = least(100, greatest(0, s.intensity + x.intensity_delta)),
         status = coalesce(x.status, s.status),
         resolved_on = coalesce(x.resolved_on, s.resolved_on)
    from jsonb_to_recordset(coalesce(p_changes -> 'storylineUpdates', '[]'))
      as x(id uuid, intensity_delta integer, status text, resolved_on date)
   where s.universe_id = p_universe and s.id = x.id;

  insert into public.storyline_developments (id, universe_id, storyline_id, occurred_on, show_id, segment_id, kind, summary, intensity_delta)
  select x.id, p_universe, x.storyline_id, x.occurred_on, x.show_id, x.segment_id, x.kind, x.summary, x.intensity_delta
    from jsonb_to_recordset(coalesce(p_changes -> 'storylineDevelopments', '[]'))
      as x(id uuid, storyline_id uuid, occurred_on date, show_id uuid, segment_id uuid, kind text, summary text, intensity_delta integer);

  -- Rivalries (upsert on the active pair).
  insert into public.rivalries as rv (id, universe_id, wrestler_a, wrestler_b, intensity, matches, started_on, last_interaction_on, storyline_id)
  select x.id, p_universe, x.wrestler_a, x.wrestler_b, least(100, greatest(0, x.intensity_delta)), 1, x.occurred_on, x.occurred_on, x.storyline_id
    from jsonb_to_recordset(coalesce(p_changes -> 'rivalries', '[]'))
      as x(id uuid, wrestler_a uuid, wrestler_b uuid, intensity_delta integer, occurred_on date, storyline_id uuid)
  on conflict (universe_id, wrestler_a, wrestler_b) where ended_on is null
  do update set intensity = least(100, greatest(0, rv.intensity + excluded.intensity)),
                matches = rv.matches + 1,
                last_interaction_on = excluded.last_interaction_on,
                storyline_id = coalesce(rv.storyline_id, excluded.storyline_id);

  update public.rivalries rv
     set ended_on = x.ended_on
    from jsonb_to_recordset(coalesce(p_changes -> 'rivalriesEnded', '[]')) as x(id uuid, ended_on date)
   where rv.universe_id = p_universe and rv.id = x.id;

  -- Chemistry (upsert).
  insert into public.chemistry as ch (universe_id, wrestler_a, wrestler_b, partner_score, opponent_score, matches_together, matches_against)
  select p_universe, x.wrestler_a, x.wrestler_b,
         least(100, greatest(-100, x.partner_delta)), least(100, greatest(-100, x.opponent_delta)), x.together, x.against
    from jsonb_to_recordset(coalesce(p_changes -> 'chemistry', '[]'))
      as x(wrestler_a uuid, wrestler_b uuid, partner_delta integer, opponent_delta integer, together integer, against integer)
  on conflict (universe_id, wrestler_a, wrestler_b)
  do update set partner_score = least(100, greatest(-100, ch.partner_score + excluded.partner_score)),
                opponent_score = least(100, greatest(-100, ch.opponent_score + excluded.opponent_score)),
                matches_together = ch.matches_together + excluded.matches_together,
                matches_against = ch.matches_against + excluded.matches_against,
                updated_at = now();

  -- Contracts and rosters.
  update public.contracts c set status = 'expired'
   where c.universe_id = p_universe and c.status = 'active'
     and c.id in (select e::uuid from jsonb_array_elements_text(coalesce(p_changes -> 'contractsExpired', '[]')) e);

  update public.roster_memberships m
     set ended_on = x.ended_on, end_reason = x.end_reason
    from jsonb_to_recordset(coalesce(p_changes -> 'membershipsEnded', '[]')) as x(id uuid, ended_on date, end_reason text)
   where m.universe_id = p_universe and m.id = x.id and m.ended_on is null;

  insert into public.roster_memberships (id, universe_id, wrestler_id, promotion_id, started_on)
  select x.membership_id, p_universe, x.wrestler_id, x.promotion_id, x.started_on
    from jsonb_to_recordset(coalesce(p_changes -> 'signings', '[]'))
      as x(membership_id uuid, wrestler_id uuid, promotion_id uuid, started_on date);
  insert into public.contracts (id, universe_id, wrestler_id, promotion_id, starts_on, ends_on, weekly_salary)
  select x.contract_id, p_universe, x.wrestler_id, x.promotion_id, x.started_on, x.ends_on, x.weekly_salary
    from jsonb_to_recordset(coalesce(p_changes -> 'signings', '[]'))
      as x(contract_id uuid, wrestler_id uuid, promotion_id uuid, started_on date, ends_on date, weekly_salary integer);

  -- Timeline and ledger.
  insert into public.timeline_events (id, universe_id, promotion_id, occurred_on, kind, title, summary, wrestler_ids, show_id, segment_id, championship_id, importance)
  select x.id, p_universe, x.promotion_id, x.occurred_on, x.kind, left(x.title, 200), left(coalesce(x.summary, ''), 2000),
         coalesce(x.wrestler_ids, '{}'), x.show_id, x.segment_id, x.championship_id, x.importance
    from jsonb_to_recordset(coalesce(p_changes -> 'timelineEvents', '[]'))
      as x(id uuid, promotion_id uuid, occurred_on date, kind text, title text, summary text, wrestler_ids uuid[],
           show_id uuid, segment_id uuid, championship_id uuid, importance integer);

  insert into public.financial_transactions (id, universe_id, promotion_id, occurred_on, category, amount, show_id, description)
  select x.id, p_universe, x.promotion_id, x.occurred_on, x.category, x.amount, x.show_id, left(coalesce(x.description, ''), 300)
    from jsonb_to_recordset(coalesce(p_changes -> 'transactions', '[]'))
      as x(id uuid, promotion_id uuid, occurred_on date, category text, amount bigint, show_id uuid, description text);

  update public.promotions p
     set popularity = least(100, greatest(0, p.popularity + x.popularity)),
         reputation = least(100, greatest(0, p.reputation + x.reputation)),
         cash_balance = p.cash_balance + x.cash
    from (select id, sum(popularity)::integer popularity, sum(reputation)::integer reputation, sum(cash)::bigint cash
            from jsonb_to_recordset(coalesce(p_changes -> 'promotionDeltas', '[]'))
              as y(id uuid, popularity integer, reputation integer, cash bigint)
           group by id) x
   where p.universe_id = p_universe and p.id = x.id;

  update public.tournaments t
     set round_winners = x.round_winners, status = x.status, winner_wrestler_id = x.winner_wrestler_id
    from jsonb_to_recordset(coalesce(p_changes -> 'tournaments', '[]'))
      as x(id uuid, round_winners jsonb, status text, winner_wrestler_id uuid)
   where t.universe_id = p_universe and t.id = x.id;

  update public.universes
     set game_date = greatest(game_date, coalesce(v_date, game_date)),
         revision = revision + 1,
         last_played_at = now()
   where id = p_universe;

  return jsonb_build_object('revision', v_universe.revision + 1,
                            'game_date', greatest(v_universe.game_date, coalesce(v_date, v_universe.game_date)));
end;
$$;
revoke execute on function public.apply_world_changes(uuid, jsonb) from anon;

-- Bulk insert of universe rows in dependency order, used by the importer and
-- the starter universe. Optionally creates the universe in the same
-- transaction. Rows are complete (ids already remapped by the server).
create or replace function public.import_universe_rows(p_universe jsonb, p_universe_id uuid, p_rows jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_universe_id uuid := p_universe_id;
  t text;
  tables text[] := array[
    'promotions', 'venues', 'wrestlers', 'roster_memberships', 'contracts', 'teams', 'team_memberships',
    'chemistry', 'championships', 'shows', 'tournaments', 'storylines', 'storyline_participants',
    'segments', 'segment_participants', 'segment_results', 'injuries', 'title_reigns', 'title_reign_holders',
    'rivalries', 'storyline_developments', 'business_deals', 'financial_transactions', 'timeline_events'];
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_universe is not null then
    insert into public.universes (id, owner_id, name, description, origin, source_creation_id, source_version, attribution,
                                  start_date, game_date, settings, schema_version, idempotency_key)
    values ((p_universe ->> 'id')::uuid, auth.uid(), p_universe ->> 'name', coalesce(p_universe ->> 'description', ''),
            p_universe ->> 'origin', nullif(p_universe ->> 'source_creation_id', '')::uuid,
            nullif(p_universe ->> 'source_version', '')::integer, coalesce(p_universe -> 'attribution', '[]'),
            (p_universe ->> 'start_date')::date, (p_universe ->> 'game_date')::date,
            coalesce(p_universe -> 'settings', '{}'), coalesce((p_universe ->> 'schema_version')::integer, 1),
            nullif(p_universe ->> 'idempotency_key', '')::uuid)
    returning id into v_universe_id;
  elsif not public.owns_universe(v_universe_id) then
    raise exception 'UNIVERSE_NOT_FOUND' using errcode = 'P0002';
  end if;

  foreach t in array tables loop
    if p_rows ? t and jsonb_array_length(p_rows -> t) > 0 then
      -- Force the universe id on every row; never trust it from the payload.
      execute format(
        'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, '
        '(select jsonb_agg(e || jsonb_build_object(''universe_id'', $2)) from jsonb_array_elements($1) e))', t)
      using p_rows -> t, v_universe_id;
    end if;
  end loop;

  update public.universes set revision = revision + 1 where id = v_universe_id;
  return v_universe_id;
end;
$$;
revoke execute on function public.import_universe_rows(jsonb, uuid, jsonb) from anon;
