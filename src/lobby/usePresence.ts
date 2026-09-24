import { useEffect, useState } from 'react';
import type { LobbySnapshot } from './model';
import type { PresenceApi, PresenceView } from './presence';

/** Players announce themselves once their membership is known; hosts and projectors only watch. */
export function usePresence(api: PresenceApi | undefined, gameId: string, snapshot: LobbySnapshot | null) {
  const ready = !!snapshot, self = snapshot?.selfParticipantId ?? null;
  const [view, setView] = useState<PresenceView | null>(null);
  useEffect(() => (api && ready ? api.watch(gameId, self, setView) : undefined), [api, gameId, ready, self]);
  return api && ready ? view : null;
}
