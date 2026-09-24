# Aktuális munkamenet

Dátum: 2026-09-23. Aktuális mérföldkő: arculat átdolgozása, a projektalap után.

## Legutóbbi változás: arculat

- A felhasználó túl AI-generált hatásúnak találta a korábbi megjelenést, és kreatívabb
  arculatot kért. Új munkaverzió: nyomtatott borklub-plakát és kóstolólap.
- Sárga/fekete/piros színvilág, Bricolage Grotesque + IBM Plex Mono helyi fontok,
  új palack-SVG, egyenes lapkeretek, perforált borsorjegy, közvetlenebb szövegek.
  A fontcsomagok 5.3.0 verzión rögzítve; licencek: `public/FONT-LICENSES.txt`.
- Érintett: `src/styles.css`, `src/demo/DemoApp.tsx`, új `TastingArtwork.tsx`,
  `src/main.tsx`, `index.html`, npm-csomagok és lockfile, meglévő E2E-próba.
  Rövid arculati útmutató: `docs/design.md`.
- Mobilon a játékosnézet közvetlenül a kóstolólapot mutatja, melléklista nélkül.
  A keskeny hostplakáton az illusztráció rejtett, hogy a címet ne takarja.
- Újra lefutott: `npm run check` (25 teszt, típus, lint, build), Playwright
  (4 próba asztali és 360 px Chromiumban). Host/játékos képernyőképek átnézve,
  mobil cím/rajz átfedés javítva. Valódi iOS/Android teszt nem volt.
- A fejlesztői szerver továbbra is a `http://localhost:5173/` címen fut;
  a friss HTML elérését ellenőriztük. Felhasználói jóváhagyás az új arculatról
  még nem érkezett. A játékszabályok és a backend készültsége nem változott.

## Elkészült

- Termékterv, architektúra, adatmodell, időbecslés, üzemeltetési és AI-terv a `docs/` alatt.
- React 19 + Vite 8 + strict TypeScript projekt, rögzített függőségek és npm-lockfile.
- Magyar, reszponzív demo: host, játékos, prezentáció; 3 mintabor; időzítés,
  válaszadás, blokkos felfedés, v1 pontozás. Egy böngészőlapon, memóriában fut.
- SQL-migráció 8 táblával, RLS-sel és szerveridőt ellenőrző submit_rating RPC-vel.
- Helyi Supabase-konfiguráció; kliensgyár, amelyet a demo még nem használ.
- AGENTS.md, skills.md, két validált skill; rövid/hosszú memória és ADR.
- Kikapcsolt termék-AI szerződés és költségmentes determinista összegző.
- GitHub Actions CI, Dependabot-konfiguráció, környezeti minta, statikus hosting fájlok.

## Ellenőrzések — 2026-09-23

- `npm run check`: sikeres típusellenőrzés, ESLint, 25 teszt, production build.
- `npm run test:e2e`: 4 sikeres Chromium-próba (asztali + 360 px mobilméret).
  A környezet meglévő Chromiumát PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH felülírással
  használtuk; a localhost-szerverhez sandboxon kívüli futtatás kellett.
- Asztali host- és mobil játékosképernyő kézzel is átnézve. A mobil játékosnézetben
  a hero rejtett, hogy a bevitel előrébb kerüljön. Képek: `test-results/` (nem verziózott).
- Két skill: `quick_validate.py` sikeres. Telepítéskori npm audit: 0 ismert sérülékenység.
- A PGlite-tesztek a tényleges migrációt futtatják Auth UID tesztadapterrel;
  nem ellenőrzik a Supabase gatewayt, valódi JWT-t, OAuth-t és Realtime-ot.

## Még nem kész

Valódi Auth/Google-belépés, QR-meghívó és közös váró, host CRUD és lifecycle RPC-k,
Realtime/snapshot/reconnect, szerveroldali eredményszámítás és felhőtelepítés.
A demo nem küld adatot szerverre, frissítéskor elveszti az állapotot. A borfixture-ök
a demo bundle-ben vannak, ezért az nem használható valódi vakjátékhoz.
Valódi iOS/Android és többeszközös teszt, teljes Docker/Supabase stack és távoli CI
nem futott. A következő fázis előtt az éles adatadaptert és DTO-kat kell elkészíteni.

Következő érdemi fejlesztési szelet: host-bejelentkezés → játék létrehozása →
QR-meghívó → két anonim vendég közös váróban. Lásd `docs/roadmap.md`.

Külső szolgáltatás, távoli repository és éles deploy nincs. A `.git`, `.agents`
és `.codex` környezeti helyőrzők csak olvashatók. A skillek a `skills/` alatt vannak.

## Designáttekintés — 2026-09-23

- A felhasználó a meglévő designalapról és designrendszer hozzáadásáról kért
  magyarázatot; implementációs döntés nem született.
- A package.json és a frontend forrásának ellenőrzése alapján nincs telepített
  UI-keretrendszer. Saját CSS, három központi színváltozó, közös gombstílusok
  és reszponzív szabályok adják az alapot; a felület a DemoApp.tsx-ben van.
- Lehetséges következő designlépés: közös vizuális értékek és újrahasználható
  UI-komponensek kialakítása, rövid designútmutatóval. Ez javaslat, nem elfogadott döntés.
- Ebben az áttekintésben alkalmazáskód nem változott, tesztet nem futtattunk.

## Játékmesteri panel áttekintése — 2026-09-23

- A felhasználó a tervezett adminfelület működéséről kért magyarázatot.
- Az architektúra, roadmap, adatbázisleírás és migráció ellenőrzése alapján
  a hostpanel ugyanazon React-alkalmazás védett része lesz. A jelenlegi demó
  helyi vezérlő; a host Auth, játékszerkesztő és életciklus-RPC-k még hiányoznak.
- A következő konkrét fejlesztési szelet továbbra is a host-belépés, játék-
  létrehozás és közös váró. Új termékdöntés vagy alkalmazáskód-módosítás nem történt;
  tesztet ebben a magyarázó munkamenetben nem futtattunk.

## Stackválasztás indoklása — 2026-09-23

- Az ADR 001 a kis alkalmazás és egyszerű üzemeltetés alapján indokolja a
  React/Vite + Supabase alapot; részletes React–Angular összevetést nem tartalmaz.
  A felhasználó indoklást kért, technológiaváltást nem rendelt el.
- Hivatalos webes dokumentáció ellenőrizve: Angular beépített routing/forms/DI;
  React/Vite esetén további alkalmazásszerkezeti döntések szükségesek;
  Vercel támogatja a Vite-ot, Hobby csomagja személyes, nem kereskedelmi használatra való.
- Pontosítandó hostingjavaslat: a Cloudflare új projektekhez Workers Static Assets
  használatát ajánlja a Pages helyett. Forrás:
  https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#use-workers-static-assets-for-new-projects
  A Pages működik, de az új fejlesztések a Workersre összpontosulnak.
- Következő hostinglépés: élesítés előtt a jelenlegi Pages-terv felülvizsgálata
  Workers Static Assets / Vercel irányban. Elfogadott váltás vagy deploy nem történt.
  Alkalmazáskód nem változott, új tesztfuttatás nem volt.
