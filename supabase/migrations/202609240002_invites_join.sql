begin;

-- 2 × UUIDv4 = 244 random bits, base64url without padding: always 43 characters.
create function private.new_invite_token() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(decode(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex'
  ), 'base64'), '+/=', '-_');
$$;
create function private.invite_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;
revoke all on function private.new_invite_token(), private.invite_hash(text) from public, anon, authenticated;

-- Opens the lobby from draft, otherwise rotates the link. Only the hash is stored,
-- so a lost token cannot be shown again; issuing a new one invalidates the old link.
create function public.issue_invite(p_game_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_host uuid := private.require_permanent_user();
  v_status text;
  v_token text := private.new_invite_token();
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz := clock_timestamp() + interval '12 hours';
begin
  select status into v_status from public.games where id = p_game_id and host_id = v_host for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_status = 'finished' then raise exception 'GAME_FINISHED'; end if;
  if v_status = 'draft' then
    if not exists (select 1 from public.rounds where game_id = p_game_id) or exists (
      select 1 from public.rounds r where r.game_id = p_game_id
        and not exists (select 1 from public.wine_secrets w where w.round_id = r.id)
    ) then raise exception 'WINES_INCOMPLETE'; end if;
    update public.games set status = 'lobby', version = version + 1 where id = p_game_id;
  end if;
  insert into public.game_invites(game_id, token_hash, expires_at, created_at)
    values (p_game_id, private.invite_hash(v_token), v_expires, v_now)
    on conflict (game_id) do update set token_hash = excluded.token_hash,
      expires_at = excluded.expires_at, created_at = excluded.created_at;
  insert into public.game_events(game_id, actor_id, request_id, event_type)
    values (p_game_id, v_host, gen_random_uuid(),
      case when v_status = 'draft' then 'lobby_opened' else 'invite_rotated' end);
  return jsonb_build_object('token', v_token, 'expires_at', v_expires,
    'status', case when v_status = 'draft' then 'lobby' else v_status end);
end;
$$;

-- p_nickname null = resume an existing membership without creating a participant.
create function public.join_game(p_token text, p_nickname text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_participant public.participants%rowtype;
  v_nickname text := nullif(btrim(p_nickname), '');
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Unknown, rotated and expired links are indistinguishable to the caller.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'INVITE_INVALID'; end if;
  select g.* into v_game from public.game_invites i join public.games g on g.id = i.game_id
    where i.token_hash = private.invite_hash(p_token) and i.expires_at > clock_timestamp()
    for update of g;
  if not found then raise exception 'INVITE_INVALID'; end if;
  -- The host knows the wines, so the host cannot compete in their own game.
  if v_game.host_id = v_user then raise exception 'HOST_CANNOT_JOIN'; end if;
  select * into v_participant from public.participants where game_id = v_game.id and user_id = v_user;
  if not found then
    if v_game.status not in ('lobby', 'tasting', 'intermission', 'reveal') then raise exception 'GAME_CLOSED'; end if;
    if v_nickname is null then raise exception 'NICKNAME_REQUIRED'; end if;
    if char_length(v_nickname) > 30 or v_nickname ~ '[[:cntrl:]]' then raise exception 'INVALID_NICKNAME'; end if;
    -- Abuse guard for a private tasting, not a product capacity promise.
    if (select count(*) from public.participants where game_id = v_game.id) >= 50 then
      raise exception 'GAME_FULL';
    end if;
    insert into public.participants(game_id, user_id, nickname)
      values (v_game.id, v_user, v_nickname) returning * into v_participant;
  end if;
  return jsonb_build_object('game_id', v_game.id, 'participant_id', v_participant.id,
    'nickname', v_participant.nickname, 'title', v_game.title, 'status', v_game.status);
end;
$$;

revoke all on function public.issue_invite(uuid), public.join_game(text, text) from public, anon, authenticated;
grant execute on function public.issue_invite(uuid), public.join_game(text, text) to authenticated;
commit;
