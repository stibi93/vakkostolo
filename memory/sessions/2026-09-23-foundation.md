# 2026-09-23 — projektalap átadása

## Elkészült

Futtatható helyi React-demo, PostgreSQL-adatmodell RLS-sel és válaszbeküldéssel,
CI- és tesztalapok. Termékterv, architektúra, költség és ütemezés, AI és memória.
Belépési pont: `README.md`; tartós döntés: `docs/decisions/001-foundation.md`.

## Ellenőrzés

`npm run check`: 25 teszt, lint, típusok és build sikeres.
Playwright: 4 teszt sikeres asztali és mobilméretű Chromiumban; a képernyőképek
alapján mobilon a játékos elsőként az értékelést látja. Két skill formai validációja sikeres.
Nem történt valódi Supabase Auth/Realtime, fizikai telefonteszt vagy felhődeploy.

## Döntések

A felhasználó praktikus, korszerű, elfogadott keretrendszereket kért.
React/Vite/TypeScript + Supabase/PostgreSQL lett a választás, külön webszerver
és kötelező futásidejű AI nélkül. A játék titkos és felfedett adatai külön táblán vannak.
Az ártipp és alkohol pontozható; a tetszés szubjektív, nem ad versenypontot.

## Folytatás

Host Auth → játék létrehozása → meghívó/QR → két anonim vendég közös váróban.
Ehhez helyi Supabase stack vagy a felhasználó tesztprojektje, Auth-konfiguráció,
generált DB-típusok és új RPC-migráció kell. A meglévő demo ezután kap valódi adatadaptert.
