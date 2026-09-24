import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/lib/database.types';
import { createGamesApi, gameErrorMessage, parseHostGame, parseHostSummary } from '../src/games/api';
import { parseAlcohol, validateGameInput } from '../src/games/model';
import { fitWithin, winePhotoPath } from '../src/games/winePhoto';

const id = '10000000-0000-0000-0000-000000000001';
const input = { title: ' Kóstoló ', roundSeconds: 120, revealEvery: 2,
  wines: [{ name: ' Mintabor ', priceHuf: 4500, alcoholTenths: 135 }] };
const summary = { id, title: 'Kóstoló', status: 'draft', round_seconds: 120, reveal_every: 2, created_at: '2026-09-24T10:00:00Z' };
const roundId = '20000000-0000-0000-0000-000000000001';
const snapshot = { ...summary, wines: [{ position: 1, round_id: roundId, name: 'Mintabor', price_huf: 4500, alcohol_tenths: 135,
  photo_updated_at: null, photo_locked: false }] };
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
    expect((await setup(snapshot).api.get(id)).wines[0]).toEqual({ position: 1, roundId, name: 'Mintabor', priceHuf: 4500, alcoholTenths: 135,
      photoUpdatedAt: null, photoLocked: false });
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
    { ...snapshot, wines: [{ ...snapshot.wines[0], alcohol_tenths: 251 }] },
    { ...snapshot, wines: [{ ...snapshot.wines[0], round_id: 'x' }] },
    { ...snapshot, wines: [{ ...snapshot.wines[0], photo_locked: 'false' }] },
    { ...snapshot, wines: [{ ...snapshot.wines[0], photo_updated_at: 'bad' }] }])('futásidőben is ellenőrzi a host-válasz alakját (%#)', (data) => {
    expect(() => parseHostGame(data)).toThrow('nem értelmezhető');
  });
  it('a listanézetből eldobja a többletmezőket', () => {
    expect(parseHostSummary({ ...summary, wines: snapshot.wines })).not.toHaveProperty('wines');
  });
});
describe('borfotó: privát Storage-adapter', () => {
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
  it('a fotó a `<játék>/<kör>.jpg` útvonalra, felülírható JPEG-ként kerül', async () => {
    const { api, fetch } = setup({ Key: `wine-photos/${winePhotoPath(id, roundId)}` });
    await api.uploadPhoto(id, roundId, jpeg());
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toBe(`https://unit.example.test/storage/v1/object/wine-photos/${id}/${roundId}.jpg`);
    expect(new Headers(options?.headers).get('x-upsert')).toBe('true');
  });
  it('nem JPEG vagy hibás azonosító esetén nem indít kérést', async () => {
    const { api, fetch } = setup({});
    await expect(api.uploadPhoto(id, roundId, new Blob(['x'], { type: 'image/png' }))).rejects.toThrow('túl nagy');
    await expect(api.uploadPhoto(id, 'x', jpeg())).rejects.toThrow('azonosítója hibás');
    await expect(api.photoUrl('x', roundId)).rejects.toThrow('azonosítója hibás');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('a jogosultsági elutasítást érthetően jelzi, a nyers hibát nem mutatja', async () => {
    const { api } = setup({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, 403);
    const error = await api.uploadPhoto(id, roundId, jpeg()).catch((value: unknown) => value);
    expect(gameErrorMessage(error)).toContain('felfedve');
    expect(gameErrorMessage(error)).not.toContain('row-level');
  });
  it('rövid élettartamú aláírt URL-t kér és törölni is tud', async () => {
    const signed = setup({ signedURL: `/object/sign/wine-photos/${id}/${roundId}.jpg?token=t` });
    expect(await signed.api.photoUrl(id, roundId)).toContain('/storage/v1/object/sign/wine-photos/');
    expect(JSON.parse(String(signed.fetch.mock.calls[0][1]?.body))).toEqual({ expiresIn: 3600 });
    const removed = setup([{ name: `${id}/${roundId}.jpg` }]);
    await removed.api.removePhoto(id, roundId);
    expect(JSON.parse(String(removed.fetch.mock.calls[0][1]?.body))).toEqual({ prefixes: [`${id}/${roundId}.jpg`] });
  });
  it('a képet arányosan, legfeljebb 1600 px-es oldalra kicsinyíti', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
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

it('a jogosultság miatt kihagyott törlést nem jelzi sikeresnek', async () => {
  const { api } = setup([]);
  await expect(api.removePhoto(id, '20000000-0000-0000-0000-000000000001')).rejects.toThrow('nem igazolta vissza');
});
