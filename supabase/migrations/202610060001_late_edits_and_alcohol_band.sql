begin;
-- Host may reopen answer edits after a deadline without restarting the round.
-- Scoring v4: alcohol is correct inside a 1 percentage-point window (±0.5).
alter table public.rounds add column late_edits boolean not null default false;

alter table public.games drop constraint games_scoring_version_check;
alter table public.games add constraint games_scoring_version_check check (scoring_version in (1, 2, 3, 4));
alter table public.games alter column scoring_version set default 4;
update public.games set scoring_version = 4 where status <> 'finished' and scoring_version <> 4;

create or replace function private.rating_points(p_version integer,p_true_price integer,p_true_alcohol integer,
  p_bucket integer,p_price integer,p_alcohol integer)
returns table(price_points numeric,alcohol_points numeric,total integer)
language sql immutable set search_path='' as $$
  with points as (select
    case
      when p_version in (3, 4) then case when coalesce(p_bucket, case when p_price is null then null else private.price_bucket(p_price) end) is null then null::numeric
        when coalesce(p_bucket, private.price_bucket(p_price)) = private.price_bucket(p_true_price) then 1::numeric else 0::numeric end
      when p_version=2 then case abs(coalesce(p_bucket,private.price_bucket(p_price))-private.price_bucket(p_true_price))
        when 0 then 50::numeric when 1 then 25::numeric else case when coalesce(p_bucket,p_price) is null then null else 0::numeric end end
      when p_version=1 and p_price is not null then 50*greatest(0,1-abs(p_price::numeric-p_true_price)/p_true_price)
    end as price,
    case
      when p_version=4 and p_alcohol is not null then case when abs(p_alcohol - p_true_alcohol) <= 5 then 1::numeric else 0::numeric end
      when p_version=3 and p_alcohol is not null then case when p_alcohol = p_true_alcohol then 1::numeric else 0::numeric end
      when p_alcohol is not null then 50*greatest(0,1-abs(p_alcohol-p_true_alcohol)::numeric/30)
    end as alcohol)
  select price,alcohol,case when price is not null and alcohol is not null then round(price+alcohol)::integer end from points;
$$;

create or replace function private.pre_scorecard_results(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; wines jsonb; board jsonb; bonus jsonb; max_points integer; version integer;
begin
  result := private.pre_simple_score_results(p_game_id);
  version := coalesce((result->>'scoring_version')::int, 0);
  if version not in (3, 4) or coalesce((result->>'revealed_count')::int, 0) = 0 then
    return result;
  end if;
  select coalesce(jsonb_object_agg(hit.participant_id, hit.pts), '{}'::jsonb) into bonus from (
    select r.participant_id::text, count(*)::int as pts
    from public.ratings r
    join public.rounds rd on rd.id = r.round_id and rd.status = 'revealed' and rd.game_id = p_game_id
    join private.wine_questions wq on wq.round_id = r.round_id
    join private.question_answers qa on qa.rating_id = r.id
    cross join lateral jsonb_array_elements(wq.questions) q
    where r.game_id = p_game_id and qa.answers->>(q->>'id') = q->>'correctOptionId'
      and rd.id in (select (w->>'id')::uuid from jsonb_array_elements(result->'wines') w)
    group by r.participant_id
  ) hit(participant_id, pts);
  select coalesce(jsonb_agg(
    case when w->'own' is null or jsonb_typeof(w->'own') = 'null' then w
    else jsonb_set(w, '{own,total}', to_jsonb((
      coalesce((w->'own'->>'price_points')::numeric, 0)
      + coalesce((w->'own'->>'alcohol_points')::numeric, 0)
      + (select count(*) from jsonb_array_elements(coalesce(w->'questions', '[]'::jsonb)) q
         where q->>'ownOptionId' = q->>'correctOptionId')
    )::int)) end
    order by (w->>'position')::int), '[]'::jsonb) into wines
  from jsonb_array_elements(result->'wines') w;
  select coalesce(sum(2 + coalesce(jsonb_array_length(w->'questions'), 0)), 0)::int into max_points
  from jsonb_array_elements(wines) w;
  select coalesce(jsonb_agg(jsonb_set(jsonb_set(row.entry, '{points}', to_jsonb(row.points)), '{rank}', to_jsonb(row.place))
    order by row.place, (row.entry->>'seat')::int), '[]'::jsonb) into board
  from (
    select entry, points, rank() over (order by points desc) as place from (
      select e as entry, coalesce((e->>'points')::int, 0) + coalesce((bonus->>(e->>'id'))::int, 0) as points
      from jsonb_array_elements(result->'leaderboard') e
    ) scored
  ) row;
  result := jsonb_set(result, '{wines}', wines);
  result := jsonb_set(result, '{leaderboard}', board);
  result := jsonb_set(result, '{max_points}', to_jsonb(max_points));
  return result;
end;
$$;

create or replace function public.get_game_results(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  result jsonb; version integer; cards jsonb := '[]'::jsonb; card_wines jsonb; person jsonb; wine jsonb;
  v_rating uuid; v_bucket smallint; v_price integer; v_alcohol smallint; v_liking smallint;
  v_price_points numeric; v_alcohol_points numeric; v_answers jsonb; v_questions jsonb;
begin
  result := private.pre_scorecard_results(p_game_id);
  if coalesce((result->>'revealed_count')::int, 0) = 0 then
    return result || jsonb_build_object('scorecards', '[]'::jsonb);
  end if;
  version := (result->>'scoring_version')::int;
  for person in select value from jsonb_array_elements(result->'leaderboard') loop
    card_wines := '[]'::jsonb;
    for wine in select value from jsonb_array_elements(result->'wines') loop
      v_rating := null; v_bucket := null; v_price := null; v_alcohol := null; v_liking := null;
      v_price_points := null; v_alcohol_points := null; v_answers := null;
      select r.id, r.price_bucket, r.price_huf, r.alcohol_tenths, r.liking
        into v_rating, v_bucket, v_price, v_alcohol, v_liking
      from public.ratings r
      where r.game_id = p_game_id and r.round_id = (wine->>'id')::uuid and r.participant_id = (person->>'id')::uuid;
      if v_rating is not null then
        select p.price_points, p.alcohol_points into v_price_points, v_alcohol_points
        from private.rating_points(version, (wine->>'price_huf')::int, (wine->>'alcohol_tenths')::int, v_bucket, v_price, v_alcohol) p;
        select qa.answers into v_answers from private.question_answers qa where qa.rating_id = v_rating;
      end if;
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q->>'id',
        'option_id', case when picked and picked_id in (select o->>'id' from jsonb_array_elements(coalesce(q->'options', '[]'::jsonb)) o) then picked_id else null end,
        'points', case when version in (3, 4) and picked and picked_id = q->>'correctOptionId' then 1 else 0 end
      ) order by ord), '[]'::jsonb) into v_questions
      from jsonb_array_elements(coalesce(wine->'questions', '[]'::jsonb)) with ordinality as t(q, ord)
      cross join lateral (
        select coalesce(v_answers, '{}'::jsonb) ? (q->>'id') as picked, v_answers->>(q->>'id') as picked_id
      ) pick;
      card_wines := card_wines || jsonb_build_array(jsonb_build_object(
        'id', wine->>'id', 'price_bucket', v_bucket, 'price_huf', v_price, 'price_points', v_price_points,
        'alcohol_tenths', v_alcohol, 'alcohol_points', v_alcohol_points, 'liking', v_liking, 'questions', v_questions));
    end loop;
    cards := cards || jsonb_build_array(jsonb_build_object('id', person->>'id', 'wines', card_wines));
  end loop;
  return result || jsonb_build_object('scorecards', cards);
