import { useEffect, useState, useSyncExternalStore } from 'react';
import { createLobbyStore } from './store';
import type { SnapshotApi } from './model';

export function useSnapshot<T>(api: SnapshotApi<T>, gameId: string) {
  const [store] = useState(() => createLobbyStore(api, gameId));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.setOnline(navigator.onLine);
    store.start();
    const refresh = () => { if (document.visibilityState === 'visible') void store.refresh(); };
    const online = () => store.setOnline(true);
    const offline = () => store.setOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
      store.dispose();
    };
  }, [store]);
  return { state, refresh: store.refresh };
}
