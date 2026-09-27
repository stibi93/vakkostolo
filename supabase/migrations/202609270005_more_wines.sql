begin;
-- A tasting may hold more than the original 12-wine assumption. Steps stay capped at 60.

alter table public.rounds drop constraint rounds_position_check;
alter table public.rounds add constraint rounds_position_check check (position between 1 and 40);

alter table private.tasting_steps drop constraint reveal_card_targets;
alter table private.tasting_steps add constraint reveal_card_targets check (
 (kind='reveal' and seconds=0 and cardinality(reveal_round_ids) between 1 and 40)
 or (kind<>'reveal' and cardinality(reveal_round_ids)=0));

create or replace function public.create_game(
  p_request_id uuid, p_title text, p_round_seconds integer,
  p_reveal_every integer, p_wines jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_host uuid := private.require_permanent_user();
  v_game uuid;
  v_round uuid;
  v_wine jsonb;
  v_wines jsonb := '[]'::jsonb;
  v_position integer := 0;
  v_hash bytea;
  v_previous private.game_creation_requests%rowtype;
begin
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 100 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_round_seconds is null or (p_round_seconds <> 0 and p_round_seconds not between 30 and 1800)
    or p_reveal_every is null or p_reveal_every not between 1 and 12 then
    raise exception 'INVALID_SETTINGS';
  end if;
  if jsonb_typeof(p_wines) is distinct from 'array' then raise exception 'INVALID_WINES'; end if;
  if jsonb_array_length(p_wines) not between 1 and 40 then raise exception 'INVALID_WINES'; end if;
  for v_wine in select value from jsonb_array_elements(p_wines) loop
    if jsonb_typeof(v_wine) is distinct from 'object' then raise exception 'INVALID_WINE'; end if;
    if jsonb_typeof(v_wine->'name') is distinct from 'string'
      or jsonb_typeof(v_wine->'price_huf') is distinct from 'number'
      or jsonb_typeof(v_wine->'alcohol_tenths') is distinct from 'number'
      or v_wine - array['name', 'price_huf', 'alcohol_tenths'] <> '{}'::jsonb then
      raise exception 'INVALID_WINE';
    end if;
    if char_length(btrim(v_wine->>'name')) not between 1 and 200
      or (v_wine->>'price_huf')::numeric not between 1 and 1000000
      or mod((v_wine->>'price_huf')::numeric, 1) <> 0
      or (v_wine->>'alcohol_tenths')::numeric not between 0 and 250
      or mod((v_wine->>'alcohol_tenths')::numeric, 1) <> 0 then
      raise exception 'INVALID_WINE';
    end if;
    v_wines := v_wines || jsonb_build_array(jsonb_build_object(
      'name', btrim(v_wine->>'name'), 'price_huf', (v_wine->>'price_huf')::integer,
      'alcohol_tenths', (v_wine->>'alcohol_tenths')::integer));
  end loop;
  v_hash := sha256(convert_to(jsonb_build_object('title', btrim(p_title),
    'round_seconds', p_round_seconds, 'reveal_every', p_reveal_every, 'wines', v_wines)::text, 'UTF8'));
  -- Equal keys serialize even before the first game exists. Hash collisions only add waiting.
  perform pg_advisory_xact_lock(hashtextextended(v_host::text || ':' || p_request_id::text, 0));
  select * into v_previous from private.game_creation_requests
    where host_id = v_host and request_id = p_request_id;
  if found then
    if v_previous.payload_hash <> v_hash then raise exception 'REQUEST_ID_CONFLICT'; end if;
    return v_previous.game_id;
  end if;
  insert into public.games(host_id, title, round_seconds, reveal_every)
    values (v_host, btrim(p_title), p_round_seconds, p_reveal_every) returning id into v_game;
  for v_wine in select value from jsonb_array_elements(v_wines) loop
    v_position := v_position + 1;
    insert into public.rounds(game_id, position) values (v_game, v_position) returning id into v_round;
    insert into public.wine_secrets(game_id, round_id, name, price_huf, alcohol_tenths)
      values (v_game, v_round, v_wine->>'name', (v_wine->>'price_huf')::integer,
        (v_wine->>'alcohol_tenths')::smallint);
  end loop;
  insert into public.game_events(game_id, actor_id, request_id, event_type)
    values (v_game, v_host, p_request_id, 'game_created');
  insert into private.game_creation_requests(host_id, request_id, game_id, payload_hash)
    values (v_host, p_request_id, v_game, v_hash);
  return v_game;
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
  if wine_n+(select count(*) from jsonb_array_elements(p_steps) x where x->>'kind'='wine') not between 1 and 40
    or n+jsonb_array_length(p_steps)>60 then raise exception 'INVALID_SCHEDULE'; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_steps) x)<>jsonb_array_length(p_steps)
    then raise exception 'INVALID_SCHEDULE'; end if;
  -- Reject foreign IDs, kind changes and attempts to edit past/current steps before deleting anything.
  for item in select * from jsonb_array_elements(p_steps) loop
    sid := (item->>'id')::uuid;
    if sid is null or item->>'kind' not in ('wine','break','reveal') or item->>'kind' is null then raise exception 'INVALID_SCHEDULE'; end if;
    if item->>'kind'='reveal' then
      if jsonb_typeof(item->'reveal_round_ids') is distinct from 'array' then raise exception 'INVALID_REVEAL_TARGETS'; end if;
      if jsonb_array_length(item->'reveal_round_ids') not between 1 and 40 then raise exception 'INVALID_REVEAL_TARGETS'; end if;
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
      if item ? 'questions' then
        perform private.validate_questions(item->'questions');
        insert into private.wine_questions values(rid,item->'questions') on conflict(round_id) do update set questions=excluded.questions;
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

commit;