end;
$$;
revoke all on function public.get_game_results(uuid) from public, anon, authenticated;
grant execute on function public.get_game_results(uuid) to authenticated;

create or replace function private.submit_base_rating(
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
  if not exists (select 1 from public.participants where game_id = v_game_id and user_id = auth.uid()) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  select status into v_game_status from public.games where id = v_game_id for update;
  select * into v_round from public.rounds where id = p_round_id for update;
  select * into v_participant from public.participants where game_id = v_game_id and user_id = auth.uid();
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_game_status <> 'tasting' or v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;
  if v_round.closes_at is not null and clock_timestamp() >= v_round.closes_at and not v_round.late_edits then
    raise exception 'DEADLINE_PASSED';
  end if;
  if v_participant.joined_at > v_round.opened_at then raise exception 'ROUND_NOT_ELIGIBLE'; end if;
  insert into public.ratings (game_id, round_id, participant_id, price_bucket, price_huf, alcohol_tenths, liking)
    values (v_game_id, p_round_id, v_participant.id, p_price_bucket, null, p_alcohol_tenths, p_liking)
    on conflict (round_id, participant_id) do update set price_bucket = excluded.price_bucket, price_huf = null,
      alcohol_tenths = excluded.alcohol_tenths, liking = excluded.liking, submitted_at = clock_timestamp()
    returning * into v_result;
  return v_result;
end;
$$;

create or replace function private.round_snapshot(p_game_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.get_lobby_snapshot(p_game_id) || jsonb_build_object(
    'round', (select jsonb_build_object('id', r.id, 'position', r.position, 'status', r.status,
      'opened_at', r.opened_at, 'closes_at', r.closes_at, 'late_edits', r.late_edits,
      'eligible', exists(select 1 from public.participants p where p.game_id = p_game_id
        and p.user_id = auth.uid() and p.joined_at <= r.opened_at),
      'can_submit', r.status = 'open' and (r.closes_at is null or r.closes_at > statement_timestamp() or r.late_edits)
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

create function public.allow_late_edits(p_game_id uuid, p_expected_version integer, p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  h uuid := private.require_permanent_user();
  g public.games;
  r public.rounds;
  receipt private.schedule_requests;
  payload jsonb := jsonb_build_object('action','late_edits','version',p_expected_version);
begin
  select * into g from public.games where id = p_game_id and host_id = h for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if p_request_id is null or p_expected_version is null or p_expected_version < 0 then raise exception 'INVALID_START_REQUEST'; end if;
  select * into receipt from private.schedule_requests where game_id = p_game_id and request_id = p_request_id;
  if found then
    if receipt.payload <> payload then raise exception 'REQUEST_ID_CONFLICT'; end if;
    return receipt.result;
  end if;
  if g.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if g.status <> 'tasting' then raise exception 'ROUND_NOT_OPEN'; end if;
  select * into r from public.rounds where game_id = p_game_id and status = 'open' for update;
  if r.id is null then raise exception 'ROUND_NOT_OPEN'; end if;
  if r.closes_at is null or r.closes_at > clock_timestamp() then raise exception 'ROUND_STILL_OPEN'; end if;
  if not r.late_edits then
    update public.rounds set late_edits = true where id = r.id;
    update public.games set version = version + 1 where id = p_game_id;
    insert into public.game_events(game_id, actor_id, request_id, event_type)
      values (p_game_id, h, p_request_id, 'late_edits_allowed');
  end if;
  insert into private.schedule_requests values (p_game_id, p_request_id, payload, r.id);
  return r.id;
end;
$$;
revoke all on function public.allow_late_edits(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.allow_late_edits(uuid, integer, uuid) to authenticated;
commit;
