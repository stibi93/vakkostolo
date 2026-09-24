# Közös váró — 2026-09-24

Állapot: kész, a közös mainben. Feature: `2d24cee`; kivetítő-integráció:
`cf69278`; végső tesztsegéd/CSS és átadás az ezeket követő commitban.
Worktree: `/tmp/vakkostolo-shared-lobby-20260924`, ág: `feat/shared-lobby`.
A végső integrációs javítások a mainben vannak; a feature-ágat ne alkalmazd újra.
Saját E2E-portok: 4215/4216. Nincs push vagy külső deploy.

## Elkészült

- 003 migráció, `get_lobby_snapshot`: host/tag ellenőrzése egy pillanatképen;
  biztonságos mezők, sorszámozott résztvevők. Generált típusok frissítve.
- `src/lobby/`: futásidejű DTO-validálás, versengő kéréseket kezelő store,
  Realtime + 15 s tartaléklekérés, háttérből visszatérés, offline és jogosultsági
  hibák. Kijelentkezés után késői válasz nem hozhatja vissza a régi listát.
- Közös lista a hostoldalon és a kivetítőn; vendég belépés után `/play/:gameId`.
  A LAN/publicAppOrigin és a külön arculati fejlesztés megmaradt.
- A helyi Supabase-en a 003 már alkalmazott migráció, ne szerkeszd visszamenőleg.
  A Realtime valódi próbája miatt Postgres-visszaigazolást várunk, nem pusztán
  websocket-kapcsolatot. A böngészős tesztkiszolgáló kapcsolatonként különíti
  el az azonos nevű csatornákat, ahogy az igazi szerver.

## Ellenőrzések

- Közös forráson `npm run check`: 169 teszt / 11 fájl, típusgenerálás,
  TypeScript, lint, production build sikeres. A végső tesztsegéd/CSS után
  típusellenőrzés és lint ismét sikeres.
- Teljes végső Playwright: 50/50. Host és két külön vendég, azonos becenevek,
  újratöltés, események, polling, offline/503, hibás DTO, idegen játék,
  hozzáférésvesztés és kivetítő élő frissülése. HTTP/websocket szintetikus.
- Mobil és desktop váró, hibás állapotok, kivetítő renderelve és átnézve az új
  arculattal. Képek: `test-results/shared-lobby-final/` (Gitből kizárt).
- `npm run test:lobby:local`: valódi helyi Auth/REST/RLS/Realtime sikeres;
  két anonim vendég, idegen snapshot/csatorna kizárása, titkos boradat védelme,
  meghívócsere és új előfizetés. Csak a saját négy szintetikus felhasználó és
  kapcsolódó tesztadatok törölve. Kulcs és játékosadat nincs elmentve.

## Következő lépés és korlát

Első élő kör szerveroldali indítása, verzió/sorzár/határidő és jogosultság,
majd játékossnapshot és kóstolólap. A kör indítása és a beküldés még nem működik.
Google OAuth, hosztolt Supabase és fizikai telefon/LAN próba külön ellenőrzési
kapu. A számozott arculat saját, még nem commitolt változásait ez a munkamenet
nem commitolja. Szerződés: `docs/lobby.md`; sorrend: `docs/roadmap.md`.
