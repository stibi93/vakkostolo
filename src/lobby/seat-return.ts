import type { InvitesApi } from '../invites/model';
import { newSeatSecret, readSeatSecret } from '../invites/seat';
import { LobbyError } from './api';
import type { LiveApi } from '../live/model';

const attaching = new Set<string>();

/** When this browser still has the seat key, a lost anonymous login is attached again before the lobby loads. */
export function withSeatReturn(api: LiveApi, invites: InvitesApi, storage: Storage): LiveApi {
  return { ...api, async get(gameId) {
    try {
      const snapshot = await api.get(gameId);
      // Save a key while this login still works, so a later lost session can return to the same seat.
      if (snapshot.role === 'player' && !readSeatSecret(storage, gameId) && !attaching.has(gameId)) {
        attaching.add(gameId);
        const secret = newSeatSecret();
        void invites.reclaim(gameId, secret).catch(() => {});
      }
      return snapshot;
    } catch (error) {
      const secret = readSeatSecret(storage, gameId);
      if (!(error instanceof LobbyError) || !error.accessLost || !secret) throw error;
      try {
        await invites.reclaim(gameId, secret);
      } catch {
        throw error;
      }
      return api.get(gameId);
    }
  } };
}
