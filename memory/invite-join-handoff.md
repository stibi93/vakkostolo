# Meghívó/QR és anonim vendégbelépés — párhuzamos munkamenet

Dátum: 2026-09-24. Állapot: kész, beolvasztásra vár.

- Ág: `feat/invite-join`, commit `b3d368a`, a `feat/game-creation` `2bf98af` commitjára
  építve. Worktree: `/tmp/vakkostolo-invite-join` (saját `node_modules`).
- A meghívó még nincs a `main`-ben. A játék létrehozása már a `86cc50d` commitban
  szerepel, összevont változásként. Integrációkor csak a `2bf98af` utáni saját
  meghívóváltozást kell átvinni a friss `main`-re; az alap játékcommitokat ne ismételd.
  A közös új arculatot, márkanevet és mobilos gombjavítást meg kell őrizni.
- Tartalom: `202609240002_invites_join.sql` (`issue_invite`, `join_game`), `src/invites/`,
  `/join/:token`, host QR-panel a `HostWorkspace` részletnézetében, `qrcode-generator`
  2.0.4, generált DB-típusok, docs (`database.md`, `product.md`, `roadmap.md`) és
  `memory/sessions/2026-09-24-invite-join.md`.
- Érintett közös fájlok beolvasztáskor: `src/games/HostWorkspace.tsx`, `src/auth/HostArea.tsx`,
  `src/auth/runtime.ts`, `src/app/App.tsx`, `playwright.config.ts` (új `invite.spec.ts`
  a hitelesített projektekben), `package.json`/lockfile, `src/lib/database.types.ts`.
  A típusfájlt ütközésnél `npm run db:types`-szal kell újragenerálni, nem kézzel összefésülni.
- Ellenőrzés a `2bf98af` alapon: `npm run check` 138 teszt zöld; Playwright 38/38
  (`PLAYWRIGHT_BASE_PORT=4193`). A `auth.spec.ts` Google PKCE mobilpróbája egyszer
  időtúllépett párhuzamos terhelés alatt, külön 8/8 és teljes újrafuttatásban zöld.
