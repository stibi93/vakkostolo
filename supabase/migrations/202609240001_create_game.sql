begin;

-- Idempotency records are private; no wine payload is duplicated here.
create table private.game_creation_requests (
  host_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  game_id uuid not null references public.games(id) on delete cascade,
  payload_hash bytea not null,
  primary key (host_id, request_id)
);
revoke all on private.game_creation_requests from public, anon, authenticated;

create function private.require_permanent_user() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- The canonical Auth row, not user-editable metadata or a client-supplied role.
  if not exists (select 1 from auth.users where id = v_user and is_anonymous is false) then
    raise exception 'PERMANENT_AUTH_REQUIRED';
  end if;
  return v_user;
end;
$$;
revoke all on function private.require_permanent_user() from public, anon, authenticated;

create function public.create_game(
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
  if p_round_seconds is null or p_round_seconds not between 30 and 1800
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

create function public.list_host_games() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_host uuid := private.require_permanent_user();
begin
  return coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at desc, g.id) from (
    select id, title, status, round_seconds, reveal_every, created_at
      from public.games where host_id = v_host order by created_at desc, id limit 100
  ) g), '[]'::jsonb);
end;
$$;

-- A host-only DTO. This is deliberately not the future player snapshot API.
create function public.get_host_game(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_host uuid := private.require_permanent_user();
  v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = p_game_id and host_id = v_host;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  return jsonb_build_object('id', v_game.id, 'title', v_game.title, 'status', v_game.status,
    'round_seconds', v_game.round_seconds, 'reveal_every', v_game.reveal_every,
    'created_at', v_game.created_at, 'wines', coalesce((
      select jsonb_agg(jsonb_build_object('position', r.position, 'name', w.name,
        'price_huf', w.price_huf, 'alcohol_tenths', w.alcohol_tenths) order by r.position)
      from public.rounds r join public.wine_secrets w on w.round_id = r.id and w.game_id = r.game_id
      where r.game_id = v_game.id
    ), '[]'::jsonb));
end;
$$;

revoke all on function public.create_game(uuid, text, integer, integer, jsonb),
  public.list_host_games(), public.get_host_game(uuid) from public, anon, authenticated;
grant execute on function public.create_game(uuid, text, integer, integer, jsonb),
  public.list_host_games(), public.get_host_game(uuid) to authenticated;
commit;
