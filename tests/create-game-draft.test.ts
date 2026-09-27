import { describe, expect, it } from 'vitest';
import { buildCreateDraftFromGame } from '../src/games/createGameDraft';
import type { HostGame } from '../src/games/model';

const baseGame = (): HostGame => ({
  id: '10000000-0000-0000-0000-000000000001',
  title: 'Tavaszi próba',
  status: 'draft',
  roundSeconds: 120,
  revealEvery: 2,
  createdAt: '2026-01-01T12:00:00.000Z',
  wines: [
    { position: 1, roundId: '20000000-0000-0000-0000-000000000001', name: 'Első bor', priceHuf: 4500, alcoholTenths: 135, photoUpdatedAt: null, photoLocked: false },
    { position: 2, roundId: '20000000-0000-0000-0000-000000000002', name: 'Második bor', priceHuf: 6000, alcoholTenths: 120, photoUpdatedAt: null, photoLocked: false },
  ],
});

describe('buildCreateDraftFromGame', () => {
  it('copies schedule steps with remapped reveal targets and a new title', () => {
    const game = baseGame();
    game.schedule = {
      version: 0,
      status: 'draft',
      reveal_every: 2,
      steps: [
        { id: '30000000-0000-0000-0000-000000000001', kind: 'wine', title: '1', message: '', seconds: 0, status: 'pending', price_huf: 4500, alcohol_tenths: 135, round_position: 1 },
        { id: '30000000-0000-0000-0000-000000000002', kind: 'break', title: 'Szünet', message: 'Pihenő', seconds: 300, status: 'pending', price_huf: null, alcohol_tenths: null, round_position: null },
        { id: '30000000-0000-0000-0000-000000000003', kind: 'wine', title: '2', message: '', seconds: 0, status: 'pending', price_huf: 6000, alcohol_tenths: 120, round_position: 2 },
        { id: '30000000-0000-0000-0000-000000000004', kind: 'reveal', title: 'Felfedés', message: '', seconds: 0, status: 'pending', price_huf: null, alcohol_tenths: null, round_position: null, reveal_round_ids: ['20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'] },
      ],
    };
    const draft = buildCreateDraftFromGame(game);
    expect(draft.title).toBe('Tavaszi próba – másolat');
    expect(draft.entries.map((entry) => entry.kind)).toEqual(['wine', 'break', 'wine', 'reveal']);
    const reveal = draft.entries[3];
    expect(reveal.kind).toBe('reveal');
    if (reveal.kind !== 'reveal') throw new Error('expected reveal');
    expect(reveal.targets).toHaveLength(2);
    expect(reveal.targets[0]).toBe(draft.entries[0].id);
    expect(reveal.targets[1]).toBe(draft.entries[2].id);
  });

  it('falls back to wines only when schedule is missing', () => {
    const draft = buildCreateDraftFromGame(baseGame());
    expect(draft.entries).toHaveLength(2);
    expect(draft.entries.every((entry) => entry.kind === 'wine')).toBe(true);
    if (draft.entries[0].kind === 'wine') expect(draft.entries[0].alcohol).toBe('13,5');
  });
});
