begin;
-- Reveal is an explicit agenda card. Legacy reveal_every stays for old clients only.
alter table private.tasting_steps drop constraint tasting_steps_kind_check;
alter table private.tasting_steps add constraint tasting_steps_kind_check check(kind in ('wine','break','reveal'));
alter table private.tasting_steps add column reveal_round_ids uuid[] not null default '{}';
alter table private.tasting_steps drop constraint tasting_steps_check;
alter table private.tasting_steps add constraint tasting_steps_check check (
 (kind='wine' and round_id=id and (seconds=0 or seconds between 30 and 1800))
 or (kind in ('break','reveal') and round_id is null and char_length(btrim(title))>0));
alter table private.tasting_steps add constraint reveal_card_targets check (
 (kind='reveal' and seconds=0 and cardinality(reveal_round_ids) between 1 and 12)
 or (kind<>'reveal' and cardinality(reveal_round_ids)=0));

create or replace function public.get_tasting_schedule(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g public.games;
begin
  select * into g from public.games where id=p_game_id and host_id=private.require_permanent_user();
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  return jsonb_build_object('version',g.version,'status',g.status,'reveal_every',g.reveal_every,
    'steps',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'seconds',s.seconds,
      'reveal_round_ids',s.reveal_round_ids,'title',case when s.kind='wine' then w.name else s.title end,'message',s.message,
      'status',case when s.kind='wine' then r.status else s.break_status end,
      'price_huf',w.price_huf,'alcohol_tenths',w.alcohol_tenths,'round_position',r.position)
      order by s.position) from private.tasting_steps s left join public.rounds r on r.id=s.round_id
      left join public.wine_secrets w on w.round_id=s.round_id where s.game_id=p_game_id),'[]'::jsonb));
end;
$$;

