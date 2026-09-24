import { LobbyError, lobbyErrorMessage } from './api';
import type { LobbyApi, LobbyConnection, LobbySnapshot } from './model';

export interface LobbyState {
  snapshot: LobbySnapshot | null; loading: boolean; stale: boolean;
  error: string | null; connection: LobbyConnection;
}
/** Each mounted game owns a store. Events only invalidate; RPC snapshots are authoritative. */
export function createLobbyStore(api: LobbyApi, gameId: string) {
  let state: LobbyState = { snapshot: null, loading: true, stale: false, error: null, connection: 'connecting' };
  const listeners = new Set<() => void>();
  let active = false, online = true, busy = false, queued = false, generation = 0;
  let unwatch: (() => void) | undefined;
  function update(patch: Partial<LobbyState>) {
    state = { ...state, ...patch }; listeners.forEach((listener) => listener());
  }
  async function refresh() {
    if (!active || !online) return;
    if (busy) { queued = true; return; }
    busy = true;
    const current = generation;
    update({ loading: true });
    try {
      const snapshot = await api.get(gameId);
      if (active && generation === current) update({ snapshot, error: null, stale: false });
    } catch (error) {
      if (active && generation === current) update({ error: lobbyErrorMessage(error), stale: true,
        ...(error instanceof LobbyError && error.accessLost ? { snapshot: null } : {}) });
    } finally {
      if (generation === current) {
        busy = false;
        if (active) { update({ loading: false }); if (queued) { queued = false; void refresh(); } }
      }
    }
  }
  function invalidate() {
    if (!active) return;
    generation++; busy = false; queued = false;
    update({ snapshot: null, loading: false, stale: true, error: null });
    void refresh();
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    refresh,
    start() {
      active = true;
      unwatch = api.watch(gameId, () => void refresh(), (connection) => {
        if (active && online) update({ connection });
      }, invalidate);
      void refresh();
    },
    setOnline(value: boolean) {
      online = value;
      if (!value) {
        generation++; busy = false; queued = false;
        update({ loading: false, stale: true, connection: 'offline' });
      } else { update({ connection: 'fallback' }); void refresh(); }
    },
    dispose() { active = false; generation++; busy = false; queued = false; unwatch?.(); },
  };
}
