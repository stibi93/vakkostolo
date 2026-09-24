import type { GameStatus } from '../domain/game';

export interface LobbyParticipant { id: string; nickname: string; joinedAt: string; seat: number }
export interface LobbySnapshot {
  game: { id: string; title: string; status: GameStatus; version: number };
  role: 'host' | 'player'; selfParticipantId: string | null;
  serverNow: string; participants: LobbyParticipant[];
}
export type LobbyConnection = 'connecting' | 'live' | 'fallback' | 'offline';
export interface LobbyApi {
  get(gameId: string): Promise<LobbySnapshot>;
  watch(gameId: string, changed: () => void, connection: (state: LobbyConnection) => void,
    sessionChanged: () => void): () => void;
}
