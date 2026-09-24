import { isInviteToken } from './model';

/** Extract only a local invite destination; never navigate to pasted arbitrary URLs. */
export function invitePathFromLink(value: string, allowedOrigins: readonly string[]): string | null {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      !allowedOrigins.includes(url.origin)) return null;
    const match = /^\/join\/([^/]+)\/?$/.exec(url.pathname);
    return match && isInviteToken(match[1]) ? `/join/${match[1]}` : null;
  } catch {
    return null;
  }
}
