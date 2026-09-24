-- Lets a guest confirm which tasting a link belongs to before creating an anonymous user.
-- Returns only the title and whether new players may still join: no ids, host or wine data.
create function public.preview_invite(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_game public.games%rowtype;
begin
  -- Same checks as join_game: unknown, rotated and expired links are indistinguishable.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'INVITE_INVALID'; end if;
  select g.* into v_game from public.game_invites i join public.games g on g.id = i.game_id
    where i.token_hash = private.invite_hash(p_token) and i.expires_at > clock_timestamp();
  if not found then raise exception 'INVITE_INVALID'; end if;
  return jsonb_build_object('title', v_game.title,
    'joinable', v_game.status in ('lobby', 'tasting', 'intermission', 'reveal'));
end;
$$;

revoke all on function public.preview_invite(text) from public, anon, authenticated;
grant execute on function public.preview_invite(text) to anon, authenticated;
