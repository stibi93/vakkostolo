begin;
-- Correct choices and individual answers never enter public tables or realtime payloads.
create table private.wine_questions (
 round_id uuid primary key references public.rounds(id) on delete cascade,
 questions jsonb not null default '[]'
);
create table private.question_answers (
 rating_id uuid primary key references public.ratings(id) on delete cascade,
 answers jsonb not null
);
revoke all on private.wine_questions,private.question_answers from public,anon,authenticated;
create function private.validate_questions(qs jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare q jsonb; o jsonb;
begin
 if jsonb_typeof(qs) is distinct from 'array' then raise exception 'INVALID_QUESTIONS'; end if;
 if jsonb_array_length(qs)>5 then raise exception 'INVALID_QUESTIONS'; end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(qs) x)<>jsonb_array_length(qs) then raise exception 'INVALID_QUESTIONS'; end if;
 for q in select * from jsonb_array_elements(qs) loop
  if jsonb_typeof(q->'id') is distinct from 'string' or (q->>'id') !~ '^[a-zA-Z0-9-]{1,64}$'
   or jsonb_typeof(q->'prompt') is distinct from 'string' or char_length(btrim(q->>'prompt')) not between 1 and 200
   or jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'INVALID_QUESTIONS'; end if;
  if jsonb_array_length(q->'options') not between 2 and 6 then raise exception 'INVALID_QUESTIONS'; end if;
  for o in select * from jsonb_array_elements(q->'options') loop
   if jsonb_typeof(o->'id') is distinct from 'string' or (o->>'id') !~ '^[a-zA-Z0-9-]{1,64}$'
    or jsonb_typeof(o->'label') is distinct from 'string' or char_length(btrim(o->>'label')) not between 1 and 100 then raise exception 'INVALID_QUESTIONS'; end if;
  end loop;
  if (select count(distinct x->>'id') from jsonb_array_elements(q->'options') x)<>jsonb_array_length(q->'options')
   or (select count(distinct lower(btrim(x->>'label'))) from jsonb_array_elements(q->'options') x)<>jsonb_array_length(q->'options')
   or jsonb_typeof(q->'correctOptionId') is distinct from 'string'
   or not exists(select 1 from jsonb_array_elements(q->'options') x where x->>'id'=q->>'correctOptionId') then raise exception 'INVALID_QUESTIONS'; end if;
 end loop;
end;
$$;
revoke all on function private.validate_questions(jsonb) from public,anon,authenticated;
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
      'questions',coalesce((select questions from private.wine_questions where round_id=s.round_id),'[]'::jsonb),'price_huf',w.price_huf,'alcohol_tenths',w.alcohol_tenths,'round_position',r.position)
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

create or replace function public.create_game_with_schedule(p_request_id uuid,p_title text,p_round_seconds integer,p_reveal_every integer,p_wines jsonb,p_steps jsonb)
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
 g:=public.create_game(p_request_id,p_title,p_round_seconds,p_reveal_every,(select jsonb_agg(x-'questions') from jsonb_array_elements(p_wines) x));
 select array_agg(id order by position) into ids from public.rounds where game_id=g;
 for item in select * from jsonb_array_elements(p_steps) loop
  if item->>'kind'='wine' then
   if item->'wine_index' is distinct from to_jsonb(wine_n) or wine_n>=cardinality(ids) then raise exception 'INVALID_SCHEDULE'; end if;
   step:=jsonb_build_object('id',ids[wine_n+1],'kind','wine','title',p_wines->wine_n->>'name',
    'questions',coalesce(p_wines->wine_n->'questions','[]'::jsonb),'price_huf',p_wines->wine_n->'price_huf','alcohol_tenths',p_wines->wine_n->'alcohol_tenths','seconds',p_round_seconds);
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

