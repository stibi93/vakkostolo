import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { GameStatus } from '../domain/game';
import { gameStatusLabels, isUuid, validateGameInput } from './model';
import type { GamesApi, HostGame, HostGameSummary } from './model';

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
    roundSeconds: integer(row.round_seconds, 30, 1800), revealEvery: integer(row.reveal_every, 1, 12), createdAt: row.created_at };
}
export function parseHostGame(value: unknown): HostGame {
  const row = record(value);
  if (!Array.isArray(row.wines) || row.wines.length < 1 || row.wines.length > 12) throw invalidResponse();
  return { ...parseHostSummary(row), wines: row.wines.map((value, index) => {
    const wine = record(value);
    return { position: integer(wine.position, index+1, index+1), name: text(wine.name, 200),
      priceHuf: integer(wine.price_huf, 1, 1_000_000), alcoholTenths: integer(wine.alcohol_tenths, 0, 250) };
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
export function gameErrorMessage(error: unknown): string {
  return error instanceof GameServiceError ? error.message : 'Nem sikerült kapcsolódni a szerverhez. Próbáld újra.';
}
export function createGamesApi(client: SupabaseClient<Database>): GamesApi {
  return {
    async create(input, requestId) {
      const errors = validateGameInput(input);
      if (errors.length) throw new GameServiceError(errors.join(' '));
      if (!isUuid(requestId)) throw new GameServiceError('A kérés azonosítója hibás. Töltsd újra az oldalt.');
      const { data, error } = await client.rpc('create_game', {
        p_request_id: requestId, p_title: input.title.trim(), p_round_seconds: input.roundSeconds,
        p_reveal_every: input.revealEvery,
        p_wines: input.wines.map((wine) => ({ name: wine.name.trim(), price_huf: wine.priceHuf, alcohol_tenths: wine.alcoholTenths })),
      });
      if (error) throw fromServer(error);
      if (!isUuid(data)) throw invalidResponse();
      return data;
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
  };
}
