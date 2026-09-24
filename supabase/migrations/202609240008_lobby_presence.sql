-- Lobby presence on the private Realtime channel `game:<uuid>:presence`.
-- Members may announce themselves; the host and members may see who is online.
-- Presence is display only: it never decides membership, scoring or deadlines.

create function private.presence_game_id(p_topic text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_topic ~ '^game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:presence$'
    then substring(p_topic from 6 for 36)::uuid end;
$$;
revoke all on function private.presence_game_id(text) from public, anon, authenticated;
grant execute on function private.presence_game_id(text) to authenticated;

create policy lobby_presence_read on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'presence'
  and (private.is_host(private.presence_game_id(realtime.topic()))
    or private.is_member(private.presence_game_id(realtime.topic())))
);

create policy lobby_presence_track on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'presence'
  and private.is_member(private.presence_game_id(realtime.topic()))
);
