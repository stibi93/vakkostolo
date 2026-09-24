begin;

-- Host-only agenda. Neither future transition text nor wine identities are published.
create table private.tasting_steps (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  position integer not null check (position > 0),
  kind text not null check (kind in ('wine','break')),
  round_id uuid unique,
  seconds integer not null check (seconds between 0 and 7200),
  title text not null default '' check (char_length(title) <= 100),
  message text not null default '' check (char_length(message) <= 2000),
  break_status text not null default 'pending' check (break_status in ('pending','open','done')),
  started_at timestamptz,
  ends_at timestamptz,
  foreign key (game_id,round_id) references public.rounds(game_id,id) on delete cascade,
  check ((kind = 'wine' and round_id = id and seconds between 30 and 1800)
    or (kind = 'break' and round_id is null and char_length(btrim(title)) > 0)),
  unique (game_id,position) deferrable initially deferred
);
create unique index one_open_break_per_game on private.tasting_steps(game_id) where break_status = 'open';
create table private.schedule_requests (
  game_id uuid not null references public.games(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  result uuid not null,
  primary key(game_id,request_id)
);
revoke all on private.tasting_steps, private.schedule_requests from public, anon, authenticated;

alter table public.rounds drop constraint rounds_game_id_position_key;
alter table public.rounds add constraint rounds_game_id_position_key unique(game_id,position) deferrable initially deferred;

insert into private.tasting_steps(id,game_id,position,kind,round_id,seconds)
  select r.id,r.game_id,r.position,'wine',r.id,g.round_seconds from public.rounds r join public.games g on g.id=r.game_id;
create function private.add_round_step() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into private.tasting_steps(id,game_id,position,kind,round_id,seconds)
    select new.id,new.game_id,coalesce((select max(position) from private.tasting_steps where game_id=new.game_id),0)+1,
      'wine',new.id,round_seconds from public.games where id=new.game_id;
  return new;
end;
$$;
revoke all on function private.add_round_step() from public,anon,authenticated;
create trigger add_round_step after insert on public.rounds for each row execute function private.add_round_step();

create function public.get_tasting_schedule(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g public.games;
begin
  select * into g from public.games where id=p_game_id and host_id=private.require_permanent_user();
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  return jsonb_build_object('version',g.version,'status',g.status,'reveal_every',g.reveal_every,
    'steps',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'seconds',s.seconds,
      'title',case when s.kind='wine' then w.name else s.title end,'message',s.message,
      'status',case when s.kind='wine' then r.status else s.break_status end,
      'price_huf',w.price_huf,'alcohol_tenths',w.alcohol_tenths,'round_position',r.position)
      order by s.position) from private.tasting_steps s left join public.rounds r on r.id=s.round_id
      left join public.wine_secrets w on w.round_id=s.round_id where s.game_id=p_game_id),'[]'::jsonb));
end;
$$;

-- Only pending steps are supplied. Omission removes a pending step. Started history is immutable.
create function public.save_tasting_schedule(p_game_id uuid,p_expected_version integer,p_request_id uuid,p_steps jsonb)
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
      if sec not between 30 and 1800 then raise exception 'INVALID_SCHEDULE'; end if;
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

create function public.control_tasting(p_game_id uuid,p_expected_version integer,p_request_id uuid,p_action text,p_seconds integer default null)
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
    if p_seconds is null or p_seconds not between 30 and 1800 then raise exception 'INVALID_DURATION'; end if;
    update public.rounds set closes_at=t+make_interval(secs=>p_seconds) where id=r.id;
  elsif p_action='close' then
    if r.id is null then raise exception 'ROUND_NOT_OPEN'; end if;
    update public.rounds set status='closed' where id=r.id;
    update public.games set status='intermission' where id=p_game_id;
  elsif p_action in ('start','next','reveal','finish') then
    if p_action='start' and exists(select 1 from public.rounds where game_id=p_game_id and status<>'pending') then raise exception 'ROUND_ALREADY_STARTED'; end if;
    if r.id is not null then
      if r.closes_at>t then raise exception 'ROUND_STILL_OPEN'; end if;
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
        update public.rounds set status='open',opened_at=t,closes_at=t+make_interval(secs=>s.seconds) where id=s.round_id;
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
create or replace function public.start_round(p_game_id uuid,p_expected_version integer,p_request_id uuid)
returns uuid language sql security definer set search_path='' as $$
  select public.control_tasting(p_game_id,p_expected_version,p_request_id,'start');
$$;

-- Keep the established projection and add only the CURRENT break and explicitly revealed identities.
alter function public.get_game_snapshot(uuid) set schema private;
alter function private.get_game_snapshot(uuid) rename to round_snapshot;
revoke all on function private.round_snapshot(uuid) from public,anon,authenticated;
create function public.get_game_snapshot(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; pause jsonb; revealed jsonb;
begin
  result:=private.round_snapshot(p_game_id);
  select jsonb_build_object('id',id,'title',title,'message',message,'ends_at',ends_at) into pause
    from private.tasting_steps where game_id=p_game_id and kind='break' and break_status='open';
  if pause is not null then result:=result||jsonb_build_object('break',pause,'round',null,'own_rating',null); end if;
  select jsonb_agg(jsonb_build_object('id',w.round_id,'position',r.position,'name',w.name,'price_huf',w.price_huf,
    'alcohol_tenths',w.alcohol_tenths) order by r.position) into revealed from public.revealed_wines w
    join public.rounds r on r.id=w.round_id where w.game_id=p_game_id;
  if revealed is not null then result:=result||jsonb_build_object('revealed',revealed); end if;
  return result;
end;
$$;
revoke all on function public.get_tasting_schedule(uuid),public.save_tasting_schedule(uuid,integer,uuid,jsonb),
  public.control_tasting(uuid,integer,uuid,text,integer),public.get_game_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_tasting_schedule(uuid),public.save_tasting_schedule(uuid,integer,uuid,jsonb),
  public.control_tasting(uuid,integer,uuid,text,integer),public.get_game_snapshot(uuid) to authenticated;
commit;
