import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../lib/database.types';
import { isUuid } from '../games/model';
import { LobbyError } from '../lobby/api';
import { gameStatusLabels } from '../games/model';
import type { ScheduleApi, ScheduleStep, TastingSchedule } from './model';
const messages: Record<string, string> = {
  VERSION_CONFLICT: 'Közben megváltozott a kóstoló. A piszkozatod megmaradt; töltsd be a mentett menetet, és ellenőrizd a változásokat.',
  STEP_LOCKED: 'A már megkezdett tétel nem módosítható. Töltsd be a mentett menetet.',
  INVALID_SCHEDULE: 'Ellenőrizd a menetet: 1–12 bor, legfeljebb 60 lépés; boronként időkorlát nélkül vagy 30–1800 másodperc.',
  INVALID_DURATION: 'Az időkorlát kikapcsolható, vagy 30–1800 másodpercre állítható.',
  DEADLINE_PASSED: 'Ez a kör már lejárt, az ideje nem módosítható. Lépj a következő tételre.',
  ROUND_STILL_OPEN: 'A kör még fogad tippeket. Előbb zárd le, vagy várd meg a határidőt.',
  ROUND_NOT_OPEN: 'Nincs nyitott kör. Frissítsd az állapotot.',
  REVEAL_REQUIRED: 'A következő bor előtt fedd fel a lezárt blokkot.',
  BLOCK_INCOMPLETE: 'A felfedéshez előbb fejezd be a blokk borait.',
  NO_NEXT_STEP: 'Nincs több lépés. Fedd fel az utolsó blokkot, majd fejezd be a kóstolót.',
  STEPS_REMAIN: 'Még van hátralévő lépés vagy fel nem fedett bor.',
  GAME_FINISHED: 'Ez a kóstoló már befejeződött.',
  GAME_NOT_FOUND: 'Ez a kóstoló nem érhető el ezzel a belépéssel.',
};
function failure(message: string): never {
  throw new LobbyError(messages[message] ?? 'A szerver nem igazolta vissza a műveletet. Próbáld újra, vagy töltsd be a mentett állapotot.');
}
export function parseSchedule(value: unknown): TastingSchedule {
  if (!value || typeof value !== 'object') return failure('INVALID_RESPONSE');
  const p = value as TastingSchedule;
  if (!Number.isInteger(p.version) || p.version < 0 || !Object.hasOwn(gameStatusLabels, p.status) ||
    !Number.isInteger(p.reveal_every) || p.reveal_every < 1 || p.reveal_every > 12 || !Array.isArray(p.steps) || p.steps.length > 60) return failure('INVALID_RESPONSE');
  const steps: ScheduleStep[] = p.steps.map(s => {
    if (!s || !isUuid(s.id) || !['wine', 'break'].includes(s.kind) || typeof s.title !== 'string' || typeof s.message !== 'string' ||
      !['pending', 'open', 'closed', 'revealed', 'done'].includes(s.status) || !Number.isInteger(s.seconds) || s.seconds < 0 || s.seconds > 7200 ||
      (s.kind === 'wine' && (!Number.isInteger(s.price_huf) || Number(s.price_huf) < 1 || Number(s.price_huf) > 1000000 ||
        !Number.isInteger(s.alcohol_tenths) || Number(s.alcohol_tenths) < 0 || Number(s.alcohol_tenths) > 250 ||
        !Number.isInteger(s.round_position) || Number(s.round_position) < 1 || Number(s.round_position) > 12 || (s.seconds !== 0 && s.seconds < 30) || s.seconds > 1800))) return failure('INVALID_RESPONSE');
    return { id: s.id, kind: s.kind, title: s.title, message: s.message, seconds: s.seconds, status: s.status,
      price_huf: s.price_huf, alcohol_tenths: s.alcohol_tenths, round_position: s.round_position };
  });
  if (new Set(steps.map(s => s.id)).size !== steps.length) return failure('INVALID_RESPONSE');
  return { version: p.version, status: p.status, reveal_every: p.reveal_every, steps };
}
export function createScheduleApi(client: SupabaseClient<Database>): ScheduleApi {
  return {
    async get(gameId) {
      const { data, error } = await client.rpc('get_tasting_schedule', { p_game_id: gameId });
      if (error) return failure(error.message);
      return parseSchedule(data);
    },
    async save(gameId, version, requestId, steps) {
      const { error } = await client.rpc('save_tasting_schedule', { p_game_id: gameId, p_expected_version: version,
        p_request_id: requestId, p_steps: steps as unknown as Json });
      if (error) return failure(error.message);
    },
    async control(gameId, version, requestId, action, seconds) {
      const { error } = await client.rpc('control_tasting', { p_game_id: gameId, p_expected_version: version,
        p_request_id: requestId, p_action: action, ...(seconds === undefined ? {} : { p_seconds: seconds }) });
      if (error) return failure(error.message);
    },
  };
}
