import { URL } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';

/** Test/type-generation Auth adapter; not a replacement for the Supabase Auth schema. */
export async function loadDatabase(db) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role supabase_auth_admin nologin;
    create schema auth;
    create table auth.users (id uuid primary key, is_anonymous boolean not null default false,
      raw_app_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_strip_nulls(jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
        'aal', nullif(current_setting('request.jwt.claim.aal', true), '')))
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
    create schema realtime;
    create table realtime.messages (id uuid primary key default gen_random_uuid(), topic text not null,
      extension text not null, event text, payload jsonb, private boolean default false);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$
      select nullif(current_setting('realtime.topic', true), '')
    $$;
    grant usage on schema realtime to anon, authenticated;
    grant select, insert on realtime.messages to authenticated;
    grant execute on function realtime.topic() to anon, authenticated;
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, directory), 'utf8'));
  }
}
