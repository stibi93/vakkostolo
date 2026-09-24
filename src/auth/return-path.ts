const key = 'vakkostolo:auth:return';

/** Only invite pages may be resumed after a player's Google sign-in; never an arbitrary URL. */
const allowed = /^\/join\/[A-Za-z0-9_-]{43}$/;

export function rememberReturnPath(storage: Storage, path: string) {
  if (!allowed.test(path)) return;
  try { storage.setItem(key, path); } catch { /* storage blocked: the player lands on the home page */ }
}
/** Read-only so a double render cannot lose it; the invite page clears it once shown. */
export function readReturnPath(storage: Storage): string | null {
  try {
    const path = storage.getItem(key);
    return path && allowed.test(path) ? path : null;
  } catch {
    return null;
  }
}
export function clearReturnPath(storage: Storage) {
  try { storage.removeItem(key); } catch { /* nothing to clear */ }
}
