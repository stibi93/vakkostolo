-- Wine photos live in the private `wine-photos` Storage bucket at `<game_id>/<round_id>.jpg`.
-- A photo usually identifies the wine, so it follows the wine_secrets boundary: only the
-- host session may manage or view it before the round is revealed; members may view it
-- only after reveal, and it can no longer change once revealed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wine-photos', 'wine-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.is_host_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2' and exists (
    select 1 from auth.users u where u.id = auth.uid() and u.is_anonymous is false
      and u.raw_app_meta_data->>'vakkostolo_role' = 'superadmin');
$$;

create function private.wine_photo_round(p_bucket text, p_name text) returns public.rounds
language plpgsql stable security definer set search_path = '' as $$
declare
  v_round public.rounds%rowtype;
begin
  if p_bucket is distinct from 'wine-photos' or p_name !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  then return null; end if;
  select * into v_round from public.rounds r
    where r.game_id = substring(p_name from 1 for 36)::uuid and r.id = substring(p_name from 38 for 36)::uuid;
  return case when found then v_round end;
end;
$$;

create function private.can_manage_wine_photo(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_round public.rounds := private.wine_photo_round(p_bucket, p_name);
begin
  return v_round.id is not null and v_round.status <> 'revealed'
    and private.is_host_session() and private.is_host(v_round.game_id);
end;
$$;

create function private.can_view_wine_photo(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_round public.rounds := private.wine_photo_round(p_bucket, p_name);
begin
  if v_round.id is null then return false; end if;
  if private.is_host(v_round.game_id) then return private.is_host_session(); end if;
  return v_round.status = 'revealed' and private.is_member(v_round.game_id);
end;
$$;

revoke all on function private.is_host_session(), private.wine_photo_round(text, text),
  private.can_manage_wine_photo(text, text), private.can_view_wine_photo(text, text)
  from public, anon, authenticated;
grant execute on function private.can_manage_wine_photo(text, text),
  private.can_view_wine_photo(text, text) to authenticated;

create policy wine_photos_read on storage.objects for select to authenticated
  using (private.can_view_wine_photo(bucket_id, name));
create policy wine_photos_insert on storage.objects for insert to authenticated
  with check (private.can_manage_wine_photo(bucket_id, name));
create policy wine_photos_update on storage.objects for update to authenticated
  using (private.can_manage_wine_photo(bucket_id, name))
  with check (private.can_manage_wine_photo(bucket_id, name));
create policy wine_photos_delete on storage.objects for delete to authenticated
  using (private.can_manage_wine_photo(bucket_id, name));

create or replace function public.get_host_game(p_game_id uuid) returns jsonb
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
      select jsonb_agg(jsonb_build_object('position', r.position, 'round_id', r.id, 'name', w.name,
        'price_huf', w.price_huf, 'alcohol_tenths', w.alcohol_tenths,
        'photo_updated_at', (select o.updated_at from storage.objects o
          where o.bucket_id = 'wine-photos' and o.name = r.game_id || '/' || r.id || '.jpg'),
        'photo_locked', r.status = 'revealed') order by r.position)
      from public.rounds r join public.wine_secrets w on w.round_id = r.id and w.game_id = r.game_id
      where r.game_id = v_game.id
    ), '[]'::jsonb));
end;
$$;