create or replace function public.save_tasting_schedule(p_game_id uuid,p_expected_version integer,p_request_id uuid,p_steps jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  h uuid := private.require_permanent_user(); g public.games; receipt private.schedule_requests;
  payload jsonb := jsonb_build_object('action','save','version',p_expected_version,'steps',p_steps);
  item jsonb; sid uuid; rid uuid; n integer; wine_n integer; sec integer; previous private.tasting_steps;
begin
  select * into g from public.games where id=p_game_id and host_id=h for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if p_request_id is null or p_expected_version is null then raise exception 'INVALID_SCHEDULE'; end if;
  select * into receipt from private.schedule_requests where game_id=p_game_id and request_id=p_request_id;
  if found then
    if receipt.payload<>payload then raise exception 'REQUEST_ID_CONFLICT'; end if;
    return receipt.result;
  end if;
  if exists(select 1 from public.game_events where game_id=p_game_id and request_id=p_request_id) then raise exception 'REQUEST_ID_CONFLICT'; end if;
  if g.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if g.status='finished' then raise exception 'GAME_FINISHED'; end if;
  if p_steps is null or jsonb_typeof(p_steps)<>'array' then raise exception 'INVALID_SCHEDULE'; end if;
  if jsonb_array_length(p_steps)>60 then raise exception 'INVALID_SCHEDULE'; end if;
  select coalesce(max(s.position),0) into n from private.tasting_steps s left join public.rounds r on r.id=s.round_id
    where s.game_id=p_game_id and (r.status<>'pending' or s.break_status<>'pending');
  select count(*) into wine_n from public.rounds where game_id=p_game_id and status<>'pending';
  if wine_n+(select count(*) from jsonb_array_elements(p_steps) x where x->>'kind'='wine') not between 1 and 12
    or n+jsonb_array_length(p_steps)>60 then raise exception 'INVALID_SCHEDULE'; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_steps) x)<>jsonb_array_length(p_steps)
    then raise exception 'INVALID_SCHEDULE'; end if;
  -- Reject foreign IDs, kind changes and attempts to edit past/current steps before deleting anything.
  for item in select * from jsonb_array_elements(p_steps) loop
    sid := (item->>'id')::uuid;
    if sid is null or item->>'kind' not in ('wine','break','reveal') or item->>'kind' is null then raise exception 'INVALID_SCHEDULE'; end if;
    if item->>'kind'='reveal' then
      if jsonb_typeof(item->'reveal_round_ids') is distinct from 'array' then raise exception 'INVALID_REVEAL_TARGETS'; end if;
      if jsonb_array_length(item->'reveal_round_ids') not between 1 and 12 then raise exception 'INVALID_REVEAL_TARGETS'; end if;
    end if;
    select * into previous from private.tasting_steps where id=sid;
    if found and (previous.game_id<>p_game_id or previous.position<=n or previous.kind<>item->>'kind')
      then raise exception 'STEP_LOCKED'; end if;
  end loop;
  delete from public.rounds r where r.game_id=p_game_id and r.status='pending'
    and not exists(select 1 from jsonb_array_elements(p_steps) x where x->>'id'=r.id::text);
  delete from private.tasting_steps s where s.game_id=p_game_id and s.kind<>'wine' and s.break_status='pending'
    and not exists(select 1 from jsonb_array_elements(p_steps) x where x->>'id'=s.id::text);
  for item in select * from jsonb_array_elements(p_steps) loop
    n := n+1; sid := (item->>'id')::uuid; sec := (item->>'seconds')::integer;
    if sec is null or item->>'title' is null or char_length(btrim(item->>'title'))<1 then raise exception 'INVALID_SCHEDULE'; end if;
    if item->>'kind'='wine' then
      wine_n := wine_n+1;
      if sec <> 0 and sec not between 30 and 1800 then raise exception 'INVALID_SCHEDULE'; end if;
      select round_id into rid from private.tasting_steps where id=sid;
      if not found then
        rid:=sid;
        insert into public.rounds(id,game_id,position) values(rid,p_game_id,wine_n);
        insert into public.wine_secrets(round_id,game_id,name,price_huf,alcohol_tenths)
          values(rid,p_game_id,btrim(item->>'title'),(item->>'price_huf')::integer,(item->>'alcohol_tenths')::smallint);
      else
        update public.rounds set position=wine_n where id=rid;
        update public.wine_secrets set name=btrim(item->>'title'),price_huf=(item->>'price_huf')::integer,
          alcohol_tenths=(item->>'alcohol_tenths')::smallint where round_id=rid;
      end if;
      update private.tasting_steps set position=n,seconds=sec where id=sid;
    else
      insert into private.tasting_steps(id,game_id,position,kind,seconds,title,message,reveal_round_ids)
        values(sid,p_game_id,n,item->>'kind',sec,btrim(item->>'title'),coalesce(item->>'message',''),
          array(select jsonb_array_elements_text(coalesce(item->'reveal_round_ids','[]'::jsonb)))::uuid[])
        on conflict(id) do update set position=excluded.position,seconds=excluded.seconds,title=excluded.title,message=excluded.message,reveal_round_ids=excluded.reveal_round_ids;
    end if;
  end loop;
  -- Validate after all moves/deletes atomically: every target must precede its card.
  if exists(select 1 from private.tasting_steps card cross join lateral unnest(card.reveal_round_ids) target(id)
    left join private.tasting_steps wine on wine.id=target.id and wine.game_id=card.game_id and wine.kind='wine'
    where card.game_id=p_game_id and card.kind='reveal'
      and (wine.id is null or wine.position>=card.position))
    or exists(select 1 from private.tasting_steps card where card.game_id=p_game_id and card.kind='reveal'
      and cardinality(card.reveal_round_ids)<>(select count(distinct id) from unnest(card.reveal_round_ids) id))
    then raise exception 'INVALID_REVEAL_TARGETS'; end if;
  update public.games set version=version+1 where id=p_game_id;
  insert into private.schedule_requests values(p_game_id,p_request_id,payload,p_game_id);
  insert into public.game_events(game_id,actor_id,request_id,event_type) values(p_game_id,h,p_request_id,'schedule_saved');
  return p_game_id;