-- Preserve the established locking, eligibility and deadline checks. The legacy endpoint
-- also routes through question validation, so old clients cannot omit required answers.
alter function public.submit_rating(uuid,integer,integer,integer) set schema private;
alter function private.submit_rating(uuid,integer,integer,integer) rename to submit_base_rating;
revoke all on function private.submit_base_rating(uuid,integer,integer,integer) from public,anon,authenticated;
create function public.submit_rating_with_questions(p_round_id uuid,p_price_bucket integer,p_alcohol_tenths integer,p_liking integer,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ratings; qs jsonb; q jsonb;
begin
 r:=private.submit_base_rating(p_round_id,p_price_bucket,p_alcohol_tenths,p_liking);
 select questions into qs from private.wine_questions where round_id=p_round_id;
 qs:=coalesce(qs,'[]');
 if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'INVALID_ANSWERS'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>jsonb_array_length(qs) then raise exception 'INVALID_ANSWERS'; end if;
 for q in select * from jsonb_array_elements(qs) loop
  if jsonb_typeof(p_answers->(q->>'id')) is distinct from 'string'
   or not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=p_answers->>(q->>'id')) then raise exception 'INVALID_ANSWERS'; end if;
 end loop;
 insert into private.question_answers values(r.id,p_answers) on conflict(rating_id) do update set answers=excluded.answers;
 return to_jsonb(r)||jsonb_build_object('custom_answers',p_answers);
end;
$$;
create function public.submit_rating(p_round_id uuid,p_price_bucket integer,p_alcohol_tenths integer,p_liking integer)
returns public.ratings language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.submit_rating_with_questions(p_round_id,p_price_bucket,p_alcohol_tenths,p_liking,'{}');
 return jsonb_populate_record(null::public.ratings,result);
end;
$$;
revoke all on function public.submit_rating(uuid,integer,integer,integer),public.submit_rating_with_questions(uuid,integer,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.submit_rating(uuid,integer,integer,integer),public.submit_rating_with_questions(uuid,integer,integer,integer,jsonb) to authenticated;

alter function public.get_game_snapshot(uuid) set schema private;
alter function private.get_game_snapshot(uuid) rename to pre_question_snapshot;
revoke all on function private.pre_question_snapshot(uuid) from public,anon,authenticated;
create function public.get_game_snapshot(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb; qs jsonb; answers jsonb;
begin
 s:=private.pre_question_snapshot(p_game_id);
 if s->'round' is not null and s->'round'<>'null'::jsonb then
  select coalesce(jsonb_agg(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',
   (select jsonb_agg(jsonb_build_object('id',o->>'id','label',o->>'label')) from jsonb_array_elements(q->'options') o))),'[]')
   into qs from private.wine_questions w cross join lateral jsonb_array_elements(w.questions) q where w.round_id=(s->'round'->>'id')::uuid;
  s:=jsonb_set(s,'{round,questions}',qs);
  if s->'own_rating'<>'null'::jsonb then
   select a.answers into answers from private.question_answers a join public.ratings r on r.id=a.rating_id
    join public.participants p on p.id=r.participant_id where r.round_id=(s->'round'->>'id')::uuid and p.user_id=auth.uid();
   s:=jsonb_set(s,'{own_rating,custom_answers}',coalesce(answers,'{}'));
  end if;
 end if;
 return s;
end;
$$;
revoke all on function public.get_game_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_game_snapshot(uuid) to authenticated;

alter function public.get_game_results(uuid) set schema private;
alter function private.get_game_results(uuid) rename to pre_question_results;
revoke all on function private.pre_question_results(uuid) from public,anon,authenticated;
create function public.get_game_results(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; wines jsonb;
begin
 result:=private.pre_question_results(p_game_id);
 -- Only the already revealed wines from the authorized base DTO are enriched.
 select coalesce(jsonb_agg(w||jsonb_build_object('questions',coalesce((
  select jsonb_agg(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',
   (select jsonb_agg(jsonb_build_object('id',o->>'id','label',o->>'label')) from jsonb_array_elements(q->'options') o),
   'correctOptionId',q->>'correctOptionId','ownOptionId',(
    select a.answers->>(q->>'id') from private.question_answers a join public.ratings r on r.id=a.rating_id
     join public.participants p on p.id=r.participant_id where r.round_id=(w->>'id')::uuid and p.user_id=auth.uid())))
  from private.wine_questions sq cross join lateral jsonb_array_elements(sq.questions) q where sq.round_id=(w->>'id')::uuid),'[]'))),'[]')
 into wines from jsonb_array_elements(result->'wines') w;
 return jsonb_set(result,'{wines}',wines);
end;
$$;
revoke all on function public.get_game_results(uuid) from public,anon,authenticated;
grant execute on function public.get_game_results(uuid) to authenticated;
commit;
