import { describe, expect, it } from 'vitest';
import { clearReturnPath, readReturnPath, rememberReturnPath } from '../src/auth/return-path';
import {
  isSuperadmin, passwordError, superadminEmail, usernameError, usernameFromEmail,
} from '../src/auth/superadmin-account';
import { authUser, googlePlayer } from './fixtures/auth';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), key: () => null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); } };
}

describe('superadmin fiók', () => {
  it('a felhasználónevet foglalt .invalid domainre képezi, kis-nagybetűtől függetlenül', () => {
    expect(superadminEmail(' Admin ')).toBe('admin@superadmin.vakkostolo.invalid');
    expect(usernameFromEmail('admin@superadmin.vakkostolo.invalid')).toBe('admin');
    expect(usernameFromEmail('admin@gmail.com')).toBeNull();
    expect(usernameError('tibor.s')).toBeNull();
    for (const bad of ['ab', 'a b', 'admin@x', '-admin', 'á'.repeat(4), 'x'.repeat(33)]) expect(usernameError(bad)).not.toBeNull();
  });
  it('erős jelszót kér', () => {
    expect(passwordError('Hosszu-Jelszo-2026')).toBeNull();
    for (const bad of ['Rovid-1', 'csupakisbetu-2026x', 'CSUPANAGYBETU-2026', 'NincsBenneSzamJelszo']) {
      expect(passwordError(bad)).not.toBeNull();
    }
  });
  it('a felület csak app_metadata szerepű, nem anonim fiókot kezel superadminként', () => {
    expect(isSuperadmin(authUser)).toBe(true);
    expect(isSuperadmin(googlePlayer)).toBe(false);
    expect(isSuperadmin({ ...authUser, is_anonymous: true })).toBe(false);
    const selfClaimed = { ...googlePlayer, user_metadata: { vakkostolo_role: 'superadmin' } };
    expect(isSuperadmin(selfClaimed)).toBe(false);
    expect(isSuperadmin(null)).toBe(false);
  });
  it('Google-belépés után csak meghívóoldalra tér vissza', () => {
    const storage = memoryStorage();
    const invite = `/join/${'A'.repeat(43)}`;
    rememberReturnPath(storage, invite);
    expect(readReturnPath(storage)).toBe(invite);
    expect(readReturnPath(storage)).toBe(invite);
    clearReturnPath(storage);
    expect(readReturnPath(storage)).toBeNull();
    for (const bad of ['/host', 'https://evil.test/join/x', '//evil.test', `/join/${'A'.repeat(43)}/../host`]) {
      rememberReturnPath(storage, bad);
      expect(readReturnPath(storage)).toBeNull();
    }
    storage.setItem('vakkostolo:auth:return', 'https://evil.test');
    expect(readReturnPath(storage)).toBeNull();
  });
});
