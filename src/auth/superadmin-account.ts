// Dependency-free: also imported by scripts/superadmin.mjs through Node type stripping.

/** Reserved TLD (RFC 2606): no one can register or verify a real mailbox or Google account here. */
export const superadminEmailDomain = 'superadmin.vakkostolo.invalid';
export const superadminRole = 'superadmin';

const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
export function usernameError(value: string): string | null {
  return usernamePattern.test(normalizeUsername(value)) ? null
    : 'A felhasználónév 3–32 karakter: kisbetű, szám, pont, kötőjel vagy aláhúzás.';
}
export function superadminEmail(username: string): string {
  return `${normalizeUsername(username)}@${superadminEmailDomain}`;
}
export function usernameFromEmail(email: string | undefined): string | null {
  const suffix = `@${superadminEmailDomain}`;
  return email?.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
}
/** Mirrors the server rule for the UI only; host RPCs check the Auth row and aal2 themselves. */
export function isSuperadmin(user: { is_anonymous?: boolean; app_metadata?: Record<string, unknown> } | null): boolean {
  return !!user && user.is_anonymous === false && user.app_metadata?.vakkostolo_role === superadminRole;
}
export function passwordError(value: string): string | null {
  if (Array.from(value).length < 14) return 'A jelszó legalább 14 karakter legyen.';
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return 'A jelszóban legyen kisbetű, nagybetű és szám is.';
  }
  return null;
}
