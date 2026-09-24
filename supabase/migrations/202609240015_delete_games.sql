begin;
-- Retained receipt makes retries safe even after the game has gone.
create table private.game_deletion_requests (
 game_id uuid primary key,
 host_id uuid not null references auth.users(id) on delete cascade
);
revoke all on private.game_deletion_requests from public,anon,authenticated;

create function private.can_delete_game_photo(p_bucket text,p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_bucket='wine-photos' and private.is_host_session() and exists(
  select 1 from private.game_deletion_requests d
  where d.host_id=auth.uid() and split_part(p_name,'/',1)=d.game_id::text);
$$;
revoke all on function private.can_delete_game_photo(text,text) from public,anon,authenticated;
grant execute on function private.can_delete_game_photo(text,text) to authenticated;
create policy wine_photos_game_delete on storage.objects for delete to authenticated
 using(private.can_delete_game_photo(bucket_id,name));

-- Storage blobs must be removed through the Storage API, never by SQL metadata deletion.
create function public.delete_game(p_game_id uuid,p_finalize boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=private.require_permanent_user(); g public.games; paths jsonb;
begin
 select * into g from public.games where id=p_game_id and host_id=h for update;
 if not found then
  if exists(select 1 from private.game_deletion_requests where game_id=p_game_id and host_id=h) then return '[]'::jsonb; end if;
  raise exception 'GAME_NOT_FOUND';
 end if;
 if p_finalize is null then raise exception 'INVALID_DELETE_REQUEST'; end if;
 if p_finalize then
  if not exists(select 1 from private.game_deletion_requests where game_id=p_game_id and host_id=h) then raise exception 'DELETE_NOT_PREPARED'; end if;
  if exists(select 1 from storage.objects where bucket_id='wine-photos' and split_part(name,'/',1)=p_game_id::text) then raise exception 'PHOTOS_REMAIN'; end if;
  delete from public.games where id=p_game_id;
  return '[]'::jsonb;
 end if;
 insert into private.game_deletion_requests values(p_game_id,h) on conflict do nothing;
 select coalesce(jsonb_agg(name),'[]'::jsonb) into paths from storage.objects
 where bucket_id='wine-photos' and split_part(name,'/',1)=p_game_id::text;
 return paths;
end;
$$;
revoke all on function public.delete_game(uuid,boolean) from public,anon,authenticated;
grant execute on function public.delete_game(uuid,boolean) to authenticated;
commit;
