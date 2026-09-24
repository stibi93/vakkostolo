import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createMfaApi } from '../src/auth/mfa';

const factor = (id: string, status: 'verified' | 'unverified') => ({ id, status, factor_type: 'totp' });
function setup(factors: ReturnType<typeof factor>[]) {
  const mfa = {
    listFactors: vi.fn().mockResolvedValue({ data: { all: factors, totp: factors.filter((f) => f.status === 'verified') }, error: null }),
    unenroll: vi.fn().mockResolvedValue({ data: {}, error: null }),
    enroll: vi.fn().mockResolvedValue({ data: { id: 'new', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SECRET' } }, error: null }),
    challengeAndVerify: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  return { mfa, api: createMfaApi({ auth: { mfa } } as unknown as SupabaseClient) };
}

describe('kétlépcsős azonosítás adapter', () => {
  it('csak az ellenőrzött TOTP-t tekinti beállítottnak', async () => {
    expect(await setup([factor('a', 'unverified')]).api.verifiedFactor()).toBeNull();
    expect(await setup([factor('a', 'unverified'), factor('b', 'verified')]).api.verifiedFactor()).toBe('b');
  });
  it('új beállítás előtt törli a félbehagyott (nem ellenőrzött) hitelesítőt', async () => {
    const { api, mfa } = setup([factor('stale', 'unverified'), factor('ok', 'verified')]);
    expect(await api.enroll()).toEqual({ factorId: 'new', qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SECRET' });
    expect(mfa.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: 'stale' });
  });
  it('csak 6 jegyű kódot küld el, hibánál és korlátnál magyar üzenetet ad', async () => {
    const { api, mfa } = setup([]);
    await expect(api.verify('f', '12345')).rejects.toThrow('6 jegyű');
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
    await api.verify('f', '123456');
    expect(mfa.challengeAndVerify).toHaveBeenCalledExactlyOnceWith({ factorId: 'f', code: '123456' });
    mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: { status: 422 } });
    await expect(api.verify('f', '000000')).rejects.toThrow('nem megfelelő');
    mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: { status: 429 } });
    await expect(api.verify('f', '000000')).rejects.toThrow('Túl sok');
  });
});
