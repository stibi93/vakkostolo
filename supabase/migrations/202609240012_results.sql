begin;

-- Pure, versioned scoring. Numeric arithmetic; round the total only once.
-- A legacy v1 response without an exact price cannot be scored using the v1 formula.
create function private.rating_points(p_version integer,p_true_price integer,p_true_alcohol integer,
  p_bucket integer,p_price integer,p_alcohol integer)
returns table(price_points numeric,alcohol_points numeric,total integer)
language sql immutable set search_path='' as $$
  with points as (select
    case when p_version=2 then case abs(coalesce(p_bucket,private.price_bucket(p_price))-private.price_bucket(p_true_price))
      when 0 then 50::numeric when 1 then 25::numeric else case when coalesce(p_bucket,p_price) is null then null else 0::numeric end end
    when p_version=1 and p_price is not null then 50*greatest(0,1-abs(p_price::numeric-p_true_price)/p_true_price) end as price,
    case when p_alcohol is not null then 50*greatest(0,1-abs(p_alcohol-p_true_alcohol)::numeric/30) end as alcohol)
  select price,alcohol,case when price is not null and alcohol is not null then round(price+alcohol)::integer end from points;
$$;
revoke all on function private.rating_points(integer,integer,integer,integer,integer,integer) from public,anon,authenticated;

create function public.get_game_results(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; result jsonb; own_id uuid;
begin
  -- Membership is checked before any result, count or score is returned.
  base:=public.get_lobby_snapshot(p_game_id);
  own_id:=(base->>'self_participant_id')::uuid;
  with wines as (
    select w.*,r.position from public.revealed_wines w join public.rounds r on r.id=w.round_id
      where w.game_id=p_game_id and r.status='revealed'
  ), answers as (
    select a.*,p.price_points,p.alcohol_points,p.total from public.ratings a
      join wines w on w.round_id=a.round_id join public.games g on g.id=a.game_id
      cross join lateral private.rating_points(g.scoring_version,w.price_huf,w.alcohol_tenths,a.price_bucket,a.price_huf,a.alcohol_tenths) p
      where a.game_id=p_game_id
  ), totals as (
    select p.id,p.nickname,row_number() over(order by p.joined_at,p.id) as seat,
      coalesce(sum(a.total),0)::integer as points,count(a.id)::integer as answered,
      count(a.id) filter(where a.total is null)::integer as unscored
    from public.participants p left join answers a on a.participant_id=p.id
    where p.game_id=p_game_id group by p.id
  ), ranked as (
    select *,rank() over(order by points desc) as place from totals
  )
  select jsonb_build_object('scoring_version',g.scoring_version,'final',g.status='finished',
    'revealed_count',(select count(*) from wines),'max_points',(select count(*)*100 from wines),
    'wines',coalesce((select jsonb_agg(jsonb_build_object('id',w.round_id,'position',w.position,'name',w.name,
      'photo_updated_at',(select o.updated_at from storage.objects o where o.bucket_id='wine-photos' and o.name=w.game_id||'/'||w.round_id||'.jpg'),
      'price_huf',w.price_huf,'price_bucket',private.price_bucket(w.price_huf),'alcohol_tenths',w.alcohol_tenths,
      'response_count',(select count(*) from answers a where a.round_id=w.round_id),
      'average_liking',(select round(avg(a.liking),1) from answers a where a.round_id=w.round_id),
      'own',case when own_id is null then null else
        (select jsonb_build_object('price_bucket',a.price_bucket,'price_huf',a.price_huf,'alcohol_tenths',a.alcohol_tenths,
          'liking',a.liking,'price_points',a.price_points,'alcohol_points',a.alcohol_points,'total',a.total)
          from answers a where a.round_id=w.round_id and a.participant_id=own_id) end)
      order by w.position) from wines w),'[]'::jsonb),
    'leaderboard',case when exists(select 1 from wines) then coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'nickname',nickname,'seat',seat,'rank',place,'points',points,'answered',answered,'unscored',unscored)
      order by place,seat) from ranked),'[]'::jsonb) else '[]'::jsonb end)
    into result from public.games g where g.id=p_game_id;
  return result;
end;
$$;
revoke all on function public.get_game_results(uuid) from public,anon,authenticated;
grant execute on function public.get_game_results(uuid) to authenticated;

-- Same refresh/reconnect path as live play. No hidden-round points or aggregate counts.
alter function public.get_game_snapshot(uuid) set schema private;
alter function private.get_game_snapshot(uuid) rename to schedule_snapshot;
revoke all on function private.schedule_snapshot(uuid) from public,anon,authenticated;
create function public.get_game_snapshot(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb;
begin
  snapshot:=private.schedule_snapshot(p_game_id);
  if snapshot ? 'revealed' then snapshot:=snapshot||jsonb_build_object('results',public.get_game_results(p_game_id)); end if;
  return snapshot;
end;
$$;
revoke all on function public.get_game_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_game_snapshot(uuid) to authenticated;
commit;
