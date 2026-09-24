# Játék létrehozása — átadás

Dátum: 2026-09-24. Állapot: kész, a `main` ágon commitolva (`86cc50d`).

- Ág: `feat/game-creation`, alap: `59d3a24`.
  Worktree: `/tmp/vakpohar-game-creation-20260924` (tiszta).
- Commitok: `56ee061` backend/típusgenerálás, `2bf98af` adapter/űrlap/hostnézet,
  `4c3095b` mobil főgomb és másodlagos kijelentkezés, integrációs átadás.
- A meghívó-agent a snapshot utáni saját módosításait erre az ágra helyezheti át.
  A közös `main` ágon a saját diff a `86cc50d` commitban MÁR bent van; ne alkalmazd
  újra. A feature-ág három commitja itt egy fejlesztési egységként lett rögzítve,
  a felhasználó kifejezett commitkérésére.
- Megőriztem a közös név/szöveg/design/Auth változásokat. Az egyetlen kézi
  konfigurációs összeillesztés a Playwright külön portjai + `vakkostolo` teszthost;
  az új `tests/e2e/games.spec.ts` mockcíme is az új nevet használja a közös fán.
  A saját ág alapjában még a korábbi márkanév/arculat van: teljes fájlmásolás kerülendő.

## Szerződés

- `create_game(p_request_id, p_title, p_round_seconds, p_reveal_every, p_wines) → uuid`.
  Draft játék, pending körök, titkos boradat, audit. Hosthoz kötött idempotencia;
  azonos kérés ugyanaz az ID, eltérő payload `REQUEST_ID_CONFLICT`. Meghívó nem készül.
- `list_host_games() → jsonb`, `get_host_game(p_game_id) → jsonb` csak saját hostnak.
  Pontos DTO, tartományok és hibák: `docs/database.md`.
- A `private.require_permanent_user() → uuid` a kanonikus Auth-sort ellenőrzi;
  közvetlen klienshívása tiltott, definer RPC-ből újrahasználható.
- A `202609240002` migráció a meghívó/vendégbelépés agent munkája.
  Az összes migrációt a `scripts/database-harness.mjs` tölti be. Új RPC után
  `npm run db:types`; `npm run check` ellenőrzi a generált fájlt.
- Integrációs pontok: `HostWorkspace`, `auth/runtime`, `App`, npm scriptek,
  generált típusok, docs/memória. Új oldal saját CSS-ben használja a közös tokeneket.

## Ellenőrzés és következő lépés

- Saját és közös `npm run check`: 110 sikeres teszt, típusok/lint/build rendben.
- Teljes közös E2E: 32 sikeres próba. A végső stílusjavítás után check és a 10
  érintett játék-E2E ismét sikeres. Saját telepítés, két worker, 4195/4196 port;
  a tesztszerverek leálltak. Az utóbbi futás a közös új arculatot használta.
- 360/1280 px renderelt létrehozó, mentett és hibás képernyők átnézve,
  billentyűzetes mentés és hibafókusz próbálva. Képek: `test-results/game-creation-final/`.
- Nem valódi Google/Supabase/Realtime vagy többkapcsolatos PostgreSQL-próba;
  a helyi PGlite és HTTP-fixture korlátja dokumentált. Távoli migráció/deploy nem történt.
- Következő: a párhuzamos meghívó/QR és anonim vendégbelépés integrálása, majd
  snapshot/Realtime közös váró és valódi kétklienses próba. Ezt az egységet
  ne kezdd el másodszor; lásd `memory/invite-join-handoff.md`.
