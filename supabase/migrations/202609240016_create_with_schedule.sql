begin;
alter table private.game_creation_requests add column initial_schedule_hash bytea;
create function public.create_game_with_schedule(p_request_id uuid,p_title text,p_round_seconds integer,p_reveal_every integer,p_wines jsonb,p_steps jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid:=private.require_permanent_user(); g uuid; previous private.game_creation_requests;
 hash bytea:=sha256(convert_to(jsonb_build_array(p_title,p_round_seconds,p_reveal_every,p_wines,p_steps)::text,'UTF8'));
 ids uuid[]; item jsonb; mapped jsonb:='[]'; step jsonb; wine_n integer:=0; targets uuid[];
begin
 if p_request_id is null then raise exception 'INVALID_REQUEST_ID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(h::text||':'||p_request_id::text,0));
 select * into previous from private.game_creation_requests where host_id=h and request_id=p_request_id;
 if found then
  if previous.initial_schedule_hash is distinct from hash then raise exception 'REQUEST_ID_CONFLICT'; end if;
  return previous.game_id;
 end if;
 if jsonb_typeof(p_steps) is distinct from 'array' then raise exception 'INVALID_SCHEDULE'; end if;
 if jsonb_array_length(p_steps) not between 1 and 60 then raise exception 'INVALID_SCHEDULE'; end if;
 g:=public.create_game(p_request_id,p_title,p_round_seconds,p_reveal_every,p_wines);
 select array_agg(id order by position) into ids from public.rounds where game_id=g;
 for item in select * from jsonb_array_elements(p_steps) loop
  if item->>'kind'='wine' then
   if item->'wine_index' is distinct from to_jsonb(wine_n) or wine_n>=cardinality(ids) then raise exception 'INVALID_SCHEDULE'; end if;
   step:=jsonb_build_object('id',ids[wine_n+1],'kind','wine','title',p_wines->wine_n->>'name',
    'price_huf',p_wines->wine_n->'price_huf','alcohol_tenths',p_wines->wine_n->'alcohol_tenths','seconds',p_round_seconds);
   wine_n:=wine_n+1;
  elsif item->>'kind' in ('break','reveal') then
   targets:='{}';
   if item->>'kind'='reveal' then
    if jsonb_typeof(item->'wine_indexes') is distinct from 'array' then raise exception 'INVALID_REVEAL_TARGETS'; end if;
    if exists(select 1 from jsonb_array_elements(item->'wine_indexes') x where jsonb_typeof(x)<>'number'
      or x::text !~ '^[0-9]+$' or (x::text)::numeric>=wine_n) then raise exception 'INVALID_REVEAL_TARGETS'; end if;
    select array_agg(ids[(x::text)::integer+1]) into targets from jsonb_array_elements(item->'wine_indexes') x;
   end if;
   step:=jsonb_build_object('id',gen_random_uuid(),'kind',item->>'kind','title',item->>'title',
    'message',coalesce(item->>'message',''),'seconds',case when item->>'kind'='reveal' then 0 else (item->>'seconds')::integer end,
    'reveal_round_ids',coalesce(to_jsonb(targets),'[]'));
  else raise exception 'INVALID_SCHEDULE'; end if;
  mapped:=mapped||jsonb_build_array(step);
 end loop;
 if wine_n<>cardinality(ids) then raise exception 'INVALID_SCHEDULE'; end if;
 perform public.save_tasting_schedule(g,0,gen_random_uuid(),mapped);
 update private.game_creation_requests set initial_schedule_hash=hash where host_id=h and request_id=p_request_id;
 return g;
end;
$$;
revoke all on function public.create_game_with_schedule(uuid,text,integer,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_game_with_schedule(uuid,text,integer,integer,jsonb,jsonb) to authenticated;
commit;
