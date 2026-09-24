import { describe, expect, it } from 'vitest';
import { invitePathFromLink } from '../src/invites/entry-link';

const token = 'Qx7'.repeat(14) + 'Z';
const origins = ['http://localhost:5173', 'https://kostolo.example'];

describe('player entry invite link', () => {
  it('accepts current and configured public origins, preserving the case-sensitive token', () => {
    for (const origin of origins) {
      expect(invitePathFromLink(`  ${origin}/join/${token}  `, origins)).toBe(`/join/${token}`);
    }
    expect(invitePathFromLink(`${origins[1]}/join/${token}/?source=invite#top`, origins)).toBe(`/join/${token}`);
  });
  it.each([
    '', token, `/join/${token}`, `https://other.example/join/${token}`,
    `https://kostolo.example.evil.test/join/${token}`, `https://user:pass@kostolo.example/join/${token}`,
    `javascript:alert(1)`, `https://kostolo.example/host/${token}`,
    `https://kostolo.example/join/short`, `https://kostolo.example/join/${token}/extra`,
  ])('rejects invalid or unrelated links without creating a destination: %s', value => {
    expect(invitePathFromLink(value, origins)).toBeNull();
  });
});
