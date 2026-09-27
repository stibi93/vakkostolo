begin;

-- Device key for an anonymous seat. Not on public.participants: that table is
-- readable by every member and published to Realtime, so the hash must stay private.
create table private.participant_reclaims (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  game_id uuid not null,
  reclaim_hash text not null check (reclaim_hash ~ '^[a-f0-9]{64}$'),
  unique (reclaim_hash)
);
revoke all on table private.participant_reclaims from public, anon, authenticated;

-- Caller must already hold a lock on the game row. Returns the seat to keep using,
-- or NULL when this login should become a new participant. Does not change joined_at.
create function private.reclaim_seat(p_game_id uuid, p_user uuid, p_reclaim text)
returns public.participants language plpgsql security definer set search_path = '' as $$
declare
  v_hash text := case when p_reclaim ~ '^[A-Za-z0-9_-]{43}$' then private.invite_hash(p_reclaim) else null end;
  v_self public.participants%rowtype;
  v_seat public.participants%rowtype;
  v_anonymous boolean;
begin
  select * into v_self from public.participants where game_id = p_game_id and user_id = p_user;
  if v_hash is not null then
    select p.* into v_seat from public.participants p
      join private.participant_reclaims r on r.participant_id = p.id
      where p.game_id = p_game_id and r.reclaim_hash = v_hash;
  end if;
  if v_self.id is not null and (v_seat.id is null or v_seat.id = v_self.id) then
    if v_hash is not null and not exists (
      select 1 from private.participant_reclaims where participant_id = v_self.id
    ) then
      insert into private.participant_reclaims(participant_id, game_id, reclaim_hash)
        values (v_self.id, p_game_id, v_hash) on conflict (reclaim_hash) do nothing;
    end if;
    return v_self;
  end if;
  if v_seat.id is null then return null; end if;
  -- A second seat that already stored answers stays; an empty duplicate yields to the saved seat.
  if v_self.id is not null and exists (select 1 from public.ratings where participant_id = v_self.id) then
    return v_self;
  end if;
  select is_anonymous into v_anonymous from auth.users where id = v_seat.user_id;
  if v_anonymous is not true then raise exception 'RECLAIM_DENIED'; end if;
  if v_self.id is not null then delete from public.participants where id = v_self.id; end if;
  update public.participants set user_id = p_user where id = v_seat.id;
  select * into v_seat from public.participants where id = v_seat.id;
  return v_seat;
end;
$$;
revoke all on function private.reclaim_seat(uuid, uuid, text) from public, anon, authenticated;

create function private.membership_json(p_game public.games, p_participant public.participants, p_reclaim text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_hash text := case when p_reclaim ~ '^[A-Za-z0-9_-]{43}$' then private.invite_hash(p_reclaim) else null end;
begin
  return jsonb_build_object('game_id', p_game.id, 'participant_id', p_participant.id,
    'nickname', p_participant.nickname, 'title', p_game.title, 'status', p_game.status,
    'reclaim_saved', v_hash is not null and exists (select 1 from private.participant_reclaims r
      where r.participant_id = p_participant.id and r.reclaim_hash = v_hash));
end;
$$;
revoke all on function private.membership_json(public.games, public.participants, text) from public, anon, authenticated;

drop function public.join_game(text, text);
create function public.join_game(p_token text, p_nickname text default null, p_reclaim text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_participant public.participants%rowtype;
  v_nickname text := nullif(btrim(p_nickname), '');
  v_hash text := case when p_reclaim ~ '^[A-Za-z0-9_-]{43}$' then private.invite_hash(p_reclaim) else null end;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'INVITE_INVALID'; end if;
  select g.* into v_game from public.game_invites i join public.games g on g.id = i.game_id
    where i.token_hash = private.invite_hash(p_token) and i.expires_at > clock_timestamp()
    for update of g;
  if not found then raise exception 'INVITE_INVALID'; end if;
  if v_game.host_id = v_user then raise exception 'HOST_CANNOT_JOIN'; end if;
  v_participant := private.reclaim_seat(v_game.id, v_user, p_reclaim);
  if v_participant is not null then
    return private.membership_json(v_game, v_participant, p_reclaim);
  end if;
  if v_game.status not in ('lobby', 'tasting', 'intermission', 'reveal') then raise exception 'GAME_CLOSED'; end if;
  if v_nickname is null then raise exception 'NICKNAME_REQUIRED'; end if;
  if char_length(v_nickname) > 30 or v_nickname ~ '[[:cntrl:]]' then raise exception 'INVALID_NICKNAME'; end if;
  if (select count(*) from public.participants where game_id = v_game.id) >= 50 then
    raise exception 'GAME_FULL';
  end if;
  insert into public.participants(game_id, user_id, nickname)
    values (v_game.id, v_user, v_nickname) returning * into v_participant;
  if v_hash is not null then
    insert into private.participant_reclaims(participant_id, game_id, reclaim_hash)
      values (v_participant.id, v_game.id, v_hash) on conflict (reclaim_hash) do nothing;
  end if;
  return private.membership_json(v_game, v_participant, p_reclaim);
end;
$$;

-- Same seat after the anonymous login is gone, even when the invite link has expired.
create function public.resume_membership(p_game_id uuid, p_reclaim text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_participant public.participants%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reclaim is null or p_reclaim !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'RECLAIM_INVALID'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'RECLAIM_INVALID'; end if;
  if v_game.host_id = v_user then raise exception 'HOST_CANNOT_JOIN'; end if;
  v_participant := private.reclaim_seat(p_game_id, v_user, p_reclaim);
  if v_participant is null then raise exception 'RECLAIM_INVALID'; end if;
  return private.membership_json(v_game, v_participant, p_reclaim);
end;
$$;

revoke all on function public.join_game(text, text, text), public.resume_membership(uuid, text) from public, anon, authenticated;
grant execute on function public.join_game(text, text, text), public.resume_membership(uuid, text) to authenticated;
commit;
