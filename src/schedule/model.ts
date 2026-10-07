import type { HostQuestion } from '../questions/model';
import type { GameStatus } from '../domain/game';
export interface ScheduleStep {
  questions?: HostQuestion[];
  id: string; kind: 'wine' | 'break' | 'reveal'; reveal_round_ids?: string[]; title: string; message: string; seconds: number;
  status: 'pending' | 'open' | 'closed' | 'revealed' | 'done';
  price_huf: number | null; alcohol_tenths: number | null; round_position: number | null;
}
export interface TastingSchedule { version: number; status: GameStatus; reveal_every: number; steps: ScheduleStep[] }
export type TastingAction = 'next' | 'close' | 'time' | 'reveal' | 'finish';
export interface ScheduleApi {
  get(gameId: string): Promise<TastingSchedule>;
  save(gameId: string, version: number, requestId: string, steps: ScheduleStep[]): Promise<void>;
  control(gameId: string, version: number, requestId: string, action: TastingAction, seconds?: number): Promise<void>;
  allowLateEdits(gameId: string, version: number, requestId: string): Promise<void>;
}
// Also available on phones connected over ordinary LAN HTTP.
export function newRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
