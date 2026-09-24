import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/lib/database.types';
import { createGamesApi, gameErrorMessage, parseHostGame, parseHostSummary } from '../src/games/api';
import { parseAlcohol, validateGameInput } from '../src/games/model';

const id = '10000000-0000-0000-0000-000000000001';
const input = { title: ' Kóstoló ', roundSeconds: 120, revealEvery: 2,
  wines: [{ name: ' Mintabor ', priceHuf: 4500, alcoholTenths: 135 }] };
const summary = { id, title: 'Kóstoló', status: 'draft', round_seconds: 120, reveal_every: 2, created_at: '2026-09-24T10:00:00Z' };
const snapshot = { ...summary, wines: [{ position: 1, name: 'Mintabor', price_huf: 4500, alcohol_tenths: 135 }] };
function setup(response: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () =>
    new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } }));
  const client = createClient<Database>('https://unit.example.test', 'sb_publishable_fixture', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { api: createGamesApi(client), fetch };
}
describe('játéklétrehozás és adatadapter', () => {
  it('az RPC csak a szükséges mezőket és az ismételhető kérésazonosítót kapja', async () => {
    const { api, fetch } = setup(id);
    expect(await api.create(input, id)).toBe(id);
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain('/rest/v1/rpc/create_game');
    expect(JSON.parse(String(options?.body))).toEqual({
      p_request_id: id, p_title: 'Kóstoló', p_round_seconds: 120, p_reveal_every: 2,
      p_wines: [{ name: 'Mintabor', price_huf: 4500, alcohol_tenths: 135 }],
    });
  });
  it('hibás űrlapadat nem indít kérést', async () => {
    const { api, fetch } = setup(id);
    await expect(api.create({ ...input, title: ' ' }, id)).rejects.toThrow('címe');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('hibás játékazonosítót hálózati kérés nélkül elutasít', async () => {
    const { api, fetch } = setup(snapshot);
    await expect(api.get('wrong')).rejects.toThrow('érvénytelen');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('nem fogadja el másik játék válaszát', async () => {
    const { api } = setup({ ...snapshot, id: '10000000-0000-0000-0000-000000000002' });
    await expect(api.get(id)).rejects.toThrow('nem értelmezhető');
  });
  it('érvényes host adatot és üres listát is feldolgoz', async () => {
    expect((await setup(snapshot).api.get(id)).wines[0]).toEqual({ position: 1, name: 'Mintabor', priceHuf: 4500, alcoholTenths: 135 });
    expect(await setup([]).api.list()).toEqual([]);
    expect((await setup([summary]).api.list())[0].id).toBe(id);
  });
  it('ismeretlen szerverhiba részletei nem jutnak a felületre', async () => {
    const { api } = setup({ message: 'secret raw database detail', code: 'XX000' }, 400);
    await expect(api.create(input, id)).rejects.toThrow('nem igazolta');
    expect(gameErrorMessage(new Error('private exception'))).not.toContain('private');
  });
  it('az eltérő adattal ismételt kérést külön jelzi', async () => {
    const { api } = setup({ message: 'REQUEST_ID_CONFLICT', code: 'P0001' }, 400);
    await expect(api.create(input, id)).rejects.toThrow('már létrejött');
  });
  it.each([null, {}, { ...snapshot, wines: [] }, { ...snapshot, status: '__proto__' },
    { ...snapshot, round_seconds: '120' }, { ...snapshot, created_at: 'bad' },
    { ...snapshot, wines: [{ ...snapshot.wines[0], position: 2 }] },
    { ...snapshot, wines: [{ ...snapshot.wines[0], alcohol_tenths: 251 }] }])('futásidőben is ellenőrzi a host-válasz alakját (%#)', (data) => {
    expect(() => parseHostGame(data)).toThrow('nem értelmezhető');
  });
  it('a listanézetből eldobja a többletmezőket', () => {
    expect(parseHostSummary({ ...summary, wines: snapshot.wines })).not.toHaveProperty('wines');
  });
});
describe('magyar adatbevitel', () => {
  it('tizedesvesszőt és tizedespontot támogat egész tizedekként', () => {
    expect(parseAlcohol(' 13,5 ')).toBe(135);
    expect(parseAlcohol('13.5')).toBe(135);
    expect(parseAlcohol('0')).toBe(0);
    for (const value of ['', '13.55', '13,', '1e1', '-1']) expect(parseAlcohol(value)).toBeNaN();
  });
  it('a határértékek és hiányos boradatok ellenőrzöttek', () => {
    expect(validateGameInput(input)).toEqual([]);
    expect(validateGameInput({ ...input, wines: [] })).not.toEqual([]);
    expect(validateGameInput({ ...input, roundSeconds: 29 })).not.toEqual([]);
    expect(validateGameInput({ ...input, wines: [{ name: '', priceHuf: NaN, alcoholTenths: 251 }] })).toHaveLength(3);
  });
});
