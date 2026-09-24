import type { SupabaseClient } from '@supabase/supabase-js';

export interface TotpEnrollment { factorId: string; qrCode: string; secret: string }
export interface MfaApi {
  /** Id of the verified authenticator app, or null when the superadmin still has to set one up. */
  verifiedFactor(): Promise<string | null>;
  enroll(): Promise<TotpEnrollment>;
  verify(factorId: string, code: string): Promise<void>;
}

export class MfaError extends Error {}
export const isTotpCode = (value: string) => /^\d{6}$/.test(value);

export function createMfaApi(client: SupabaseClient): MfaApi {
  const mfa = client.auth.mfa;
  return {
    async verifiedFactor() {
      const { data, error } = await mfa.listFactors();
      if (error) throw new MfaError('A kétlépcsős azonosítás állapota nem kérdezhető le. Próbáld újra.');
      return data.totp.find((factor) => factor.status === 'verified')?.id ?? null;
    },
    async enroll() {
      const { data: factors, error: listError } = await mfa.listFactors();
      if (listError) throw new MfaError('A kétlépcsős azonosítás állapota nem kérdezhető le. Próbáld újra.');
      // An abandoned setup leaves an unverified factor behind; replace it with a fresh secret.
      for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status !== 'verified')) {
        await mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await mfa.enroll({ factorType: 'totp', friendlyName: 'Vakkóstoló' });
      if (error) throw new MfaError('A hitelesítő app beállítása nem indítható. Próbáld újra.');
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
    },
    async verify(factorId, code) {
      if (!isTotpCode(code)) throw new MfaError('Add meg a hitelesítő appban látható 6 jegyű kódot.');
      const { error } = await mfa.challengeAndVerify({ factorId, code });
      if (!error) return;
      throw new MfaError(error.status === 429 ? 'Túl sok próbálkozás. Várj néhány percet, majd próbáld újra.'
        : 'A kód nem megfelelő vagy lejárt. Írd be az appban éppen látható kódot.');
    },
  };
}
