import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/lib/database.types';
import { createLobbyApi, LobbyError, parseLobbySnapshot } from '../src/lobby/api';
import type { LobbyApi, LobbySnapshot } from '../src/lobby/model';
import { createLobbyStore } from '../src/lobby/store';

const id = '10000000-0000-0000-0000-000000000001';
const member = '20000000-0000-0000-0000-000000000001';
const raw = { game: { id, title: 'Kóstoló', status: 'lobby', version: 1 }, role: 'player', self_participant_id: member,
  server_now: '2026-09-24T10:00:00Z', participants: [{ id: member, nickname: 'Anna', joined_at: '2026-09-24T09:59:00Z', seat: 1 }] };
const snapshot = parseLobbySnapshot(raw, id);
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
function setup() {
  const get = vi.fn<LobbyApi['get']>().mockResolvedValue(snapshot);
  const dispose = vi.fn();
  let changed!: () => void, auth!: () => void, connection!: Parameters<LobbyApi['watch']>[2];
  const api: LobbyApi = { get, watch: (_id, change, status, session) => {
    changed = change; connection = status; auth = session; return dispose;
  } };
  const store = createLobbyStore(api, id);
  store.start();
  return { store, get, dispose, changed: () => changed(), auth: () => auth(), live: () => connection('live') };
}
describe('váró adatadapter', () => {
  it('csak a megengedett mezőket adja tovább', () => {
    expect(parseLobbySnapshot({ ...raw, wines: ['secret'], game: { ...raw.game, host_id: 'hidden' },
      participants: [{ ...raw.participants[0], user_id: 'private' }] }, id)).toEqual(snapshot);
  });
  it.each([null, {}, { ...raw, role: 'admin' }, { ...raw, participants: [] },
    { ...raw, participants: [raw.participants[0], raw.participants[0]] },
    { ...raw, participants: [{ ...raw.participants[0], seat: 2 }] },
    { ...raw, game: { ...raw.game, id: member } }, { ...raw, game: { ...raw.game, status: '__proto__' } },
    { ...raw, server_now: 'bad' }, { ...raw, self_participant_id: id }, { ...raw, role: 'host' }])('hibás válasz elutasítva (%#)', (value) => {
    expect(() => parseLobbySnapshot(value, id)).toThrow(LobbyError);
  });
  it('valódi SDK RPC: idegen játék és lejárt munkamenet hozzáférésvesztés', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ message: 'GAME_NOT_FOUND' }), { status: 400 }));
    const api = createLobbyApi(createClient<Database>('https://unit.example.test', 'public-fixture', {
      global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
    await expect(api.get(id)).rejects.toMatchObject({ accessLost: true });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ p_game_id: id });
    await expect(api.get('wrong')).rejects.toMatchObject({ accessLost: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe('váró frissítés és visszatérés', () => {
  it('Realtime csatlakozás és esemény az RPC válaszát használja', async () => {
    const s = setup(); await tick(); s.live();
    s.get.mockResolvedValue({ ...snapshot, game: { ...snapshot.game, version: 2 } });
    s.changed(); await tick();
    expect(s.store.getSnapshot().snapshot?.game.version).toBe(2);
    expect(s.store.getSnapshot().connection).toBe('live'); s.store.dispose(); expect(s.dispose).toHaveBeenCalledOnce();
  });
  it('eseményvihar egy függő kérés mögé csak egy új frissítést tesz', async () => {
    const s = setup(); await tick(); const pending = deferred<LobbySnapshot>();
    s.get.mockReturnValueOnce(pending.promise); s.changed(); s.changed(); s.changed();
    expect(s.get).toHaveBeenCalledTimes(2); pending.resolve(snapshot); await tick(); await tick();
    expect(s.get).toHaveBeenCalledTimes(3); s.store.dispose();
  });
  it('hálózati hibánál jelöli a régi listát és újrapróbálással helyreáll', async () => {
    const s = setup(); await tick(); s.get.mockRejectedValueOnce(new Error('network'));
    await s.store.refresh(); expect(s.store.getSnapshot()).toMatchObject({ snapshot, stale: true });
    await s.store.refresh(); expect(s.store.getSnapshot()).toMatchObject({ snapshot, stale: false, error: null }); s.store.dispose();
  });
  it('jogvesztéskor a korábbi lista eltűnik', async () => {
    const s = setup(); await tick(); s.get.mockRejectedValueOnce(new LobbyError('Nincs hozzáférés', true));
    await s.store.refresh(); expect(s.store.getSnapshot().snapshot).toBeNull(); s.store.dispose();
  });
  it('Auth-váltás törli a listát, és az előző kérés késői válaszát eldobja', async () => {
    const s = setup(); await tick(); const old = deferred<LobbySnapshot>();
    s.get.mockReturnValueOnce(old.promise); s.changed();
    s.get.mockRejectedValueOnce(new LobbyError('Kiléptél', true)); s.auth(); await tick();
    old.resolve(snapshot); await tick();
    expect(s.store.getSnapshot().snapshot).toBeNull(); s.store.dispose();
  });
  it('offline állapot nem kér le és a korábbi válasz sem mutathat friss kapcsolatot', async () => {
    const s = setup(); await tick(); const old = deferred<LobbySnapshot>(); s.get.mockReturnValueOnce(old.promise); s.changed();
    s.store.setOnline(false); old.resolve(snapshot); await tick();
    expect(s.store.getSnapshot()).toMatchObject({ stale: true, connection: 'offline' });
    await s.store.refresh(); expect(s.get).toHaveBeenCalledTimes(2);
    s.store.setOnline(true); await tick(); expect(s.store.getSnapshot().stale).toBe(false); s.store.dispose();
  });
  it('lecsatolás után késői válasz nem értesíti a felületet', async () => {
    const s = setup(); await tick(); const pending = deferred<LobbySnapshot>(); s.get.mockReturnValueOnce(pending.promise);
    s.changed(); const listener = vi.fn(); s.store.subscribe(listener); s.store.dispose(); pending.resolve(snapshot); await tick();
    expect(listener).not.toHaveBeenCalled();
  });
});

it('azonos Auth-fiók háttérből visszatérése nem töröl piszkozatot; fiókváltás és kilépés igen', () => {
  vi.useFakeTimers();
  try {
    let auth!: (event: string, session: { user: { id: string } } | null) => void;
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    const unsubscribe = vi.fn();
    const client = { channel: () => channel, removeChannel: vi.fn(), auth: {
      onAuthStateChange(callback: typeof auth) { auth = callback; return { data: { subscription: { unsubscribe } } }; },
    } } as unknown as SupabaseClient<Database>;
    const changed = vi.fn(), sessionChanged = vi.fn();
    const stop = createLobbyApi(client).watch(id, changed, vi.fn(), sessionChanged);
    auth('INITIAL_SESSION', { user: { id: member } });
    auth('SIGNED_IN', { user: { id: member } });
    auth('TOKEN_REFRESHED', { user: { id: member } });
    vi.runAllTimers();
    expect(changed).toHaveBeenCalledTimes(2); expect(sessionChanged).not.toHaveBeenCalled();
    auth('SIGNED_IN', { user: { id } }); vi.runAllTimers();
    expect(sessionChanged).toHaveBeenCalledTimes(1);
    auth('SIGNED_OUT', null); vi.runAllTimers(); expect(sessionChanged).toHaveBeenCalledTimes(2);
    stop(); auth('SIGNED_IN', { user: { id } }); vi.runAllTimers();
    expect(sessionChanged).toHaveBeenCalledTimes(2); expect(unsubscribe).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
