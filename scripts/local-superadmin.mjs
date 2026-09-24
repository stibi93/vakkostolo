// Synthetic local superadmin with a verified TOTP factor (aal2), for the opt-in
// local Supabase probes. The caller deletes the returned user id afterwards.
import { createHmac, randomUUID } from 'node:crypto';

function base32(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  return Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
}

function totp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 0xf;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export async function signInLocalSuperadmin(admin, client, prefix) {
  const email = `${prefix}-${randomUUID()}@superadmin.vakkostolo.invalid`, password = `Pr0be-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { vakkostolo_role: 'superadmin' } });
  if (created.error) throw new Error(`Teszt-host: sikertelen kérés (${created.error.code ?? 'ismeretlen'})`);
  const id = created.data.user.id;
  try {
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`Host Auth: sikertelen kérés (${signIn.error.code ?? 'ismeretlen'})`);
    const factor = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Helyi próba' });
    if (factor.error) throw new Error(`Host MFA: sikertelen kérés (${factor.error.code ?? 'ismeretlen'})`);
    const verified = await client.auth.mfa.challengeAndVerify({ factorId: factor.data.id, code: totp(factor.data.totp.secret) });
    if (verified.error) throw new Error(`Host MFA-ellenőrzés: sikertelen kérés (${verified.error.code ?? 'ismeretlen'})`);
    const { data: { session } } = await client.auth.getSession();
    return { id, session };
  } catch (error) {
    await admin.auth.admin.deleteUser(id);
    throw error;
  }
}
