import { parseSchedule } from '../schedule/api';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { GameStatus } from '../domain/game';
import { gameStatusLabels, isUuid, validateGameInput } from './model';
import type { GamesApi, HostGame, HostGameSummary } from './model';
import { maxWinePhotoBytes, winePhotoBucket, winePhotoPath } from './winePhoto';

export class GameServiceError extends Error {}
const invalidResponse = () => new GameServiceError('A szerver válasza nem értelmezhető. Próbáld újra.');
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) throw invalidResponse();
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw invalidResponse();
  return value;
}
export function parseHostSummary(value: unknown): HostGameSummary {
  const row = record(value);
  if (!isUuid(row.id) || typeof row.status !== 'string' || !Object.hasOwn(gameStatusLabels, row.status) ||
    typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) throw invalidResponse();
  return { id: row.id, title: text(row.title, 100), status: row.status as GameStatus,
    roundSeconds: row.round_seconds === 0 ? 0 : integer(row.round_seconds, 30, 1800), revealEvery: integer(row.reveal_every, 1, 12), createdAt: row.created_at };
}
export function parseHostGame(value: unknown): HostGame {
  const row = record(value);
  if (!Array.isArray(row.wines) || row.wines.length < 1 || row.wines.length > 12) throw invalidResponse();
  return { ...parseHostSummary(row), ...(row.schedule === undefined ? {} : { schedule: parseSchedule(row.schedule) }), wines: row.wines.map((value, index) => {
    const wine = record(value);
    const photoUpdatedAt = wine.photo_updated_at ?? null;
    if (!isUuid(wine.round_id) || typeof wine.photo_locked !== 'boolean' ||
      (photoUpdatedAt !== null && (typeof photoUpdatedAt !== 'string' || !Number.isFinite(Date.parse(photoUpdatedAt))))) throw invalidResponse();
    return { position: integer(wine.position, index+1, index+1), name: text(wine.name, 200),
      priceHuf: integer(wine.price_huf, 1, 1_000_000), alcoholTenths: integer(wine.alcohol_tenths, 0, 250),
      roundId: wine.round_id, photoUpdatedAt, photoLocked: wine.photo_locked };
  }) };
}
function fromServer(error: { message: string; code?: string }): GameServiceError {
  const messages: Record<string, string> = {
    AUTH_REQUIRED: 'A belépésed lejárt. Lépj be újra.',
    PERMANENT_AUTH_REQUIRED: 'Ehhez tartós játékmesteri fiókkal kell belépned.',
    GAME_NOT_FOUND: 'A kóstoló nem található, vagy nem te vagy a játékmestere.',
    REQUEST_ID_CONFLICT: 'Ezzel a kéréssel már létrejött egy kóstoló. Nyisd meg a saját kóstolóid listáját, mielőtt újat készítesz.',
    INVALID_TITLE: 'Ellenőrizd a kóstoló címét.', INVALID_SETTINGS: 'Ellenőrizd az időt és a felfedési gyakoriságot.',
    INVALID_WINES: 'Adj meg 1–12 bort.', INVALID_WINE: 'Ellenőrizd a borok nevét, árát és alkoholfokát.',
  };
  return new GameServiceError((Object.hasOwn(messages, error.message) ? messages[error.message] : undefined) ?? (error.code === 'PGRST202'
    ? 'A játéklétrehozás még nem érhető el ezen a szerveren.'
    : 'A szerver nem igazolta vissza a műveletet. Ellenőrizd a kapcsolatot, majd próbáld újra.'));
}
function fromStorage(error: unknown): GameServiceError {
  const status = error && typeof error === 'object' && 'statusCode' in error ? String(error.statusCode) : '';
  const message = error instanceof Error ? error.message : '';
  if (status === '413' || /maximum allowed size|too large/i.test(message)) return new GameServiceError('A kép túl nagy (legfeljebb 2 MB).');
  if (status === '403' || /row-level security|unauthorized/i.test(message))
    return new GameServiceError('A fotó ennél a bornál nem módosítható: a bor már felfedve, vagy lejárt a belépésed.');
  return new GameServiceError('A fotó mentését a szerver nem igazolta vissza. Ellenőrizd a kapcsolatot, majd próbáld újra.');
}
function photoPath(gameId: string, roundId: string) {
  if (!isUuid(gameId) || !isUuid(roundId)) throw new GameServiceError('A bor azonosítója hibás. Töltsd újra az oldalt.');
  return winePhotoPath(gameId, roundId);
}
export function gameErrorMessage(error: unknown): string {
  return error instanceof GameServiceError ? error.message : 'Nem sikerült kapcsolódni a szerverhez. Próbáld újra.';
}
export function createGamesApi(client: SupabaseClient<Database>): GamesApi {
  return {
    async create(input, requestId) {
      const errors = validateGameInput(input);
      if (errors.length) throw new GameServiceError(errors.join(' '));
      if (!isUuid(requestId)) throw new GameServiceError('A kérés azonosítója hibás. Töltsd újra az oldalt.');
      const args = {
        p_request_id: requestId, p_title: input.title.trim(), p_round_seconds: input.roundSeconds,
        p_reveal_every: input.revealEvery,
        p_wines: input.wines.map((wine) => ({ ...(wine.questions?.length ? {questions:wine.questions.map(q=>({...q,options:q.options.map(o=>({...o}))}))}:{}), name: wine.name.trim(), price_huf: wine.priceHuf, alcohol_tenths: wine.alcoholTenths })),
      };
      const { data, error } = input.steps || input.wines.some(w=>w.questions?.length) ? await client.rpc('create_game_with_schedule', { ...args, p_steps: input.steps ?? input.wines.map((_,wine_index)=>({kind:'wine',wine_index})) }) : await client.rpc('create_game', args);
      if (error) throw fromServer(error);
      if (!isUuid(data)) throw invalidResponse();
      return data;
    },
    async remove(id) {
      if (!isUuid(id)) throw invalidResponse();
      const { data, error } = await client.rpc('delete_game', { p_game_id: id });
      if (error) throw fromServer(error);
      if (!Array.isArray(data) || data.some(path => typeof path !== 'string' || !path.startsWith(id+'/'))) throw invalidResponse();
      if (data.length) {
        const removed = await client.storage.from(winePhotoBucket).remove(data as string[]);
        if (removed.error) throw new GameServiceError('A fotók törlése nem fejeződött be. Próbáld újra a kóstoló törlését.');
      }
      const finished = await client.rpc('delete_game', { p_game_id: id, p_finalize: true });
      if (finished.error) throw new GameServiceError('A törlés nem fejeződött be. Próbáld újra; a szerver ellenőrzi a megmaradt fotókat is.');
    },
    async list() {
      const { data, error } = await client.rpc('list_host_games');
      if (error) throw fromServer(error);
      if (!Array.isArray(data) || data.length > 100) throw invalidResponse();
      return data.map(parseHostSummary);
    },
    async get(id) {
      if (!isUuid(id)) throw new GameServiceError('A kóstoló címe érvénytelen. Térj vissza a saját kóstolóidhoz.');
      const { data, error } = await client.rpc('get_host_game', { p_game_id: id });
      if (error) throw fromServer(error);
      const game = parseHostGame(data);
      if (game.id !== id) throw invalidResponse();
      return game;
    },
    async uploadPhoto(gameId, roundId, photo) {
      const path = photoPath(gameId, roundId);
      if (photo.type !== 'image/jpeg' || photo.size > maxWinePhotoBytes) throw new GameServiceError('A kép túl nagy (legfeljebb 2 MB).');
      const { error } = await client.storage.from(winePhotoBucket).upload(path, photo, { upsert: true, contentType: 'image/jpeg', cacheControl: '60' });
      if (error) throw fromStorage(error);
    },
    async removePhoto(gameId, roundId) {
      const path = photoPath(gameId, roundId);
      const { data, error } = await client.storage.from(winePhotoBucket).remove([path]);
      if (error) throw fromStorage(error);
      if (!data?.some(file => file.name === path)) throw new GameServiceError('A szerver nem igazolta vissza a fotó törlését. Töltsd újra az oldalt.');
    },
    async photoUrl(gameId, roundId) {
      const { data, error } = await client.storage.from(winePhotoBucket).createSignedUrl(photoPath(gameId, roundId), 3600);
      if (error || !data?.signedUrl) throw new GameServiceError('A fotó most nem tölthető be.');
      return data.signedUrl;
    },
  };
}
