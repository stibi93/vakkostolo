import { isUuid } from '../games/model';
import { isInviteToken } from './model';

/** Same shape as an invite token: 32 random bytes, base64url, no padding. */
export function newSeatSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export const isSeatSecret = (value: unknown): value is string => isInviteToken(value);

interface StoredSeat { secret: string; token?: string }
const gameKey = (gameId: string) => `vakkostolo:seat:${gameId}`;
const tokenKey = (token: string) => `vakkostolo:seat-token:${token}`;

function readJson(storage: Storage, key: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function readSeatSecret(storage: Storage, gameId: string): string | null {
  if (!isUuid(gameId)) return null;
  const row = readJson(storage, gameKey(gameId));
  return row && isSeatSecret(row.secret) ? row.secret : null;
}

export function readSeatByToken(storage: Storage, token: string): { gameId: string; secret: string } | null {
  if (!isInviteToken(token)) return null;
  const row = readJson(storage, tokenKey(token));
  if (!row || !isUuid(row.gameId) || !isSeatSecret(row.secret)) return null;
  return { gameId: row.gameId, secret: row.secret };
}

/** Only the hash of `secret` is stored on the server. Losing this browser value loses the seat key. */
export function rememberSeat(storage: Storage, seat: { gameId: string; secret: string; token?: string }) {
  if (!isUuid(seat.gameId) || !isSeatSecret(seat.secret)) return;
  const previous = readJson(storage, gameKey(seat.gameId));
  const token = seat.token ?? (previous && isInviteToken(previous.token) ? previous.token : undefined);
  try {
    storage.setItem(gameKey(seat.gameId), JSON.stringify({ secret: seat.secret, ...(token ? { token } : {}) }));
    if (token) storage.setItem(tokenKey(token), JSON.stringify({ gameId: seat.gameId, secret: seat.secret }));
  } catch {
    // Private browsing may block storage; the current login still works until it is gone.
  }
}

export function forgetSeat(storage: Storage, gameId: string) {
  const row = readJson(storage, gameKey(gameId)) as StoredSeat | null;
  try {
    storage.removeItem(gameKey(gameId));
    if (row && isInviteToken(row.token)) storage.removeItem(tokenKey(row.token));
  } catch {
    // Nothing left to clear.
  }
}
