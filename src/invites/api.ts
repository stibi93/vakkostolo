import { isAuthApiError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameStatus } from '../domain/game';
import type { Database } from '../lib/database.types';
import { gameStatusLabels, isUuid } from '../games/model';
import { isInviteToken, nicknameError } from './model';
import type { InvitesApi, IssuedInvite, Membership, Participant } from './model';

export class InviteServiceError extends Error {}
const invalidResponse = () => new InviteServiceError('A szerver válasza nem értelmezhető. Próbáld újra.');

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) throw invalidResponse();
  return value;
}
function status(value: unknown): GameStatus {
  if (typeof value !== 'string' || !Object.hasOwn(gameStatusLabels, value)) throw invalidResponse();
  return value as GameStatus;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw invalidResponse();
  return value;
}
export function parseMembership(value: unknown): Membership {
  const row = record(value);
  if (!isUuid(row.game_id) || !isUuid(row.participant_id)) throw invalidResponse();
  return { gameId: row.game_id, participantId: row.participant_id, nickname: text(row.nickname, 30),
    title: text(row.title, 100), status: status(row.status) };
}
export function parseIssuedInvite(value: unknown): IssuedInvite {
  const row = record(value);
  if (!isInviteToken(row.token)) throw invalidResponse();
  return { token: row.token, expiresAt: timestamp(row.expires_at), status: status(row.status) };
}

const serverMessages: Record<string, string> = {
  AUTH_REQUIRED: 'A belépésed lejárt. Nyisd meg újra a meghívót.',
  PERMANENT_AUTH_REQUIRED: 'Ehhez tartós játékmesteri fiókkal kell belépned.',
  GAME_NOT_FOUND: 'A kóstoló nem található, vagy nem te vagy a játékmestere.',
  GAME_FINISHED: 'Befejezett kóstolóhoz nem készíthető meghívó.',
  WINES_INCOMPLETE: 'A váró csak akkor nyitható meg, ha minden bor adata megvan.',
  INVITE_INVALID: 'Ez a meghívó nem érvényes. Lehet, hogy lejárt, vagy a játékmester újat készített. Kérj új linket vagy QR-kódot.',
  HOST_CANNOT_JOIN: 'Ez a saját kóstolód. Játékmesterként nem léphetsz be játékosnak, mert ismered a borokat.',
  GAME_CLOSED: 'Ebbe a kóstolóba már nem lehet belépni.',
  GAME_FULL: 'A kóstoló megtelt.',
  INVALID_NICKNAME: 'A becenév 1–30 karakter lehet, sortörés nélkül.',
};
function fromServer(error: { message: string; code?: string }): InviteServiceError {
  return new InviteServiceError(serverMessages[error.message] ?? (error.code === 'PGRST202'
    ? 'A meghívás még nem érhető el ezen a szerveren.'
    : 'A szerver nem igazolta vissza a műveletet. Ellenőrizd a kapcsolatot, majd próbáld újra.'));
}
function fromGuestSignIn(error: unknown): InviteServiceError {
  if (isAuthApiError(error) && error.status === 429) {
    return new InviteServiceError('Erről a hálózatról most túl sokan léptek be. Várj egy percet, majd próbáld újra.');
  }
  if (isAuthApiError(error) && error.code === 'anonymous_provider_disabled') {
    return new InviteServiceError('A vendégbelépés nincs bekapcsolva ezen a szerveren. Szólj a játékmesternek.');
  }
  return new InviteServiceError('Nem sikerült vendégként belépni. Ellenőrizd a kapcsolatot, majd próbáld újra.');
}
export function inviteErrorMessage(error: unknown): string {
  return error instanceof InviteServiceError ? error.message : 'Nem sikerült kapcsolódni a szerverhez. Próbáld újra.';
}

export function createInvitesApi(client: SupabaseClient<Database>): InvitesApi {
  async function hasSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw new InviteServiceError('Nem sikerült ellenőrizni a belépést. Próbáld újra.');
    return data.session !== null;
  }
  return {
    async issue(gameId) {
      if (!isUuid(gameId)) throw new InviteServiceError('A kóstoló címe érvénytelen.');
      const { data, error } = await client.rpc('issue_invite', { p_game_id: gameId });
      if (error) throw fromServer(error);
      return parseIssuedInvite(data);
    },
    async participants(gameId) {
      if (!isUuid(gameId)) throw new InviteServiceError('A kóstoló címe érvénytelen.');
      const { data, error } = await client.from('participants').select('id, nickname, joined_at')
        .eq('game_id', gameId).order('joined_at').limit(100);
      if (error) throw fromServer(error);
      return data.map((row): Participant => {
        if (!isUuid(row.id)) throw invalidResponse();
        return { id: row.id, nickname: text(row.nickname, 30), joinedAt: timestamp(row.joined_at) };
      });
    },
    async resume(token) {
      if (!isInviteToken(token)) throw new InviteServiceError(serverMessages.INVITE_INVALID);
      // No session yet: do not create an anonymous user before the guest actually joins.
      if (!await hasSession()) return null;
      const { data, error } = await client.rpc('join_game', { p_token: token });
      if (error?.message === 'NICKNAME_REQUIRED') return null;
      if (error) throw fromServer(error);
      return parseMembership(data);
    },
    async join(token, nickname) {
      if (!isInviteToken(token)) throw new InviteServiceError(serverMessages.INVITE_INVALID);
      const problem = nicknameError(nickname);
      if (problem) throw new InviteServiceError(problem);
      if (!await hasSession()) {
        const { error } = await client.auth.signInAnonymously();
        if (error) throw fromGuestSignIn(error);
      }
      const { data, error } = await client.rpc('join_game', { p_token: token, p_nickname: nickname.trim() });
      if (error) throw fromServer(error);
      return parseMembership(data);
    },
  };
}
