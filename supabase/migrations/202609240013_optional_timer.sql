begin;
-- Zero duration means manual closure. A NULL deadline is never an expired deadline.
alter table public.games drop constraint games_round_seconds_check;
alter table public.games add constraint games_round_seconds_check check (round_seconds=0 or round_seconds between 30 and 1800);
alter table public.rounds drop constraint rounds_check;
alter table public.rounds add constraint rounds_check check (status='pending' or opened_at is not null);
alter table private.tasting_steps drop constraint tasting_steps_check;
alter table private.tasting_steps add constraint tasting_steps_check check (
 (kind='wine' and round_id=id and (seconds=0 or seconds between 30 and 1800))
 or (kind='break' and round_id is null and char_length(btrim(title))>0));

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
  if jsonb_array_length(p_wines) not between 1 and 12 then raise exception 'INVALID_WINES'; end if;
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
  if wine_n+(select count(*) from jsonb_array_elements(p_steps) x where x->>'kind'='wine') not between 1 and 12
    or n+jsonb_array_length(p_steps)>60 then raise exception 'INVALID_SCHEDULE'; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_steps) x)<>jsonb_array_length(p_steps)
    then raise exception 'INVALID_SCHEDULE'; end if;
  -- Reject foreign IDs, kind changes and attempts to edit past/current steps before deleting anything.
  for item in select * from jsonb_array_elements(p_steps) loop
    sid := (item->>'id')::uuid;
    if sid is null or item->>'kind' not in ('wine','break') or item->>'kind' is null then raise exception 'INVALID_SCHEDULE'; end if;
    select * into previous from private.tasting_steps where id=sid;
    if found and (previous.game_id<>p_game_id or previous.position<=n or previous.kind<>item->>'kind')
      then raise exception 'STEP_LOCKED'; end if;
  end loop;
  delete from public.rounds r where r.game_id=p_game_id and r.status='pending'
    and not exists(select 1 from jsonb_array_elements(p_steps) x where x->>'id'=r.id::text);
  delete from private.tasting_steps s where s.game_id=p_game_id and s.kind='break' and s.break_status='pending'
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
      insert into private.tasting_steps(id,game_id,position,kind,seconds,title,message)
        values(sid,p_game_id,n,'break',sec,btrim(item->>'title'),coalesce(item->>'message',''))
        on conflict(id) do update set position=excluded.position,seconds=excluded.seconds,title=excluded.title,message=excluded.message;
    end if;
  end loop;
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
  result uuid := p_game_id; t timestamptz; closed_count integer; event_name text;
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
    select count(*) into closed_count from public.rounds where game_id=p_game_id and status='closed';
    if p_action='reveal' then
      if closed_count=0 or (closed_count<g.reveal_every and exists(select 1 from public.rounds where game_id=p_game_id and status='pending')) then raise exception 'BLOCK_INCOMPLETE'; end if;
      insert into public.revealed_wines(round_id,game_id,name,price_huf,alcohol_tenths)
        select w.round_id,w.game_id,w.name,w.price_huf,w.alcohol_tenths from public.wine_secrets w
        join public.rounds x on x.id=w.round_id where x.game_id=p_game_id and x.status='closed';
      update public.rounds set status='revealed' where game_id=p_game_id and status='closed';
      update private.tasting_steps set break_status='done' where game_id=p_game_id and break_status='open';
      update public.games set status='reveal' where id=p_game_id;
    elsif p_action='finish' then
      if exists(select 1 from public.rounds where game_id=p_game_id and status<>'revealed') or exists(
        select 1 from private.tasting_steps where game_id=p_game_id and kind='break' and break_status='pending') then raise exception 'STEPS_REMAIN'; end if;
      update private.tasting_steps set break_status='done' where game_id=p_game_id and break_status='open';
      update public.games set status='finished' where id=p_game_id;
    else
      select x.* into s from private.tasting_steps x left join public.rounds q on q.id=x.round_id
        where x.game_id=p_game_id and ((x.kind='wine' and q.status='pending') or (x.kind='break' and x.break_status='pending'))
        order by x.position limit 1;
      if s.id is null then raise exception 'NO_NEXT_STEP'; end if;
      if s.kind='wine' and closed_count>=g.reveal_every then raise exception 'REVEAL_REQUIRED'; end if;
      if not exists(select 1 from public.rounds where game_id=p_game_id) or exists(select 1 from public.rounds q where q.game_id=p_game_id
        and not exists(select 1 from public.wine_secrets w where w.round_id=q.id)) then raise exception 'WINES_INCOMPLETE'; end if;
      update private.tasting_steps set break_status='done' where game_id=p_game_id and break_status='open';
      if s.kind='wine' then
        update public.rounds set status='open',opened_at=t,closes_at=case when s.seconds>0 then t+make_interval(secs=>s.seconds) end where id=s.round_id;
        update public.games set status='tasting' where id=p_game_id;
        event_name:='round_started';
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

create or replace function public.submit_rating(
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
  if v_round.closes_at is not null and clock_timestamp() >= v_round.closes_at then raise exception 'DEADLINE_PASSED'; end if;
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
      'opened_at', r.opened_at, 'closes_at', r.closes_at,
      'eligible', exists(select 1 from public.participants p where p.game_id = p_game_id
        and p.user_id = auth.uid() and p.joined_at <= r.opened_at),
      'can_submit', r.status = 'open' and (r.closes_at is null or r.closes_at > statement_timestamp())
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

revoke all on function private.round_snapshot(uuid) from public,anon,authenticated;
commit;
