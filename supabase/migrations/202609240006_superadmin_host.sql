-- Hosting is limited to superadmin accounts that completed a second factor in this session.
-- Every host RPC already calls this helper, so the rule applies to all of them at once.
-- The role lives in app_metadata, which only the service role can change; players may
-- still use Google or anonymous Auth, but those accounts cannot host.
create or replace function private.require_permanent_user() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_anonymous boolean;
  v_role text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select u.is_anonymous, u.raw_app_meta_data->>'vakkostolo_role' into v_anonymous, v_role
    from auth.users u where u.id = v_user;
  if not found or v_anonymous is not false then raise exception 'PERMANENT_AUTH_REQUIRED'; end if;
  if v_role is distinct from 'superadmin' then raise exception 'HOST_ROLE_REQUIRED'; end if;
  if coalesce(auth.jwt()->>'aal', '') <> 'aal2' then raise exception 'MFA_REQUIRED'; end if;
  return v_user;
end;
$$;
revoke all on function private.require_permanent_user() from public, anon, authenticated;
