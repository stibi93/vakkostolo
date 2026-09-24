import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { GameStatus } from '../domain/game';
import { gameStatusLabels, isUuid } from '../games/model';
import type { LobbyApi, LobbySnapshot } from './model';

// Only a local channel name, never a credential; works on development LAN HTTP too.
let channelSequence = 0;

export class LobbyError extends Error {
  constructor(message: string, readonly accessLost = false) { super(message); }
}
function invalid(): never { throw new LobbyError('A váró válasza nem értelmezhető. Próbáld újra.'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) return invalid();
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return invalid();
  return value;
}
export function parseLobbySnapshot(value: unknown, gameId: string): LobbySnapshot {
  const row = record(value), game = record(row.game);
  if (!isUuid(game.id) || game.id !== gameId || typeof game.status !== 'string' ||
    !Object.hasOwn(gameStatusLabels, game.status) || !Number.isSafeInteger(game.version) || Number(game.version) < 0 ||
    !['host', 'player'].includes(String(row.role)) || !Array.isArray(row.participants) || row.participants.length > 50) return invalid();
  const seen = new Set<string>();
  const participants = row.participants.map((value, index) => {
    const p = record(value);
    if (!isUuid(p.id) || seen.has(p.id) || p.seat !== index + 1) return invalid();
    seen.add(p.id);
    return { id: p.id, nickname: text(p.nickname, 30), joinedAt: timestamp(p.joined_at), seat: index + 1 };
  });
  if (row.role === 'player' ? !isUuid(row.self_participant_id) || !seen.has(row.self_participant_id)
    : row.self_participant_id !== null) return invalid();
  return { game: { id: game.id, title: text(game.title, 100), status: game.status as GameStatus, version: Number(game.version) },
    role: row.role as 'host' | 'player', selfParticipantId: row.self_participant_id as string | null,
    serverNow: timestamp(row.server_now), participants };
}
export function lobbyErrorMessage(error: unknown): string {
  return error instanceof LobbyError ? error.message : 'A váró most nem frissíthető. Ellenőrizd a kapcsolatot, majd próbáld újra.';
}
export function createLobbyApi(client: SupabaseClient<Database>): LobbyApi {
  return {
    async get(gameId) {
      if (!isUuid(gameId)) throw new LobbyError('A kóstoló címe érvénytelen.', true);
      const { data, error, status } = await client.rpc('get_lobby_snapshot', { p_game_id: gameId });
      if (error) {
        if (['AUTH_REQUIRED', 'GAME_NOT_FOUND'].includes(error.message) || [401, 403].includes(status)) {
          throw new LobbyError('Ez a váró nem érhető el a jelenlegi belépéseddel. Nyisd meg a meghívót, vagy lépj be újra.', true);
        }
        throw new LobbyError('A váró most nem frissíthető. Próbáld újra.');
      }
      return parseLobbySnapshot(data, gameId);
    },
    watch(gameId, changed, connection, sessionChanged) {
      if (!isUuid(gameId)) return () => {};
      let active = true;
      const notify = () => { if (active) changed(); };
      const channel = client.channel(`lobby:${gameId}:${++channelSequence}`, { config: { postgres_changes_options: { wait: true } } });
      // DELETE events cannot be filtered reliably under RLS; the periodic snapshot handles removals.
      for (const event of ['INSERT', 'UPDATE'] as const) {
        channel.on('postgres_changes', { event, schema: 'public', table: 'participants', filter: `game_id=eq.${gameId}` }, notify);
      }
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameId}` }, notify);
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, notify)
        .subscribe((status) => {
          if (!active) return;
          connection(status === 'SUBSCRIBED' ? 'live' : 'fallback');
          if (status === 'SUBSCRIBED') notify();
        });
      let userId: string | null | undefined;
      const { data } = client.auth.onAuthStateChange((event, session) => {
        const nextUserId = session?.user.id ?? null;
        const sameUser = userId !== undefined && userId === nextUserId;
        userId = nextUserId;
        if (event === 'INITIAL_SESSION') return;
        // SIGNED_IN also occurs when an existing session is recovered on focus.
        // Keep that user's draft; only a different identity or sign-out clears it.
        const recovered = sameUser && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event);
        // No SDK calls inside the synchronous Auth callback (session lock).
        setTimeout(() => { if (active) { if (recovered) notify(); else sessionChanged(); } }, 0);
      });
      return () => { active = false; data.subscription.unsubscribe(); void client.removeChannel(channel); };
    },
  };
}
