begin;

-- Players guess a price range (1–8) instead of an exact price. Bucket upper bounds are
-- inclusive: ≤1000, ≤2000, ≤3000, ≤4000, ≤6000, ≤8000, ≤10000, above. Kept in sync with
-- `priceBuckets` in src/domain/game.ts. The host still stores the exact price in wine_secrets.
create function private.price_bucket(p_price_huf integer) returns smallint
language sql immutable set search_path = '' as $$
  select case when p_price_huf <= 1000 then 1 when p_price_huf <= 2000 then 2 when p_price_huf <= 3000 then 3
    when p_price_huf <= 4000 then 4 when p_price_huf <= 6000 then 5 when p_price_huf <= 8000 then 6
    when p_price_huf <= 10000 then 7 else 8 end::smallint;
$$;
revoke all on function private.price_bucket(integer) from public, anon, authenticated;

alter table public.ratings add column price_bucket smallint check (price_bucket between 1 and 8);
alter table public.ratings alter column price_huf drop not null;
alter table public.ratings add constraint ratings_price_guess_present check (price_bucket is not null or price_huf is not null);

-- Version 2 scores the bucket (exact 50, neighbour 25) and alcohol as before. Existing games
-- keep their version; new games get 2. Version 1 games were never scored server-side.
alter table public.games drop constraint games_scoring_version_check;
alter table public.games add constraint games_scoring_version_check check (scoring_version in (1, 2));
alter table public.games alter column scoring_version set default 2;

-- Same argument types as before, so the old signature must go before the new name is exposed.
drop function public.submit_rating(uuid, integer, integer, integer);
create function public.submit_rating(
  p_round_id uuid, p_price_bucket integer, p_alcohol_tenths integer, p_liking integer
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
  if p_price_bucket is null or p_price_bucket not between 1 and 8
    or p_alcohol_tenths is null or p_alcohol_tenths not between 0 and 250
    or p_liking is null or p_liking not between 1 and 10 then
    raise exception 'RATING_INVALID';
  end if;
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
  insert into public.ratings (game_id, round_id, participant_id, price_bucket, price_huf, alcohol_tenths, liking)
    values (v_game_id, p_round_id, v_participant.id, p_price_bucket, null, p_alcohol_tenths, p_liking)
    on conflict (round_id, participant_id) do update set price_bucket = excluded.price_bucket, price_huf = null,
      alcohol_tenths = excluded.alcohol_tenths, liking = excluded.liking, submitted_at = clock_timestamp()
    returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.submit_rating(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.submit_rating(uuid, integer, integer, integer) to authenticated;

-- Only your own rating; the bucket replaces the exact price guess in the player DTO.
create or replace function public.get_game_snapshot(p_game_id uuid) returns jsonb
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
    'own_rating', (select jsonb_build_object('round_id', a.round_id, 'price_bucket', a.price_bucket,
      'alcohol_tenths', a.alcohol_tenths, 'liking', a.liking, 'submitted_at', a.submitted_at)
      from public.ratings a join public.participants p on p.id = a.participant_id
      where a.game_id = p_game_id and p.user_id = auth.uid() and a.price_bucket is not null
        and a.round_id = (select id from public.rounds where game_id = p_game_id and status <> 'pending'
          order by position desc limit 1))
  );
$$;

commit;
