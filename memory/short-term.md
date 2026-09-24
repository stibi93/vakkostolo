# Aktuális munkamenet

Dátum: 2026-09-24. Aktuális mérföldkő: Git és alkalmazásváz.

## Elkészült

- A felhasználó az implementáció megkezdését, Git-repositoryt és logikus
  fejlesztési egységeket kért, elsőként scaffoldingot.
- A meglévő React/Vite/TypeScript projektet, demót, DB-alapot és dokumentációt
  megőriztük. Helyi Git inicializálva `main` ágon; az első commit
  `c80581d` (`chore: preserve existing project foundation`).
- Külön alkalmazásbelépési pont: `src/app/App.tsx`, magyar kezdőlap (`/`),
  közös oldalkeret és ismeretlen útvonalról visszalépés.
- A korábbi háromnézetes demo a `/demo` útvonalon fut, dinamikus importtal.
  A kezdőlap nem tölti be a mintaborok modulját; ez nem biztonsági védelem,
  a demo JS-csomagja továbbra is publikus. Frissítéskor a demo állapota elvész.
- Natív linkes navigáció; a demo fejlécéből vissza lehet térni a kezdőlapra.
  Billentyűzetes tartalomra ugrás és betöltési állapot is van.
- README, architektúra, termékterv és roadmap aktualizálva. A roadmap külön
  fejlesztési egységeket és ellenőrzési feltételeket tartalmaz.
- A meglévő arculat maradt: sárga/fekete/piros, helyi Bricolage Grotesque és
  IBM Plex Mono fontok. A színvilág továbbra is finomítható munkaverzió.

## Ellenőrzések — 2026-09-24

- A kiinduló állapoton és a végső kódon is sikeres `npm run check`:
  típusellenőrzés, ESLint, 25 domain/PGlite teszt, production build.
- 8 sikeres Playwright-próba asztali és 360 px mobilméretben: kezdőlap,
  billentyűzetes navigáció, demo megnyitása/újratöltése, ismeretlen útvonal,
  teljes demójáték és időkorlát.
- A sima `npm run test:e2e` indításkor nem találta a hozzá tartozó böngészőt.
  Sikeres futtatás: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/google/chrome/chrome npm run test:e2e`.
  Más gépen az alapfolyamat: `npx playwright install chromium`.
- Asztali és mobil kezdőlap-képernyőképek átnézve; nincs vízszintes túlcsordulás.
  Képek a Gitből kizárt `test-results/` alatt.
- A production build külön `DemoApp-*.js` fájlt készít. A navigációs teszt
  ellenőrzi, hogy a kezdőlap nem kér demo-modult.
- Valódi iOS/Android, Supabase Auth/Realtime, többeszközös és távoli CI-próba nem volt.
  A PGlite-tesztek továbbra sem helyettesítik ezeket.

## Még nem kész

Host/Google és anonim vendég Auth, játék-létrehozás, QR-meghívó, közös váró,
host CRUD és lifecycle RPC-k, Realtime/snapshot/reconnect, szerveroldali
pontozás, felhőtelepítés. A `/host`, `/join/:token`, `/play/:gameId`,
`/present/:gameId` egyelőre útvonaltervek, nem működő oldalak.

Távoli repository nincs beállítva, külső fiók vagy deploy nem jött létre.
A helyi Git immár írható és működő repository; a korábbi helyőrzőre vonatkozó
jegyzet elavult. A skillek továbbra is a `skills/` alatt vannak.

## Következő konkrét lépés

Auth és adatkapcsolat külön fejlesztési egységként: központi router,
host-belépés/kilépés, munkamenet-visszaállítás, konfigurációs és hálózati hibák.
Utána játék-létrehozás, meghívó/vendégbelépés, majd snapshot/Realtime közös váró.
A teljes következő termékszelet változatlanul: host → játék → QR → két vendég
közös váróban. Az adapter generált Supabase-típusokat és a snapshot határán
futásidejű validálást kapjon. Lásd `docs/roadmap.md`.
