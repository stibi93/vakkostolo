import { parseResults } from '../results/api';
import { createGamesApi } from '../games/api';
import { createScheduleApi } from '../schedule/api';
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
  if (r.round_id !== roundId || !isUuid(r.round_id) || typeof r.price_bucket !== 'number' ||
    typeof r.alcohol_tenths !== 'number' || typeof r.liking !== 'number') return invalid();
  const rating = { priceBucket: r.price_bucket, alcoholTenths: r.alcohol_tenths, liking: r.liking };
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
      openedAt: timestamp(r.opened_at), closesAt: r.closes_at === null ? null : timestamp(r.closes_at), eligible: r.eligible, canSubmit: r.can_submit };
    if ((round.closesAt !== null && Date.parse(round.closesAt) <= Date.parse(round.openedAt)) || (base.role === 'host' && (round.eligible || round.canSubmit)) ||
      (round.canSubmit && (!round.eligible || round.status !== 'open' || base.game.status !== 'tasting' ||
        (round.closesAt !== null && Date.parse(round.closesAt) <= Date.parse(base.serverNow))))) return invalid();
  }
  const ownRating = row.own_rating === null ? null : round ? parseSavedRating(row.own_rating, round.id) : invalid();
  if (ownRating && base.role !== 'player') return invalid();
  let pause: GameSnapshot['pause'];
  if (row.break !== undefined) {
    const b = record(row.break);
    if (!isUuid(b.id) || typeof b.title !== 'string' || typeof b.message !== 'string' ||
      b.title.length > 100 || b.message.length > 2000 || round !== null || base.game.status !== 'intermission') return invalid();
    pause = { id: b.id, title: b.title, message: b.message, endsAt: b.ends_at === null ? null : timestamp(b.ends_at) };
  }
  let revealed: GameSnapshot['revealed'];
  if (row.revealed !== undefined) {
    if (!Array.isArray(row.revealed) || row.revealed.length > 12) return invalid();
    revealed = row.revealed.map(value => {
      const w = record(value);
      if (!isUuid(w.id) || typeof w.name !== 'string' || !Number.isInteger(w.position) || Number(w.position) < 1 || Number(w.position) > 12 ||
        !Number.isInteger(w.price_huf) || Number(w.price_huf) < 1 || Number(w.price_huf) > 1000000 ||
        !Number.isInteger(w.alcohol_tenths) || Number(w.alcohol_tenths) < 0 || Number(w.alcohol_tenths) > 250) return invalid();
      return { id: w.id, name: w.name, position: Number(w.position), priceHuf: Number(w.price_huf), alcoholTenths: Number(w.alcohol_tenths) };
    });
  }
  let revealCard: GameSnapshot['revealCard'];
  if (row.reveal_card !== undefined) {
    const c = record(row.reveal_card);
    if (!isUuid(c.id) || typeof c.title !== 'string' || !c.title.trim() || c.title.length > 100 ||
      typeof c.message !== 'string' || c.message.length > 2000 || base.game.status !== 'reveal' || round !== null || ownRating !== null ||
      !Array.isArray(c.round_ids) || !c.round_ids.length || c.round_ids.length > 12 ||
      c.round_ids.some(id => !isUuid(id) || !revealed?.some(w => w.id === id)) || new Set(c.round_ids).size !== c.round_ids.length) return invalid();
    revealCard = { id: c.id, title: c.title, message: c.message, roundIds: c.round_ids };
  }
  const results = row.results === undefined ? undefined : parseResults(row.results, base.role);
  return { ...base, round, ownRating, ...(revealCard ? { revealCard } : {}), ...(results ? { results } : {}), ...(pause ? { pause } : {}), ...(revealed ? { revealed } : {}), receivedAt, serverTime: Date.parse(base.serverNow) + Math.max(0, requestMs) };
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
    RATING_INVALID: 'A tipp hiányos vagy érvénytelen. Ellenőrizd az árkategóriát, az alkoholfokot és a tetszést.',
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
    schedule: createScheduleApi(client),
    resultPhotos: {
      async download(gameId, roundId) {
        if (!isUuid(gameId) || !isUuid(roundId)) return invalid();
        const { data, error } = await client.storage.from('wine-photos').download(`${gameId}/${roundId}.jpg`);
        if (error || !data) throw new LiveError('A bor fotója most nem tölthető be.');
        return data;
      },
    },
    photoUrl: createGamesApi(client).photoUrl,
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
        p_round_id: roundId, p_price_bucket: rating.priceBucket, p_alcohol_tenths: rating.alcoholTenths, p_liking: rating.liking,
      });
      if (error) throw fromServer(error, status);
      return parseSavedRating(data, roundId);
    },
  };
}
