# Aktuális munkamenet

## Közös váró elkészült — 2026-09-24

- A közös váró a main ágon: `2d24cee`, kivetítő-integráció `cf69278` és az
  ezeket követő ellenőrzési/átadási commit. Host, vendég és kivetítő ugyanazt
  a jogosultsággal védett snapshotot és Realtime-frissítést használja.
- Belépés után `/play/:gameId`, újratöltéskor megmaradó tagság, azonos becenevek
  sorszámozva; 15 másodperces tartalékfrissítés, hálózati hibajelzés és visszatérés.
  Jogosultságvesztéskor a korábbi lista eltűnik; boradat nem kerül a snapshotba.
- A 003 migráció a helyi Supabase-re alkalmazva. Valódi Auth/REST/RLS/Realtime
  próba sikeres; a saját szintetikus adatok kitakarítva. Újrafuttatás:
  `npm run test:lobby:local`. Google OAuth és fizikai telefonos próba hátravan.
- Integrált `npm run check`: 169 teszt, típusok, lint és build sikeres.
  Végső Playwright 50/50; az utolsó tesztsegéd/CSS javítás után típusellenőrzés
  és lint is sikeres. Mobil/asztali váró, elavult és tiltott állapot, kivetítő
  renderelve és átnézve: `test-results/shared-lobby-final/` (nem verziózott).
- A párhuzamos arculati munka megmaradt; annak külön, még nem commitolt
  változásai nem részei a váró commitjainak. Átadás: `memory/shared-lobby-handoff.md`.
- Következő fejlesztés: első élő kör szerveroldali indítása (hostjog, sorzár,
  verzióellenőrzés, határidő), majd védett játékossnapshot és kóstolólap.
  A lentebbi közösváró-tervek korábbi állapotot írnak le.

Dátum: 2026-09-24. A felhasználó kérésére a közös munkapéldány elkészült
változásai a `main` ágon, két logikus egységben rögzítve.

## Elkészült

- `86cc50d`: játék létrehozása. Kanonikus tartós Auth, atomikus és idempotens
  `create_game`, hostlista és részletes boradatok, generált DB-típusok, adapter,
  magyar űrlap és `/host/:gameId`. A feature-ág saját commitjai összevonva kerültek
  a mainre; nem szabad őket ismét alkalmazni. Átadás: `memory/game-creation-handoff.md`.
- A következő commit a Vakkóstoló nevet, jóváhagyott bordó–törtfehér arculatot,
  természetes magyar szövegeket, designelőnézeteket és összefésült projektjegyzeteket
  rögzíti. Georgia címek, Arial UI, közös CSS-tokenek; mobilon teljes szélességű
  mentés, másodlagos kijelentkezés. Átadások: `memory/design-handoff.md`,
  `memory/ui-copy-handoff.md`; arculat: `docs/design.md`.
- A korábbi host Google Auth, PKCE, munkamenet-visszaállítás és háttérellenőrzési
  javítás megmaradt. A demo továbbra is helyi, az online játéktól elkülönített próba.
- A párhuzamos agentek külön worktree-jeit és ágait ez a commitolás nem módosítja.
  A meghívó/QR implementáció külön `feat/invite-join` ágon kész (`b3d368a`),
  még nincs a közös mainben. Átadás: `memory/invite-join-handoff.md`.

## Ellenőrzések és korlátok

- Közvetlenül commit előtt új `npm run check`: típusgenerálás-ellenőrzés,
  TypeScript, lint, 110 teszt és production build sikeres.
- Az azonos alkalmazáskódon a legutóbbi teljes Playwright 32 sikeres próba;
  a végső gombstílus-javítás után 10 célzott játék-E2E is sikeres. Commitoláskor
  az alkalmazáskód nem változott, ezért ezeket nem ismételtük meg.
- Az új arculattal renderelt létrehozó, mentett és hibás képernyők 360/1280 px-en
  átnézve; billentyűzetes mentés és hibafókusz próbálva.
  Képek: `test-results/game-creation-final/` (Gitből kizárt).
- PGlite és szintetikus Auth/RPC HTTP-válaszok: valódi Google/Supabase/Realtime,
  többkapcsolatos PostgreSQL-versengés és fizikai telefonpróba még nincs igazolva.
- Távoli repository, push, migráció és deploy nem történt.

## Következő konkrét lépés

A kész meghívó/QR és anonim vendégbelépés saját változását kell átvinni a friss
mainre, az alap játékcommitok megismétlése nélkül. Új integráció után típusgenerálás,
check, böngészős és mobilos ellenőrzés. Utána közös váró: validált snapshot,
Realtime és visszatérés. Ne induljon második meghívó-implementáció.
A valódi Supabase tesztprojektben migráció, Google/anonim Auth, RLS és két kliens
közös próbája továbbra is kiadási kapu.
