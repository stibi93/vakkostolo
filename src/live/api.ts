import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import { validateRating } from '../domain/game';
import { isUuid } from '../games/model';
import { createLobbyApi, LobbyError, parseLobbySnapshot } from '../lobby/api';
import { createPresenceApi } from '../lobby/presence';
import type { GameSnapshot, LiveApi, SavedRating } from './model';

export class LiveError extends LobbyError {}
function invalid(): never { throw new LiveError('A kóstoló válasza nem értelmezhető. Frissítsd az oldalt.'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return invalid();
  return value;
}
export function parseSavedRating(value: unknown, roundId: string): SavedRating {
  const r = record(value);
  if (r.round_id !== roundId || !isUuid(r.round_id) || typeof r.price_huf !== 'number' ||
    typeof r.alcohol_tenths !== 'number' || typeof r.liking !== 'number') return invalid();
  const rating = { priceHuf: r.price_huf, alcoholTenths: r.alcohol_tenths, liking: r.liking };
  if (validateRating(rating).length) return invalid();
  return { ...rating, roundId, submittedAt: timestamp(r.submitted_at) };
}
export function parseGameSnapshot(value: unknown, gameId: string, receivedAt = performance.now(), requestMs = 0): GameSnapshot {
  const base = parseLobbySnapshot(value, gameId), row = record(value);
  let round: GameSnapshot['round'] = null;
  if (row.round !== null) {
    const r = record(row.round);
    if (!isUuid(r.id) || !Number.isInteger(r.position) || Number(r.position) < 1 || Number(r.position) > 12 ||
      !['open', 'closed', 'revealed'].includes(String(r.status)) || typeof r.eligible !== 'boolean' ||
      typeof r.can_submit !== 'boolean') return invalid();
    round = { id: r.id, position: Number(r.position), status: r.status as 'open' | 'closed' | 'revealed',
      openedAt: timestamp(r.opened_at), closesAt: timestamp(r.closes_at), eligible: r.eligible, canSubmit: r.can_submit };
    if (Date.parse(round.closesAt) <= Date.parse(round.openedAt) || (base.role === 'host' && (round.eligible || round.canSubmit)) ||
      (round.canSubmit && (!round.eligible || round.status !== 'open' || base.game.status !== 'tasting' ||
        Date.parse(round.closesAt) <= Date.parse(base.serverNow)))) return invalid();
  }
  const ownRating = row.own_rating === null ? null : round ? parseSavedRating(row.own_rating, round.id) : invalid();
  if (ownRating && base.role !== 'player') return invalid();
  return { ...base, round, ownRating, receivedAt, serverTime: Date.parse(base.serverNow) + Math.max(0, requestMs) };
}
function fromServer(error: { message: string; code?: string }, status?: number): LiveError {
  const accessLost = ['AUTH_REQUIRED', 'GAME_NOT_FOUND', 'NOT_A_PARTICIPANT'].includes(error.message) || status === 401 || status === 403;
  const messages: Record<string, string> = {
    AUTH_REQUIRED: 'A belépésed lejárt. Nyisd meg újra a meghívót.',
    GAME_NOT_FOUND: 'Ez a kóstoló nem érhető el a jelenlegi belépéseddel.',
    NOT_A_PARTICIPANT: 'Ezzel a belépéssel nem vagy a kóstoló résztvevője.',
    PERMANENT_AUTH_REQUIRED: 'A kört csak a bejelentkezett játékmester indíthatja.',
    VERSION_CONFLICT: 'A játék állapota közben megváltozott. Frissítjük a kóstolót.',
    GAME_NOT_IN_LOBBY: 'A játék már nincs a váróban. Frissítjük a kóstolót.',
    ROUND_ALREADY_STARTED: 'A kör már elindult. Frissítjük a kóstolót.',
    DEADLINE_PASSED: 'Lejárt az idő. Ezt a módosítást a szerver már nem fogadta el.',
    ROUND_NOT_OPEN: 'A kör már nem fogad tippeket.',
    ROUND_NOT_ELIGIBLE: 'Ehhez a körhöz későn érkeztél. A következő tételtől adhatsz tippet.',
    WINES_INCOMPLETE: 'A boradatok hiányosak, ezért a kóstoló nem indítható.',
  };
  return new LiveError(accessLost && !Object.hasOwn(messages, error.message)
    ? 'A belépésed lejárt. Nyisd meg újra a meghívót.'
    : (Object.hasOwn(messages, error.message) ? messages[error.message] : undefined) ??
      'A szerver nem igazolta vissza a műveletet. Frissíts, és ellenőrizd a mentett állapotot.', accessLost);
}
export function createLiveApi(client: SupabaseClient<Database>): LiveApi {
  return {
    watch: createLobbyApi(client).watch,
    presence: createPresenceApi(client),
    async get(gameId) {
      if (!isUuid(gameId)) throw new LiveError('A kóstoló címe érvénytelen.', true);
      const began = performance.now();
      const { data, error, status } = await client.rpc('get_game_snapshot', { p_game_id: gameId });
      if (error) {
        const mapped = fromServer(error, status);
        throw mapped.accessLost ? mapped : new LiveError('A kóstoló most nem frissíthető. Próbáld újra.');
      }
      const received = performance.now();
      return parseGameSnapshot(data, gameId, received, received - began);
    },
    async start(gameId, version, requestId) {
      if (!isUuid(gameId) || !isUuid(requestId) || !Number.isSafeInteger(version) || version < 0) return invalid();
      const { data, error, status } = await client.rpc('start_round', { p_game_id: gameId, p_expected_version: version, p_request_id: requestId });
      if (error) throw fromServer(error, status);
      if (!isUuid(data)) return invalid();
      return data;
    },
    async submit(roundId, rating) {
      if (!isUuid(roundId)) return invalid();
      const errors = validateRating(rating);
      if (errors.length) throw new LiveError(errors.join(' '));
      const { data, error, status } = await client.rpc('submit_rating', {
        p_round_id: roundId, p_price_huf: rating.priceHuf, p_alcohol_tenths: rating.alcoholTenths, p_liking: rating.liking,
      });
      if (error) throw fromServer(error, status);
      return parseSavedRating(data, roundId);
    },
  };
}