end;
$$;

create or replace function public.control_tasting(p_game_id uuid,p_expected_version integer,p_request_id uuid,p_action text,p_seconds integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  h uuid := private.require_permanent_user(); g public.games; r public.rounds; s private.tasting_steps;
  receipt private.schedule_requests; payload jsonb := jsonb_build_object('action',p_action,'version',p_expected_version,'seconds',p_seconds);
  result uuid := p_game_id; t timestamptz; event_name text;
begin
  select * into g from public.games where id=p_game_id and host_id=h for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if p_request_id is null or p_expected_version is null or p_expected_version<0 then raise exception 'INVALID_START_REQUEST'; end if;
  select * into receipt from private.schedule_requests where game_id=p_game_id and request_id=p_request_id;
  if found then
    if receipt.payload<>payload then raise exception 'REQUEST_ID_CONFLICT'; end if;
    return receipt.result;
  end if;
  -- Respect idempotency of starts performed before this migration.
  if p_action='start' then
    select round_id into result from private.round_start_requests where game_id=p_game_id and request_id=p_request_id and expected_version=p_expected_version;
    if found then return result; end if;
    result:=p_game_id;
  end if;
  if exists(select 1 from public.game_events where game_id=p_game_id and request_id=p_request_id) then raise exception 'REQUEST_ID_CONFLICT'; end if;
  if g.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_action='start' and g.status<>'lobby' then raise exception 'GAME_NOT_IN_LOBBY'; end if;
  if g.status in ('draft','finished') then raise exception 'INVALID_TRANSITION'; end if;
  select * into r from public.rounds where game_id=p_game_id and status='open' for update;
  t:=clock_timestamp();
  if p_action='time' then
    if r.id is null or g.status<>'tasting' then raise exception 'ROUND_NOT_OPEN'; end if;
    if r.closes_at<=t then raise exception 'DEADLINE_PASSED'; end if;
    if p_seconds is null or (p_seconds <> 0 and p_seconds not between 30 and 1800) then raise exception 'INVALID_DURATION'; end if;
    update public.rounds set closes_at=case when p_seconds>0 then t+make_interval(secs=>p_seconds) end where id=r.id;
  elsif p_action='close' then
    if r.id is null then raise exception 'ROUND_NOT_OPEN'; end if;
    update public.rounds set status='closed' where id=r.id;
    update public.games set status='intermission' where id=p_game_id;
  elsif p_action in ('start','next','reveal','finish') then
    if p_action='start' and exists(select 1 from public.rounds where game_id=p_game_id and status<>'pending') then raise exception 'ROUND_ALREADY_STARTED'; end if;
    if r.id is not null then
      if r.closes_at is null or r.closes_at>t then raise exception 'ROUND_STILL_OPEN'; end if;
      update public.rounds set status='closed' where id=r.id;
    end if;
    if p_action='finish' then
      if exists(select 1 from public.rounds where game_id=p_game_id and status in ('pending','open')) or exists(
        select 1 from private.tasting_steps where game_id=p_game_id and kind<>'wine' and break_status='pending') then raise exception 'STEPS_REMAIN'; end if;
      update private.tasting_steps set break_status='done' where game_id=p_game_id and break_status='open';
      update public.games set status='finished' where id=p_game_id;
    else
      select x.* into s from private.tasting_steps x left join public.rounds q on q.id=x.round_id
        where x.game_id=p_game_id and ((x.kind='wine' and q.status='pending') or (x.kind<>'wine' and x.break_status='pending'))
        order by x.position limit 1;
      if s.id is null then raise exception 'NO_NEXT_STEP'; end if;
      if p_action='reveal' and s.kind<>'reveal' then raise exception 'REVEAL_CARD_REQUIRED'; end if;
      if not exists(select 1 from public.rounds where game_id=p_game_id) or exists(select 1 from public.rounds q where q.game_id=p_game_id
        and not exists(select 1 from public.wine_secrets w where w.round_id=q.id)) then raise exception 'WINES_INCOMPLETE'; end if;
      update private.tasting_steps set break_status='done' where game_id=p_game_id and break_status='open';
      if s.kind='wine' then
        update public.rounds set status='open',opened_at=t,closes_at=case when s.seconds>0 then t+make_interval(secs=>s.seconds) end where id=s.round_id;
        update public.games set status='tasting' where id=p_game_id;
        event_name:='round_started';
      elsif s.kind='reveal' then
        if cardinality(s.reveal_round_ids)=0 or exists(select 1 from unnest(s.reveal_round_ids) target(id)
          left join public.rounds q on q.id=target.id and q.game_id=p_game_id
          where q.id is null or q.status not in ('closed','revealed')) then raise exception 'REVEAL_NOT_READY'; end if;
        insert into public.revealed_wines(round_id,game_id,name,price_huf,alcohol_tenths)
          select w.round_id,w.game_id,w.name,w.price_huf,w.alcohol_tenths from public.wine_secrets w
          where w.game_id=p_game_id and w.round_id=any(s.reveal_round_ids)
          on conflict(round_id) do nothing;
        update public.rounds set status='revealed' where game_id=p_game_id and id=any(s.reveal_round_ids);
        update private.tasting_steps set break_status='open',started_at=t,ends_at=null where id=s.id;
        update public.games set status='reveal' where id=p_game_id;
      else
        update private.tasting_steps set break_status='open',started_at=t,ends_at=case when seconds>0 then t+make_interval(secs=>seconds) end where id=s.id;
        update public.games set status='intermission' where id=p_game_id;
      end if;
      result:=s.id;
    end if;
  else raise exception 'INVALID_TRANSITION'; end if;
  update public.games set version=version+1 where id=p_game_id;
  insert into private.schedule_requests values(p_game_id,p_request_id,payload,result);
  insert into public.game_events(game_id,actor_id,request_id,event_type) values(p_game_id,h,p_request_id,coalesce(event_name,'tasting_'||p_action));
  return result;
end;
$$;

create or replace function public.get_host_game(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_host uuid := private.require_permanent_user();
  v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = p_game_id and host_id = v_host;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  return jsonb_build_object('id', v_game.id, 'title', v_game.title, 'status', v_game.status,
    'round_seconds', v_game.round_seconds, 'reveal_every', v_game.reveal_every,
    'created_at', v_game.created_at, 'schedule', public.get_tasting_schedule(p_game_id), 'wines', coalesce((
      select jsonb_agg(jsonb_build_object('position', r.position, 'round_id', r.id, 'name', w.name,
        'price_huf', w.price_huf, 'alcohol_tenths', w.alcohol_tenths,
        'photo_updated_at', (select o.updated_at from storage.objects o
          where o.bucket_id = 'wine-photos' and o.name = r.game_id || '/' || r.id || '.jpg'),
        'photo_locked', r.status = 'revealed') order by r.position)
      from public.rounds r join public.wine_secrets w on w.round_id = r.id and w.game_id = r.game_id
      where r.game_id = v_game.id
    ), '[]'::jsonb));
end;
$$;

-- Wrap the latest snapshot (including scoring) without widening its hidden-data boundary.
alter function public.get_game_snapshot(uuid) set schema private;
alter function private.get_game_snapshot(uuid) rename to pre_reveal_card_snapshot;
revoke all on function private.pre_reveal_card_snapshot(uuid) from public,anon,authenticated;
create function public.get_game_snapshot(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; card jsonb;
begin
  result:=private.pre_reveal_card_snapshot(p_game_id);
  select jsonb_build_object('id',s.id,'title',s.title,'message',s.message,'round_ids',s.reveal_round_ids) into card
    from private.tasting_steps s where s.game_id=p_game_id and s.kind='reveal' and s.break_status='open';
  if card is not null then result:=result||jsonb_build_object('reveal_card',card,'round',null,'own_rating',null); end if;
  return result;
end;
$$;
revoke all on function public.get_game_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_game_snapshot(uuid) to authenticated;

commit;
