# Aktuális munkamenet

Dátum: 2026-09-24. Aktuális mérföldkő: host Auth és adatkapcsolat kliensoldali egysége.

## Elkészült

- React Router 8.4.0, rögzített függőség és lockfile. Útvonalak: `/`, `/demo`,
  `/host`, `/auth/callback`; a demo és az Auth külön, lazy betöltött modul.
- Google OAuth PKCE-belépés, egyszeri kódbeváltás StrictMode mellett is,
  callbackkódok/hibarészletek eltávolítása az URL-ből, rögzített saját visszatérési cél.
- Szerverrel ellenőrzött munkamenet-visszaállítás (`getUser`), helyi hatókörű
  kijelentkezés, Auth-események, lapfókusz és hálózati visszatérés kezelése.
- Anonim munkamenet nem kap hostkezdőnézetet. A felületi elágazás nem DB-jogosultság:
  játék-létrehozó API még nincs; a host és tulajdonjog ellenőrzése a következő RPC feladata.
- Hiányzó/hibás publikus konfiguráció külön felületet kap. Publishable és legacy
  anon kulcs támogatott, privilegizált kulcs és nem HTTPS távoli URL elutasítva.
  A VITE-változó továbbra is publikus; az ellenőrzés nem titkosítja a buildet.
- Magyar hibaállapotok, újrapróbálás, hálózati és műveleti időkorlát, késői
  válaszok elleni védelem. A demo változatlanul helyi, nem többjátékos próba.
- Útmutató: `docs/auth.md`; README, roadmap, architektúra, product/operations,
  `.env.example` és helyi Supabase callback-allowlist aktualizálva.
- A párhuzamos szövegezési munka feliratai megőrizve, az Auth-próbák elvárásai
  az új „Játékmesteri fiók” címhez igazítva. Átadás: `memory/ui-copy-handoff.md`.
  Az Auth-commitból a már követett fájlok külön szövegcseréi kimaradnak;
  ezek és a szövegezési jegyzetek a munkapéldányban megmaradnak.

## Ellenőrzések — 2026-09-24

- `npm run check`: sikeres típusellenőrzés, lint, 49 teszt és production build.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/google/chrome/chrome npm run test:e2e`:
  22 sikeres próba asztali és 360 px mobilméretben, köztük PKCE-kódcsere,
  újratöltés, két lap kijelentkezése, anonim fiók, callbackhiba és újrapróbálás.
- Az E2E két izolált Vite-szervert indít (4173 konfigurálatlan, 4174 szintetikus
  Auth-konfigurációval). A valódi Supabase SDK Auth HTTP-válaszai helyettesítettek;
  a fejlesztő saját projektjét és kulcsait a teszt nem használja.
- A `frontend-design` skill az új felhasználói utasítás szerint alkalmazva.
  A belépési, belépett és callbackhibás nézet képei asztali és 360 px szélességen
  átnézve; a hibagombok fölötti térköz javítva, a két érintett próba újrafuttatva.
  A belépés Tab/Enter billentyűzettel is végigpróbálva (4 célzott próba).
  A teljes 22 böngészős próba a térközjavítás előtt sikeres volt.
- npm install: 0 ismert sérülékenység. Új DB-migráció nem kellett, RLS nem változott.
- Valódi Google/Supabase Auth, Docker stack, iOS/Android, többeszközös játék,
  Realtime és távoli CI nem futott. A szimulált Auth és PGlite ezeket nem helyettesíti.

## Hiányzó részek és következő konkrét lépés

Következő fejlesztési egység: játék létrehozása. Új `create_game` migráció,
tartós host-auth szerveroldali ellenőrzése, generált DB-típusok, típusos adapter,
magyar létrehozó űrlap és jogosultsági/adatvalidációs tesztek.
Utána meghívó/QR és anonim vendégbelépés, snapshot/Realtime közös váró.
A teljes belépés/váró mérföldkő még nincs kész.

Az igazi Google-belépéshez tesztprojekt, publikus frontend-konfiguráció és
Google provider/callback-beállítás szükséges a `docs/auth.md` szerint.
Távoli repository és deploy továbbra sincs beállítva. A helyi Git `main` ágon működik.
