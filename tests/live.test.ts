import { createClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';
import type { Database } from '../src/lib/database.types';
import { createLiveApi, parseGameSnapshot, parseSavedRating } from '../src/live/api';
import { secondsLeft } from '../src/live/model';

const game = '10000000-0000-0000-0000-000000000001';
const round = '20000000-0000-0000-0000-000000000001';
const member = '30000000-0000-0000-0000-000000000001';
const raw = { game: { id: game, title: 'Teszt', status: 'tasting', version: 2 }, role: 'player', self_participant_id: member,
  server_now: '2026-09-24T12:00:00Z', participants: [{ id: member, nickname: 'Anna', joined_at: '2026-09-24T11:00:00Z', seat: 1 }],
  round: { id: round, position: 1, status: 'open', opened_at: '2026-09-24T12:00:00Z', closes_at: '2026-09-24T12:02:00Z', eligible: true, can_submit: true },
  own_rating: null };
const rating = { round_id: round, price_bucket: 5, alcohol_tenths: 135, liking: 8, submitted_at: '2026-09-24T12:00:02Z' };
it('snapshot és beküldési válasz csak megengedett saját mezőket ad tovább', () => {
  const parsed = parseGameSnapshot({ ...raw, wines: ['hidden'], round: { ...raw.round, wine: 'hidden' },
    own_rating: { ...rating, participant_id: member, secret: 'hidden' } }, game, 1000);
  expect(JSON.stringify(parsed)).not.toMatch(/hidden|participant_id|wines/);
  expect(parsed.ownRating?.priceBucket).toBe(5);
  expect(parseSavedRating({ ...rating, game_id: game }, round)).toEqual(parsed.ownRating);
});
it.each([
  { ...raw, round: undefined }, { ...raw, own_rating: undefined },
  { ...raw, round: { ...raw.round, can_submit: 'yes' } },
  { ...raw, round: { ...raw.round, eligible: false } },
  { ...raw, round: { ...raw.round, status: 'pending' } },
  { ...raw, round: { ...raw.round, closes_at: raw.round.opened_at } },
  { ...raw, round: { ...raw.round, position: 13 } },
  { ...raw, own_rating: { ...rating, round_id: member } },
  { ...raw, own_rating: { ...rating, liking: 0 } },
  { ...raw, own_rating: { ...rating, price_bucket: '5' } },
  { ...raw, round: null, own_rating: rating },
  { ...raw, role: 'host', self_participant_id: null },
])('hibás és ellentmondó válasz nem válhat használható állapottá (%#)', value => {
  expect(() => parseGameSnapshot(value, game)).toThrow();
});
it('visszaszámlálás szerveridőből, monoton eltelt idővel és konzervatív hálózati késleltetéssel számol', () => {
  const snapshot = parseGameSnapshot(raw, game, 1000, 250);
  vi.spyOn(Date, 'now').mockReturnValue(0);
  expect(secondsLeft(snapshot, 1000)).toBe(120);
  expect(secondsLeft(snapshot, 2000)).toBe(119);
  expect(secondsLeft(snapshot, 121_000)).toBe(0);
  expect(secondsLeft(snapshot, 500)).toBe(120);
  vi.restoreAllMocks();
});
it('RPC-k típusos argumentumokat küldenek; hibás értékhez nincs hálózati kérés', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(round)))
    .mockResolvedValueOnce(new Response(JSON.stringify(rating)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'DEADLINE_PASSED' }), { status: 400 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'GAME_NOT_FOUND' }), { status: 400 }));
  const api = createLiveApi(createClient<Database>('https://unit.example.test', 'public-fixture', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  }));
  await expect(api.start(game, 1, member)).resolves.toBe(round);
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ p_game_id: game, p_expected_version: 1, p_request_id: member });
  await expect(api.submit(round, { priceBucket: 5, alcoholTenths: 135, liking: 8 })).resolves.toMatchObject({ priceBucket: 5 });
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ p_round_id: round, p_price_bucket: 5, p_alcohol_tenths: 135, p_liking: 8 });
  await expect(api.submit(round, { priceBucket: 5, alcoholTenths: 135, liking: 8 })).rejects.toThrow('Lejárt az idő');
  await expect(api.get(game)).rejects.toMatchObject({ accessLost: true });
  await expect(api.submit(round, { priceBucket: 0, alcoholTenths: 135, liking: 8 })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(4);
});
it('aktuális szünet és felfedett adatok célzott projekciója; rejtett extra mezők nem jutnak tovább', () => {
  const value={...raw,game:{...raw.game,status:'intermission'},round:null,
    break:{id:round,title:'Szünet',message:'Víz és kenyér',ends_at:null,future:'secret'},
    revealed:[{id:round,position:1,name:'Felfedett bor',price_huf:4500,alcohol_tenths:130,answers:['secret']}]};
  const result=parseGameSnapshot(value,game);
  expect(result.pause).toEqual({id:round,title:'Szünet',message:'Víz és kenyér',endsAt:null});
  expect(result.revealed?.[0].name).toBe('Felfedett bor');
  expect(JSON.stringify(result)).not.toContain('secret');
  expect(()=>parseGameSnapshot({...value,round:raw.round},game)).toThrow();
  expect(()=>parseGameSnapshot({...value,break:{...value.break,ends_at:'invalid'}},game)).toThrow();
});

it('az aktív felfedési kártya csak már felfedett, egyedi borazonosítókat tartalmazhat',()=>{
  const card={id:member,title:'Bemutató',message:'Szöveg',round_ids:[round]};
  const value={...raw,game:{...raw.game,status:'reveal'},round:null,reveal_card:card,
    revealed:[{id:round,position:1,name:'Bor',price_huf:4500,alcohol_tenths:130}]};
  expect(parseGameSnapshot(value,game).revealCard?.roundIds).toEqual([round]);
  for(const round_ids of [[],[round,round],[member]]) expect(()=>parseGameSnapshot({...value,reveal_card:{...card,round_ids}},game)).toThrow();
  expect(()=>parseGameSnapshot({...value,game:{...raw.game,status:'tasting'}},game)).toThrow();
});
