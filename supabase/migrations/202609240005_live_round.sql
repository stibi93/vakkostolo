begin;

-- join_game inserts only after locking the game. Transaction-start time could
-- incorrectly admit a join that waited behind start_round's game lock.
alter table public.participants alter column joined_at set default clock_timestamp();

create table private.round_start_requests (
  game_id uuid not null references public.games(id) on delete cascade,
  request_id uuid not null,
  expected_version integer not null,
  round_id uuid not null,
  primary key (game_id, request_id),
  foreign key (game_id, round_id) references public.rounds(game_id, id) on delete cascade
);
revoke all on private.round_start_requests from public, anon, authenticated;

-- First live slice: starts the first round from the lobby only. Later lifecycle
-- commands will handle close/next/reveal; retries must never reset a deadline.
create function public.start_round(p_game_id uuid, p_expected_version integer, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_host uuid := private.require_permanent_user();
  v_game public.games;
  v_round public.rounds;
  v_request private.round_start_requests;
  v_now timestamptz;
begin
  select * into v_game from public.games where id = p_game_id and host_id = v_host for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if p_request_id is null or p_expected_version is null or p_expected_version < 0 then
    raise exception 'INVALID_START_REQUEST';
  end if;
  select * into v_request from private.round_start_requests where game_id = p_game_id and request_id = p_request_id;
  if found then
    if v_request.expected_version <> p_expected_version then raise exception 'REQUEST_ID_CONFLICT'; end if;
    return v_request.round_id;
  end if;
  if exists (select 1 from public.game_events where game_id = p_game_id and request_id = p_request_id) then
    raise exception 'REQUEST_ID_CONFLICT';
  end if;
  if v_game.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_game.status <> 'lobby' then raise exception 'GAME_NOT_IN_LOBBY'; end if;
  if exists (select 1 from public.rounds where game_id = p_game_id and status <> 'pending') then
    raise exception 'ROUND_ALREADY_STARTED';
  end if;
  if not exists (select 1 from public.rounds where game_id = p_game_id) or exists (
    select 1 from public.rounds r where r.game_id = p_game_id
      and not exists (select 1 from public.wine_secrets w where w.round_id = r.id)
  ) then raise exception 'WINES_INCOMPLETE'; end if;
  select * into v_round from public.rounds where game_id = p_game_id order by position limit 1 for update;
  v_now := clock_timestamp();
  update public.rounds set status = 'open', opened_at = v_now,
    closes_at = v_now + make_interval(secs => v_game.round_seconds) where id = v_round.id;
  update public.games set status = 'tasting', version = version + 1 where id = p_game_id;
  insert into private.round_start_requests values (p_game_id, p_request_id, p_expected_version, v_round.id);
  insert into public.game_events(game_id, actor_id, request_id, event_type)
    values (p_game_id, v_host, p_request_id, 'round_started');
  return v_round.id;
end;
$$;
revoke all on function public.start_round(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.start_round(uuid, integer, uuid) to authenticated;

-- Same permission boundary as the lobby. Only your own rating is included, never
-- another player's answer, a wine identity, image, price, alcohol or score.
create function public.get_game_snapshot(p_game_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.get_lobby_snapshot(p_game_id) || jsonb_build_object(
    'round', (select jsonb_build_object('id', r.id, 'position', r.position, 'status', r.status,
      'opened_at', r.opened_at, 'closes_at', r.closes_at,
      'eligible', exists(select 1 from public.participants p where p.game_id = p_game_id
        and p.user_id = auth.uid() and p.joined_at <= r.opened_at),
      'can_submit', r.status = 'open' and r.closes_at > statement_timestamp()
        and exists(select 1 from public.games g where g.id = p_game_id and g.status = 'tasting')
        and exists(select 1 from public.participants p where p.game_id = p_game_id
          and p.user_id = auth.uid() and p.joined_at <= r.opened_at))
      from public.rounds r where r.game_id = p_game_id and r.status <> 'pending'
      order by r.position desc limit 1),
    'own_rating', (select jsonb_build_object('round_id', a.round_id, 'price_huf', a.price_huf,
      'alcohol_tenths', a.alcohol_tenths, 'liking', a.liking, 'submitted_at', a.submitted_at)
      from public.ratings a join public.participants p on p.id = a.participant_id
      where a.game_id = p_game_id and p.user_id = auth.uid()
        and a.round_id = (select id from public.rounds where game_id = p_game_id and status <> 'pending'
          order by position desc limit 1))
  );
$$;
revoke all on function public.get_game_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.get_game_snapshot(uuid) to authenticated;

create or replace function public.submit_rating(
  p_round_id uuid, p_price_huf integer, p_alcohol_tenths integer, p_liking integer
) returns public.ratings
language plpgsql security definer set search_path = '' as $$
declare
  v_game_id uuid;
  v_game_status text;
  v_participant public.participants;
  v_round public.rounds;
  v_result public.ratings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select game_id into v_game_id from public.rounds where id = p_round_id;
  if not found then raise exception 'ROUND_NOT_FOUND'; end if;
  -- Check membership before locking to avoid an outsider blocking host commands.
  if not exists (select 1 from public.participants where game_id = v_game_id and user_id = auth.uid()) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  select status into v_game_status from public.games where id = v_game_id for update;
  select * into v_round from public.rounds where id = p_round_id for update;
  select * into v_participant from public.participants where game_id = v_game_id and user_id = auth.uid();
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_game_status <> 'tasting' or v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;
  if v_round.closes_at is null or clock_timestamp() >= v_round.closes_at then raise exception 'DEADLINE_PASSED'; end if;
  if v_participant.joined_at > v_round.opened_at then raise exception 'ROUND_NOT_ELIGIBLE'; end if;
  insert into public.ratings (game_id, round_id, participant_id, price_huf, alcohol_tenths, liking)
    values (v_game_id, p_round_id, v_participant.id, p_price_huf, p_alcohol_tenths, p_liking)
    on conflict (round_id, participant_id) do update set price_huf = excluded.price_huf,
      alcohol_tenths = excluded.alcohol_tenths, liking = excluded.liking, submitted_at = clock_timestamp()
    returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.submit_rating(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.submit_rating(uuid, integer, integer, integer) to authenticated;

-- The existing SELECT RLS protects these public timing fields too. Never publish ratings.
alter publication supabase_realtime add table public.rounds;
commit;
