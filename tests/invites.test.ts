import { AuthApiError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/lib/database.types';
import { createInvitesApi, inviteErrorMessage, parseInvitePreview, parseMembership } from '../src/invites/api';
import { inviteUrl, isInviteToken, nicknameError, readStoredInvite, storeInvite } from '../src/invites/model';
import { authSession } from './fixtures/auth';

const token = 'A'.repeat(21) + '_' + 'b'.repeat(20) + '-';
const gameId = '10000000-0000-0000-0000-000000000001';
const membership = { game_id: gameId, participant_id: '30000000-0000-0000-0000-000000000001',
  nickname: 'Anna', title: 'Péntesti kóstoló', status: 'lobby' };

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), key: () => null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); } };
}
function setup(session: boolean) {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: session ? authSession() : null }, error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  const rpc = vi.fn().mockResolvedValue({ data: membership, error: null });
  const api = createInvitesApi({ auth, rpc } as unknown as SupabaseClient<Database>);
  return { api, auth, rpc };
}

describe('meghívó-modell', () => {
  it('csak a szerver által kiadott 43 karakteres base64url tokent fogadja el', () => {
    expect(isInviteToken(token)).toBe(true);
    for (const bad of [token.slice(1), `${token}A`, `${token.slice(1)}=`, `${token.slice(1)}/`, null]) {
      expect(isInviteToken(bad)).toBe(false);
    }
    expect(inviteUrl('https://app.test', token)).toBe(`https://app.test/join/${token}`);
  });
  it('a becenév 1–30 karakter, vezérlőkarakter nélkül', () => {
    expect(nicknameError('  Anna  ')).toBeNull();
    expect(nicknameError('🍷'.repeat(30))).toBeNull();
    expect(nicknameError('   ')).toContain('Adj meg');
    expect(nicknameError('x'.repeat(31))).toContain('30');
    expect(nicknameError('Anna\nBéla')).toContain('sortörést');
  });
  it('a hostböngésző csak érvényes, le nem járt meghívót olvas vissza', () => {
    const storage = memoryStorage();
    const now = Date.parse('2026-09-24T10:00:00Z');
    storeInvite(storage, gameId, { token, expiresAt: '2026-09-24T22:00:00Z' });
    expect(readStoredInvite(storage, gameId, now)).toEqual({ token, expiresAt: '2026-09-24T22:00:00Z' });
    expect(readStoredInvite(storage, gameId, Date.parse('2026-09-25T00:00:00Z'))).toBeNull();
    expect(readStoredInvite(storage, '10000000-0000-0000-0000-000000000002', now)).toBeNull();
    storage.setItem(`vakkostolo:invite:${gameId}`, '{"token":"rövid","expiresAt":"2030-01-01T00:00:00Z"}');
    expect(readStoredInvite(storage, gameId, now)).toBeNull();
    storage.setItem(`vakkostolo:invite:${gameId}`, 'nem json');
    expect(readStoredInvite(storage, gameId, now)).toBeNull();
  });
});

describe('vendégbelépés adapter', () => {
  it('munkamenet nélkül oldalbetöltéskor nem hoz létre anonim felhasználót', async () => {
    const { api, auth, rpc } = setup(false);
    expect(await api.resume(token)).toBeNull();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('meglévő munkamenettel becenév nélkül visszatér a tagsághoz', async () => {
    const { api, rpc } = setup(true);
    expect(await api.resume(token)).toMatchObject({ gameId, nickname: 'Anna' });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('join_game', { p_token: token });
  });
  it('ha még nem tag, a visszatérés becenevet kér', async () => {
    const { api, rpc } = setup(true);
    rpc.mockResolvedValue({ data: null, error: { message: 'NICKNAME_REQUIRED' } });
    expect(await api.resume(token)).toBeNull();
  });
  it('belépéskor előbb anonim munkamenetet kér, majd levágott becenévvel csatlakozik', async () => {
    const { api, auth, rpc } = setup(false);
    expect(await api.join(token, '  Anna ')).toMatchObject({ participantId: membership.participant_id });
    expect(auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledExactlyOnceWith('join_game', { p_token: token, p_nickname: 'Anna' });
    expect(auth.signInAnonymously.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
  });
  it('meglévő (akár Google-) munkamenet mellett nem jelentkeztet be újra', async () => {
    const { api, auth } = setup(true);
    await api.join(token, 'Anna');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it('hibás becenévnél és tokennél hálózati hívás nélkül hibát ad', async () => {
    const { api, auth, rpc } = setup(false);
    await expect(api.join(token, ' ')).rejects.toThrow('Adj meg');
    await expect(api.join('rövid', 'Anna')).rejects.toThrow('nem érvényes');
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('közös Wi-Fi rate limitjénél érthető várakozást kér', async () => {
    const { api, auth, rpc } = setup(false);
    auth.signInAnonymously.mockResolvedValue({ data: {}, error: new AuthApiError('rate', 429, 'over_request_rate_limit') });
    const error = await api.join(token, 'Anna').catch((reason: unknown) => reason);
    expect(inviteErrorMessage(error)).toContain('Várj egy percet');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('szerverhibát magyar üzenetre fordít, ismeretlen hibánál nem állít sikert', async () => {
    const { api, rpc } = setup(true);
    rpc.mockResolvedValue({ data: null, error: { message: 'INVITE_INVALID' } });
    await expect(api.join(token, 'Anna')).rejects.toThrow('új linket');
    rpc.mockResolvedValue({ data: null, error: { message: 'HOST_CANNOT_JOIN' } });
    await expect(api.join(token, 'Anna')).rejects.toThrow('ismered a borokat');
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(api.join(token, 'Anna')).rejects.toThrow('nem igazolta vissza');
  });
  it('belépés előtt munkamenet nélkül lekéri a kóstoló címét, anonim felhasználó nélkül', async () => {
    const { api, auth, rpc } = setup(false);
    rpc.mockResolvedValue({ data: { title: 'Péntesti kóstoló', joinable: true }, error: null });
    expect(await api.preview(token)).toEqual({ title: 'Péntesti kóstoló', joinable: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('preview_invite', { p_token: token });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { message: 'INVITE_INVALID' } });
    await expect(api.preview(token)).rejects.toThrow('új linket');
    await expect(api.preview('rövid')).rejects.toThrow('nem érvényes');
    for (const data of [null, { title: 'x' }, { title: '', joinable: true }, { title: 'x'.repeat(101), joinable: true },
      { title: 'x', joinable: 'yes' }]) {
      expect(() => parseInvitePreview(data)).toThrow('nem értelmezhető');
    }
  });
  it('a szerver válaszát futásidőben ellenőrzi', () => {
    expect(() => parseMembership({ ...membership, status: 'unknown' })).toThrow('nem értelmezhető');
    expect(() => parseMembership({ ...membership, game_id: 'x' })).toThrow('nem értelmezhető');
    expect(() => parseMembership({ ...membership, nickname: 'x'.repeat(31) })).toThrow('nem értelmezhető');
  });
});
