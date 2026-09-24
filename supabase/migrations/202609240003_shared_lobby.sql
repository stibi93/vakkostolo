begin;

-- One statement snapshot, identical public fields for hosts and members.
create function public.get_lobby_snapshot(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select jsonb_build_object(
    'game', jsonb_build_object('id', g.id, 'title', g.title, 'status', g.status, 'version', g.version),
    'role', case when g.host_id = v_user then 'host' else 'player' end,
    'self_participant_id', (select id from public.participants where game_id = g.id and user_id = v_user),
    'server_now', statement_timestamp(),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nickname', p.nickname, 'joined_at', p.joined_at, 'seat', p.seat) order by p.seat)
      from (select id, nickname, joined_at, row_number() over (order by joined_at, id) as seat
        from public.participants where game_id = g.id) p), '[]'::jsonb)
  ) into v_result from public.games g
  where g.id = p_game_id and (g.host_id = v_user or exists (
    select 1 from public.participants p where p.game_id = g.id and p.user_id = v_user));
  if v_result is null then raise exception 'GAME_NOT_FOUND'; end if;
  return v_result;
end;
$$;
revoke all on function public.get_lobby_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.get_lobby_snapshot(uuid) to authenticated;

-- Supabase supplies this publication; plain PostgreSQL/PGlite needs it created.
-- Never publish wine_secrets, ratings, game_invites or game_events.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'participants') then
    alter publication supabase_realtime add table public.participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'games') then
    alter publication supabase_realtime add table public.games;
  end if;
end;
$$;
commit;
