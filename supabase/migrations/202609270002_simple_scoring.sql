begin;
-- Version 3: one point for an exact price bucket, one for an exact alcohol, nothing partial.
-- Liking never scores. Custom-question points are added by get_game_results.
alter table public.games drop constraint games_scoring_version_check;
alter table public.games add constraint games_scoring_version_check check (scoring_version in (1, 2, 3));
alter table public.games alter column scoring_version set default 3;
update public.games set scoring_version = 3 where status <> 'finished' and scoring_version <> 3;

create or replace function private.rating_points(p_version integer,p_true_price integer,p_true_alcohol integer,
  p_bucket integer,p_price integer,p_alcohol integer)
returns table(price_points numeric,alcohol_points numeric,total integer)
language sql immutable set search_path='' as $$
  with points as (select
    case
      when p_version=3 then case when coalesce(p_bucket, case when p_price is null then null else private.price_bucket(p_price) end) is null then null::numeric
        when coalesce(p_bucket, private.price_bucket(p_price)) = private.price_bucket(p_true_price) then 1::numeric else 0::numeric end
      when p_version=2 then case abs(coalesce(p_bucket,private.price_bucket(p_price))-private.price_bucket(p_true_price))
        when 0 then 50::numeric when 1 then 25::numeric else case when coalesce(p_bucket,p_price) is null then null else 0::numeric end end
      when p_version=1 and p_price is not null then 50*greatest(0,1-abs(p_price::numeric-p_true_price)/p_true_price)
    end as price,
    case
      when p_version=3 and p_alcohol is not null then case when p_alcohol = p_true_alcohol then 1::numeric else 0::numeric end
      when p_alcohol is not null then 50*greatest(0,1-abs(p_alcohol-p_true_alcohol)::numeric/30)
    end as alcohol)
  select price,alcohol,case when price is not null and alcohol is not null then round(price+alcohol)::integer end from points;
$$;

alter function public.get_game_results(uuid) set schema private;
alter function private.get_game_results(uuid) rename to pre_simple_score_results;
revoke all on function private.pre_simple_score_results(uuid) from public,anon,authenticated;

create function public.get_game_results(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; wines jsonb; board jsonb; bonus jsonb; max_points integer;
begin
  result := private.pre_simple_score_results(p_game_id);
  if coalesce((result->>'scoring_version')::int, 0) <> 3 or coalesce((result->>'revealed_count')::int, 0) = 0 then
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
revoke all on function public.get_game_results(uuid) from public,anon,authenticated;
grant execute on function public.get_game_results(uuid) to authenticated;

-- After the tasting starts, players only receive their own roster row. The host also sees who has submitted the current round, without the guess itself.
alter function public.get_game_snapshot(uuid) set schema private;
alter function private.get_game_snapshot(uuid) rename to pre_progress_snapshot;
revoke all on function private.pre_progress_snapshot(uuid) from public,anon,authenticated;

create function public.get_game_snapshot(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb;
begin
  s := private.pre_progress_snapshot(p_game_id);
  if s->>'role' = 'player' and (s->'game'->>'status') not in ('draft', 'lobby') then
    s := jsonb_set(s, '{participants}', coalesce((
      select jsonb_agg(p) from jsonb_array_elements(s->'participants') p
      where p->>'id' = s->>'self_participant_id'
    ), '[]'::jsonb));
  end if;
  if s->>'role' = 'host' and s->'round' is not null and jsonb_typeof(s->'round') = 'object' then
    s := s || jsonb_build_object('submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p->>'id', 'nickname', p->>'nickname', 'seat', (p->>'seat')::int,
        'submitted', exists(select 1 from public.ratings r
          where r.round_id = (s->'round'->>'id')::uuid and r.participant_id = (p->>'id')::uuid))
        order by (p->>'seat')::int)
      from jsonb_array_elements(s->'participants') p
    ), '[]'::jsonb));
  end if;
  return s;
end;
$$;
revoke all on function public.get_game_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_game_snapshot(uuid) to authenticated;
commit;
