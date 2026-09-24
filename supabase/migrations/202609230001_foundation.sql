-- Foundation only: host lifecycle/join/reveal RPCs follow in separate migrations.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  status text not null default 'draft'
    check (status in ('draft', 'lobby', 'tasting', 'intermission', 'reveal', 'finished')),
  reveal_every smallint not null default 2 check (reveal_every between 1 and 12),
  round_seconds integer not null default 120 check (round_seconds between 30 and 1800),
  scoring_version smallint not null default 1 check (scoring_version = 1),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 30),
  joined_at timestamptz not null default now(),
  unique (game_id, user_id),
  unique (game_id, id)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  position smallint not null check (position between 1 and 12),
  status text not null default 'pending' check (status in ('pending', 'open', 'closed', 'revealed')),
  opened_at timestamptz,
  closes_at timestamptz,
  unique (game_id, position),
  unique (game_id, id),
  check (status = 'pending' or (opened_at is not null and closes_at is not null)),
  check (closes_at is null or opened_at is null or closes_at > opened_at)
);
create unique index one_open_round_per_game on public.rounds(game_id) where status = 'open';

create table public.wine_secrets (
  round_id uuid primary key,
  game_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  price_huf integer not null check (price_huf between 1 and 1000000),
  alcohol_tenths smallint not null check (alcohol_tenths between 0 and 250),
  foreign key (game_id, round_id) references public.rounds(game_id, id) on delete cascade
);

create table public.revealed_wines (
  round_id uuid primary key,
  game_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  price_huf integer not null check (price_huf between 1 and 1000000),
  alcohol_tenths smallint not null check (alcohol_tenths between 0 and 250),
  revealed_at timestamptz not null default now(),
  foreign key (game_id, round_id) references public.rounds(game_id, id) on delete cascade
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  round_id uuid not null,
  participant_id uuid not null,
  price_huf integer not null check (price_huf between 0 and 1000000),
  alcohol_tenths smallint not null check (alcohol_tenths between 0 and 250),
  liking smallint not null check (liking between 1 and 10),
  submitted_at timestamptz not null default clock_timestamp(),
  foreign key (game_id, round_id) references public.rounds(game_id, id) on delete cascade,
  foreign key (game_id, participant_id) references public.participants(game_id, id) on delete cascade,
  unique (round_id, participant_id)
);

create table public.game_invites (
  game_id uuid primary key references public.games(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  event_type text not null,
  created_at timestamptz not null default now(),
  unique (game_id, request_id)
);

create index games_host_idx on public.games(host_id);
create index participants_user_idx on public.participants(user_id);
create index ratings_participant_idx on public.ratings(game_id, participant_id);
create index ratings_game_idx on public.ratings(game_id, round_id);
create index wine_secrets_game_idx on public.wine_secrets(game_id);
create index revealed_wines_game_idx on public.revealed_wines(game_id);
create index game_events_actor_idx on public.game_events(actor_id);

create function private.is_host(p_game_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.games where id = p_game_id and host_id = auth.uid());
$$;
create function private.is_member(p_game_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.participants where game_id = p_game_id and user_id = auth.uid());
$$;
revoke all on function private.is_host(uuid), private.is_member(uuid) from public, anon, authenticated;
grant execute on function private.is_host(uuid), private.is_member(uuid) to authenticated;

alter table public.games enable row level security;
alter table public.participants enable row level security;
alter table public.rounds enable row level security;
alter table public.wine_secrets enable row level security;
alter table public.revealed_wines enable row level security;
alter table public.ratings enable row level security;
alter table public.game_invites enable row level security;
alter table public.game_events enable row level security;

revoke all on table public.games, public.participants, public.rounds, public.wine_secrets,
  public.revealed_wines, public.ratings, public.game_invites, public.game_events
  from public, anon, authenticated;
grant select on table public.games, public.participants, public.rounds, public.wine_secrets,
  public.revealed_wines, public.ratings, public.game_invites, public.game_events to authenticated;

create policy games_read on public.games for select to authenticated
  using (private.is_host(id) or private.is_member(id));
create policy participants_read on public.participants for select to authenticated
  using (private.is_host(game_id) or private.is_member(game_id));
create policy rounds_read on public.rounds for select to authenticated
  using (private.is_host(game_id) or private.is_member(game_id));
create policy wine_secrets_host_only on public.wine_secrets for select to authenticated
  using (private.is_host(game_id));
create policy revealed_wines_read on public.revealed_wines for select to authenticated
  using ((private.is_host(game_id) or private.is_member(game_id)) and exists (
    select 1 from public.rounds r where r.id = round_id and r.status = 'revealed'
  ));
create policy ratings_read on public.ratings for select to authenticated
  using (
    exists (select 1 from public.participants p where p.id = participant_id and p.user_id = auth.uid())
    or ((private.is_member(game_id) or private.is_host(game_id)) and exists (
      select 1 from public.rounds r where r.id = round_id and r.status = 'revealed'
    ))
  );
create policy game_invites_host_only on public.game_invites for select to authenticated
  using (private.is_host(game_id));
create policy game_events_host_only on public.game_events for select to authenticated
  using (private.is_host(game_id));

create function public.submit_rating(
  p_round_id uuid, p_price_huf integer, p_alcohol_tenths integer, p_liking integer
) returns public.ratings
language plpgsql security definer set search_path = '' as $$
declare
  v_game_id uuid;
  v_game_status text;
  v_participant_id uuid;
  v_round public.rounds;
  v_result public.ratings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select game_id into v_game_id from public.rounds where id = p_round_id;
  if not found then raise exception 'ROUND_NOT_FOUND'; end if;
  select id into v_participant_id from public.participants
    where game_id = v_game_id and user_id = auth.uid();
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;

  -- All lifecycle RPCs must acquire locks in this same order: game, then round.
  select status into v_game_status from public.games where id = v_game_id for update;
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_game_status <> 'tasting' or v_round.status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;
  if v_round.closes_at is null or clock_timestamp() >= v_round.closes_at then
    raise exception 'DEADLINE_PASSED';
  end if;
  insert into public.ratings (game_id, round_id, participant_id, price_huf, alcohol_tenths, liking)
    values (v_game_id, p_round_id, v_participant_id, p_price_huf, p_alcohol_tenths, p_liking)
    on conflict (round_id, participant_id) do update set
      price_huf = excluded.price_huf,
      alcohol_tenths = excluded.alcohol_tenths,
      liking = excluded.liking,
      submitted_at = clock_timestamp()
    returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.submit_rating(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.submit_rating(uuid, integer, integer, integer) to authenticated;

commit;
