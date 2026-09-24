import type { Page, WebSocketRoute } from '@playwright/test';

// Synthetic Phoenix websocket server. Exercises the real SDK, not hosted Realtime/RLS.
export function realtimeHub() {
  const channels = new Map<string, { ws: WebSocketRoute; topic: string; joinRef: string; filters: Record<string, unknown>[] }>();
  let socketSequence = 0;
  return {
    async attach(page: Page) {
      await page.routeWebSocket('wss://auth.vakkostolo.test/**', (ws) => {
        const socketId = ++socketSequence;
        ws.onMessage((message) => {
          const [joinRef, ref, topic, event, payload] = JSON.parse(String(message));
          if (event === 'phx_join') {
            const filters = payload.config.postgres_changes.map((filter: Record<string, unknown>, index: number) => ({ ...filter, id: index + 1 }));
            // Topics are scoped to a connection; separate browsers may use identical names.
            channels.set(`${socketId}:${topic}`, { ws, topic, joinRef, filters });
            ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: filters } }]));
          } else if (event === 'heartbeat' || event === 'phx_leave') {
            if (event === 'phx_leave') channels.delete(`${socketId}:${topic}`);
            ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
          }
        });
        ws.onClose(() => { for (const [topic, channel] of channels) if (channel.ws === ws) channels.delete(topic); });
      });
    },
    change(gameId: string, table = 'participants') {
      for (const channel of channels.values()) {
        const type = table === 'participants' ? 'INSERT' : 'UPDATE';
        const filter = channel.filters.find((item) => item.table === table && item.event === type &&
          item.filter === `${table === 'games' ? 'id' : 'game_id'}=eq.${gameId}`);
        if (!filter) continue;
        channel.ws.send(JSON.stringify([channel.joinRef, null, channel.topic, 'postgres_changes', {
          ids: [filter.id], data: { schema: 'public', table, type, commit_timestamp: new Date().toISOString(),
            columns: [], record: { game_id: gameId, nickname: 'Eseményből nem megjelenítendő' }, old_record: {}, errors: null },
        }]));
      }
    },
    size: () => channels.size,
  };
}
export function lobbyResponse(gameId: string, participants: unknown[] = [], role = 'host', self: string | null = null, status = 'lobby') {
  return { game: { id: gameId, title: 'Péntesti kóstoló', status, version: 1 }, role,
    self_participant_id: self, participants, server_now: new Date().toISOString() };
}
