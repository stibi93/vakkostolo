# Borfotó a játékmesteri borlistához – koordináció

2026-09-24. Állapot: az integrációs munkamenet beépítette és ellenőrizte a main ágon. Worktree: `/tmp/vakkostolo-wine-photos-20260924`, ág: `feat/wine-photos`.
Érintett: új migráció `202609240010_wine_photos.sql` (privát `wine-photos` Storage-bucket, szabályok,
`get_host_game` bővítése), `scripts/database-harness.mjs` (Storage-csonk), `src/games/*`, új
`src/games/photo*.ts`, `src/lib/database.types.ts`, `tests/e2e/games.spec.ts`, DB-/games-tesztek, docs.
A `tests/e2e/live.spec.ts` commitolatlan módosításához (másik munkamenet) nem nyúlok.

A forrás-worktree érintetlenül megmaradt; a régi diffet ne alkalmazzuk újra.
Az integráció HostWorkspace roundId-kulcsot, státuszváltási frissítést,
Storage-törlés visszaigazolást és felfedési képet is adott hozzá.
Check 276/276, teljes E2E 82/82, utána célzott 30 + 4 próba sikeres;
valódi helyi Storage és kóstolómenet teszt sikeres. Lásd docs/wine-photos.md.
