-- =============================================================================
-- simulate_batch: persists a planned batch of world progression (see
-- lib/simulation/plan.ts) in one transaction: new rows for rival shows, then
-- each WorldChanges step in order. The universe row is locked first and its
-- revision must match what the planner loaded, so two tabs (or a double tap)
-- can never apply the same simulation twice.
-- =============================================================================
create or replace function public.simulate_batch(
  p_universe uuid,
  p_expected_revision integer,
  p_rows jsonb,
  p_steps jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_universe record;
  v_step jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select id, revision into v_universe from public.universes where id = p_universe and owner_id = auth.uid() for update;
  if not found then
    raise exception 'UNIVERSE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_universe.revision <> p_expected_revision then
    raise exception 'UNIVERSE_CHANGED' using errcode = 'P0409';
  end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) > 200 then
    raise exception 'INVALID_BATCH' using errcode = '22023';
  end if;

  if p_rows is not null and p_rows <> '{}'::jsonb then
    perform public.import_universe_rows(null, p_universe, p_rows);
  end if;

  for v_step in select value from jsonb_array_elements(p_steps) loop
    v_result := public.apply_world_changes(p_universe, v_step);
  end loop;

  return v_result || jsonb_build_object('revision', (select revision from public.universes where id = p_universe));
end;
$$;
revoke execute on function public.simulate_batch(uuid, integer, jsonb, jsonb) from anon;
