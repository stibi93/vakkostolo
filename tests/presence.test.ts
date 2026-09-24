import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPresenceApi, onlineParticipants, presenceTopic } from '../src/lobby/presence';
import type { PresenceView } from '../src/lobby/presence';

const game = '10000000-0000-0000-0000-000000000001';
const anna = '30000000-0000-0000-0000-000000000001';
const bela = '30000000-0000-0000-0000-000000000002';

function fakeClient() {
  const channels: ReturnType<typeof fakeChannel>[] = [];
  function fakeChannel(topic: string, options: unknown) {
    let sync = () => {}, status: (value: string) => void = () => {};
    const channel = {
      topic, options, state: {} as Record<string, unknown[]>, removed: false,
      track: vi.fn(async () => 'ok'), untrack: vi.fn(async () => 'ok'),
      on: vi.fn((_type: string, _filter: unknown, callback: () => void) => { sync = callback; return channel; }),
      subscribe: vi.fn((callback: (value: string) => void) => { status = callback; return channel; }),
      presenceState: () => channel.state,
      emitStatus: (value: string) => status(value),
      emitSync: (state: Record<string, unknown[]>) => { channel.state = state; sync(); },
    };
    return channel;
  }
  let release: () => void = () => {};
  const client = {
    channel: vi.fn((topic: string, options: unknown) => { const c = fakeChannel(topic, options); channels.push(c); return c; }),
    removeChannel: vi.fn((channel: { removed: boolean }) => new Promise((resolve) => {
      release = () => { channel.removed = true; resolve('ok'); };
    })),
  };
  return { client: client as unknown as SupabaseClient, raw: client, channels, release: () => release() };
}
afterEach(() => { vi.useRealTimers(); });

describe('onlineParticipants', () => {
  it('csak érvényes résztvevő-azonosítókat fogad el, kulcstól függetlenül', () => {
    expect(onlineParticipants({ a: [{ participant_id: anna }, { participant_id: 'x' }], b: [{ participant_id: bela }, null], c: [{}] }))
      .toEqual(new Set([anna, bela]));
  });
});

describe('createPresenceApi', () => {
  it('privát csatorna; a játékos csak feliratkozás után jelzi magát, újracsatlakozáskor újra', () => {
    const f = fakeClient(), api = createPresenceApi(f.client);
    const views: PresenceView[] = [];
    api.watch(game, anna, (view) => views.push(view));
    const [channel] = f.channels;
    expect(channel.topic).toBe(presenceTopic(game));
    expect(channel.options).toEqual({ config: { private: true } });
    expect(views.at(-1)?.status).toBe('connecting');
    expect(channel.track).not.toHaveBeenCalled();
    channel.emitStatus('SUBSCRIBED');
    expect(channel.track).toHaveBeenCalledWith({ participant_id: anna });
    channel.emitSync({ k1: [{ participant_id: anna }], k2: [{ participant_id: bela }] });
    expect(views.at(-1)).toEqual({ status: 'live', online: new Set([anna, bela]) });
    channel.emitStatus('CHANNEL_ERROR');
    expect(views.at(-1)?.status).toBe('unavailable');
    channel.emitStatus('SUBSCRIBED');
    expect(channel.track).toHaveBeenCalledTimes(2);
  });

  it('a játékmester és a kivetítő csak figyel', () => {
    const f = fakeClient(), api = createPresenceApi(f.client);
    api.watch(game, null, () => {});
    f.channels[0].emitStatus('SUBSCRIBED');
    expect(f.channels[0].track).not.toHaveBeenCalled();
  });

  it('azonnali újracsatolás (StrictMode) ugyanazt a csatornát használja, utolsó leváláskor bont', async () => {
    vi.useFakeTimers();
    const f = fakeClient(), api = createPresenceApi(f.client);
    api.watch(game, anna, () => {})();
    const stop = api.watch(game, anna, () => {});
    await vi.runAllTimersAsync();
    expect(f.raw.channel).toHaveBeenCalledTimes(1);
    expect(f.raw.removeChannel).not.toHaveBeenCalled();
    stop();
    await vi.runAllTimersAsync();
    expect(f.raw.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('bontás közbeni visszatéréskor megvárja a régi csatorna eltávolítását', async () => {
    vi.useFakeTimers();
    const f = fakeClient(), api = createPresenceApi(f.client);
    api.watch(game, anna, () => {})();
    await vi.runAllTimersAsync();
    api.watch(game, anna, () => {});
    expect(f.raw.channel).toHaveBeenCalledTimes(1);
    f.release();
    await vi.runAllTimersAsync();
    expect(f.raw.channel).toHaveBeenCalledTimes(2);
    expect(f.channels[0].removed).toBe(true);
  });

  it('érvénytelen játékazonosítónál nem nyit csatornát', () => {
    const f = fakeClient(), api = createPresenceApi(f.client), listener = vi.fn();
    api.watch('nem-uuid', anna, listener);
    expect(f.raw.channel).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith({ status: 'unavailable', online: new Set() });
  });
});
