import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { isUuid } from '../games/model';

export type PresenceStatus = 'connecting' | 'live' | 'unavailable';
export interface PresenceView { status: PresenceStatus; online: ReadonlySet<string> }
export interface PresenceApi {
  /** `self` is the caller's participant ID; hosts and projectors pass null and only watch. */
  watch(gameId: string, self: string | null, listener: (view: PresenceView) => void): () => void;
}

export const presenceTopic = (gameId: string) => `game:${gameId}:presence`;
const connecting: PresenceView = { status: 'connecting', online: new Set() };
const unavailable: PresenceView = { status: 'unavailable', online: new Set() };

interface Watcher { self: string | null; listener: (view: PresenceView) => void }
interface Entry {
  channel?: RealtimeChannel; view: PresenceView; watchers: Map<symbol, Watcher>;
  tracked: string | null; subscribed: boolean; closing?: ReturnType<typeof setTimeout>;
}

export function onlineParticipants(state: Record<string, unknown[]>): Set<string> {
  const online = new Set<string>();
  for (const metas of Object.values(state)) for (const meta of metas) {
    const id = (meta as { participant_id?: unknown } | null)?.participant_id;
    if (isUuid(id)) online.add(id);
  }
  return online;
}

/**
 * One private channel per game and tab. The SDK hands back an existing channel for the same topic
 * until it is fully removed, so remounts share the entry and a new channel waits for the old removal.
 */
export function createPresenceApi(client: SupabaseClient): PresenceApi {
  const entries = new Map<string, Entry>();
  const removals = new Map<string, Promise<unknown>>();

  function publish(entry: Entry, view: PresenceView) {
    entry.view = view;
    for (const watcher of entry.watchers.values()) watcher.listener(view);
  }
  function syncTrack(entry: Entry) {
    const self = [...entry.watchers.values()].find((watcher) => watcher.self)?.self ?? null;
    if (!entry.channel || !entry.subscribed || self === entry.tracked) return;
    entry.tracked = self;
    void (self ? entry.channel.track({ participant_id: self }) : entry.channel.untrack());
  }
  function connect(gameId: string, entry: Entry) {
    if (entries.get(gameId) !== entry) return;
    const channel = client.channel(presenceTopic(gameId), { config: { private: true } });
    entry.channel = channel;
    const current = () => entries.get(gameId) === entry && entry.channel === channel;
    channel.on('presence', { event: 'sync' }, () => {
      if (current()) publish(entry, { status: 'live', online: onlineParticipants(channel.presenceState()) });
    }).subscribe((status) => {
      if (!current()) return;
      entry.subscribed = status === 'SUBSCRIBED';
      if (entry.subscribed) {
        // The server forgets tracked presence when the socket drops; announce again on every join.
        entry.tracked = null; syncTrack(entry);
        publish(entry, { status: 'live', online: onlineParticipants(channel.presenceState()) });
      } else publish(entry, unavailable);
    });
  }
  function open(gameId: string): Entry {
    const entry: Entry = { view: connecting, watchers: new Map(), tracked: null, subscribed: false };
    entries.set(gameId, entry);
    const removal = removals.get(gameId);
    if (removal) void removal.finally(() => connect(gameId, entry)); else connect(gameId, entry);
    return entry;
  }
  function close(gameId: string, entry: Entry) {
    if (entry.watchers.size || entries.get(gameId) !== entry) return;
    entries.delete(gameId);
    if (!entry.channel) return;
    const removal = client.removeChannel(entry.channel).catch(() => undefined)
      .finally(() => { if (removals.get(gameId) === removal) removals.delete(gameId); });
    removals.set(gameId, removal);
  }

  return {
    watch(gameId, self, listener) {
      if (!isUuid(gameId)) { listener(unavailable); return () => {}; }
      const entry = entries.get(gameId) ?? open(gameId);
      clearTimeout(entry.closing);
      const key = Symbol('watcher');
      entry.watchers.set(key, { self: isUuid(self) ? self : null, listener });
      listener(entry.view);
      syncTrack(entry);
      return () => {
        entry.watchers.delete(key);
        syncTrack(entry);
        if (!entry.watchers.size) entry.closing = setTimeout(() => close(gameId, entry), 0);
      };
    },
  };
}
