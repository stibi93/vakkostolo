import type { GameResults, ResultPhotoApi } from '../results/model';
import type { ScheduleApi } from '../schedule/model';
import type { Rating } from '../domain/game';
import type { LobbySnapshot, SnapshotApi } from '../lobby/model';
import type { PresenceApi } from '../lobby/presence';

export interface ActiveRound {
  id: string; position: number; status: 'open' | 'closed' | 'revealed';
  openedAt: string; closesAt: string | null; eligible: boolean; canSubmit: boolean;
}
export interface SavedRating extends Rating { roundId: string; submittedAt: string }
export interface GameSnapshot extends LobbySnapshot {
  round: ActiveRound | null; ownRating: SavedRating | null;
  receivedAt: number; serverTime: number;
  results?: GameResults;
  revealCard?: { id: string; title: string; message: string; roundIds: string[] };
  pause?: { id: string; title: string; message: string; endsAt: string | null };
  revealed?: { id: string; position: number; name: string; priceHuf: number; alcoholTenths: number }[];
}
export interface LiveApi extends SnapshotApi<GameSnapshot> {
  start(gameId: string, version: number, requestId: string): Promise<string>;
  submit(roundId: string, rating: Rating): Promise<SavedRating>;
  /** Optional so offline fakes can omit it; without it the roster shows no online state. */
  presence?: PresenceApi;
  schedule?: ScheduleApi;
  resultPhotos?: ResultPhotoApi;
  photoUrl?(gameId: string, roundId: string): Promise<string>;
}
/** Monotonic elapsed time; changing the phone's wall clock cannot extend the round. */
export function secondsLeft(snapshot: GameSnapshot, now = performance.now()): number {
  return snapshot.round?.closesAt === null ? Infinity : snapshot.round ? Math.max(0, Math.ceil((Date.parse(snapshot.round.closesAt) - snapshot.serverTime -
    Math.max(0, now - snapshot.receivedAt)) / 1000)) : 0;
}
