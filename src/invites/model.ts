import type { GameStatus } from '../domain/game';

export interface Invite { token: string; expiresAt: string }
export interface IssuedInvite extends Invite { status: GameStatus }
export interface Membership { gameId: string; participantId: string; nickname: string; title: string; status: GameStatus }
export interface Participant { id: string; nickname: string; joinedAt: string }
export interface InvitesApi {
  issue(gameId: string): Promise<IssuedInvite>;
  participants(gameId: string): Promise<Participant[]>;
  /** Existing membership for this browser's session, or null when a nickname is still needed. */
  resume(token: string): Promise<Membership | null>;
  join(token: string, nickname: string): Promise<Membership>;
}

export const isInviteToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const inviteUrl = (origin: string, token: string) => `${origin}/join/${token}`;

export function nicknameError(value: string): string | null {
  const length = Array.from(value.trim()).length;
  if (length < 1) return 'Adj meg egy becenevet.';
  if (length > 30) return 'A becenév legfeljebb 30 karakter lehet.';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'A becenév nem tartalmazhat sortörést vagy vezérlőkaraktert.';
  return null;
}

const storageKey = (gameId: string) => `vakkostolo:invite:${gameId}`;

/** The server keeps only a hash, so the host's browser is the only place the link can be shown again. */
export function readStoredInvite(storage: Storage, gameId: string, now = Date.now()): Invite | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(storageKey(gameId)) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const { token, expiresAt } = value as Record<string, unknown>;
    if (!isInviteToken(token) || typeof expiresAt !== 'string' || !(Date.parse(expiresAt) > now)) return null;
    return { token, expiresAt };
  } catch {
    return null;
  }
}
export function storeInvite(storage: Storage, gameId: string, invite: Invite) {
  try {
    storage.setItem(storageKey(gameId), JSON.stringify({ token: invite.token, expiresAt: invite.expiresAt }));
  } catch {
    // Private browsing may block storage; the invite still works until this page is left.
  }
}
