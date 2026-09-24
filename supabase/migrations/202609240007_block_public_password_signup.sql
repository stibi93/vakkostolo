-- Auth hook (before_user_created): only the superadmin uses a password, and it is created with
-- the secret key and the superadmin role already in app_metadata (scripts/superadmin.mjs).
-- Public email sign-ups cannot set app_metadata, so they are rejected here; Google and
-- anonymous players are unaffected. Hosted projects enable this under Auth → Hooks.
create function private.before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_meta jsonb := coalesce(event->'user'->'app_metadata', '{}'::jsonb);
begin
  if v_meta->>'provider' = 'email' and v_meta->>'vakkostolo_role' is distinct from 'superadmin' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Nyilvános regisztráció nincs. A játékosok a meghívó linkjével lépnek be.'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function private.before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
