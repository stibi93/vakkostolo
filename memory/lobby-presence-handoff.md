# Váró: élő jelenlét és kezdőlapi háttér – koordináció

2026-09-24. Állapot: kész, a `main`-ben; ág és worktree törölve.
Új host-/játékosnézet a `LiveGamePanel`-en át automatikusan kapja a jelenlétet
(`LiveApi.presence`). Új Realtime-csatornánál új RLS-szabály kell a `realtime.messages`-en
(0008 mintájára). Kézi frissítőgomb nincs; e2e-ben szerveresemény (`hub.change`) szinkronizál.
Részletek: `docs/lobby.md`, `memory/sessions/2026-09-24-lobby-presence.md`.
