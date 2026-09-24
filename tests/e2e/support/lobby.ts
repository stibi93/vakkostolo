import type { Page, WebSocketRoute } from '@playwright/test';

type Metas = Record<string, { metas: Record<string, unknown>[] }>;
interface Channel { ws: WebSocketRoute; topic: string; joinRef: string; filters: Record<string, unknown>[]; presence: boolean; key: string;
  meta?: Record<string, unknown> }

// Synthetic Phoenix websocket server. Exercises the real SDK, not hosted Realtime/RLS.
// Postgres-change topics are per connection; presence topics are shared across connections like the real server.
export function realtimeHub() {
  const channels = new Map<string, Channel>();
  let socketSequence = 0, refSequence = 0;
  const send = (channel: Channel, event: string, payload: unknown) =>
    channel.ws.send(JSON.stringify([channel.joinRef, null, channel.topic, event, payload]));
  const peers = (topic: string) => [...channels.values()].filter((channel) => channel.presence && channel.topic === topic);
  const stateOf = (topic: string): Metas => Object.fromEntries(peers(topic).filter((c) => c.meta).map((c) => [c.key, { metas: [c.meta!] }]));
  function diff(topic: string, joins: Metas, leaves: Metas) {
    for (const peer of peers(topic)) send(peer, 'presence_diff', { joins, leaves });
  }
  function leave(id: string) {
    const channel = channels.get(id);
    channels.delete(id);
    if (channel?.meta) diff(channel.topic, {}, { [channel.key]: { metas: [channel.meta] } });
  }
  return {
    async attach(page: Page) {
      await page.routeWebSocket('wss://auth.vakkostolo.test/**', (ws) => {
        const socketId = ++socketSequence;
        ws.onMessage((message) => {
          const [joinRef, ref, topic, event, payload] = JSON.parse(String(message));
          const id = `${socketId}:${topic}`;
          const reply = (response: unknown = {}) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]));
          if (event === 'phx_join') {
            const filters = payload.config.postgres_changes.map((filter: Record<string, unknown>, index: number) => ({ ...filter, id: index + 1 }));
            const presence = payload.config.presence?.enabled === true;
            const channel: Channel = { ws, topic, joinRef, filters, presence, key: payload.config.presence?.key || `${socketId}-${topic}` };
            channels.set(id, channel);
            reply({ postgres_changes: filters });
            if (presence) send(channel, 'presence_state', stateOf(topic));
          } else if (event === 'presence') {
            const channel = channels.get(id);
            reply();
            if (!channel) return;
            if (payload.event === 'track') {
              const previous = channel.meta, meta = { ...payload.payload, phx_ref: `ref-${++refSequence}` };
              channel.meta = meta;
              diff(topic, { [channel.key]: { metas: [meta] } }, previous ? { [channel.key]: { metas: [previous] } } : {});
            } else if (payload.event === 'untrack' && channel.meta) {
              const previous = channel.meta; channel.meta = undefined;
              diff(topic, {}, { [channel.key]: { metas: [previous] } });
            }
          } else if (event === 'heartbeat' || event === 'phx_leave') {
            if (event === 'phx_leave') leave(id);
            reply();
          }
        });
        ws.onClose(() => { for (const [id, channel] of channels) if (channel.ws === ws) leave(id); });
      });
    },
    change(gameId: string, table = 'participants') {
      for (const channel of channels.values()) {
        const type = table === 'participants' ? 'INSERT' : 'UPDATE';
        const filter = channel.filters.find((item) => item.table === table && item.event === type &&
          item.filter === `${table === 'games' ? 'id' : 'game_id'}=eq.${gameId}`);
        if (!filter) continue;
        send(channel, 'postgres_changes', {
          ids: [filter.id], data: { schema: 'public', table, type, commit_timestamp: new Date().toISOString(),
            columns: [], record: { game_id: gameId, nickname: 'Eseményből nem megjelenítendő' }, old_record: {}, errors: null },
        });
      }
    },
    /** Postgres-change subscriptions only; presence channels are counted by `online`. */
    size: () => [...channels.values()].filter((channel) => !channel.presence).length,
    online: (gameId: string) => peers(`realtime:game:${gameId}:presence`).filter((c) => c.meta).map((c) => c.meta!.participant_id),
    watchers: (gameId: string) => peers(`realtime:game:${gameId}:presence`).length,
  };
}
export function lobbyResponse(gameId: string, participants: unknown[] = [], role = 'host', self: string | null = null, status = 'lobby') {
  return { round: null, own_rating: null, game: { id: gameId, title: 'Péntesti kóstoló', status, version: 1 }, role,
    self_participant_id: self, participants, server_now: new Date().toISOString() };
}
