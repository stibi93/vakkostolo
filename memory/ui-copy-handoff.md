# Felületi szövegek – párhuzamos munkamenet

Dátum: 2026-09-24. Állapot: kész, a szövegek a közös munkapéldányban vannak.

## Elkülönítés

- Szövegezési ág: `chore/plain-hungarian-copy`.
- Külön munkakönyvtár: `/tmp/wine-tasting-copy-20260924`.
- Feladat: természetes magyar felületi szövegek, erőltetett szlogenek és
  szóviccek nélkül. A demó korlátai és a használati útmutatások maradjanak világosak.
- Kizárólag szövegliterálok változnak a kezdőlapon, közös keretben, 404-oldalon,
  demóban, illusztráció feliratában és HTML-metaadatokban. A meglévő e2e-tesztek
  szöveges elvárásai követik ezeket.
- Nincs komponens-átszervezés, CSS-, függőség-, Auth-, adatbázis- vagy
  játékszabály-módosítás ebben a munkamenetben.

## Egyesítés

A külön munkakönyvtár megakadályozza a fejlesztés közbeni felülírást.
Ez a jegyzet tájékoztatás, nem a másik munkamenet által visszaigazolt fájlzár.
Beillesztés előtt az aktuális közös fájlokat újra kell olvasni. Csak a pontos,
még meglévő régi szöveg cserélhető; teljes fájlt nem szabad visszamásolni.
Az eltérő szövegek kézi összevetést igényelnek. Idegen módosításokat nem szabad
stagingelni, visszaállítani vagy saját commitba foglalni.

A külön munkakönyvtárban futó ellenőrzések saját build- és tesztkimenetet
használnak. Az egyesítés után a közös állapoton is szükséges ellenőrzés.
A rövid és hosszú távú memóriát az aktuális tartalmukhoz igazítva kell bővíteni,
a másik munkamenet bejegyzéseit megőrizve.

## Beillesztés és ellenőrzés

- A külön ágon a `32c66ac` commit őrzi a kiinduló felület szövegcseréit.
  Ezek már bekerültek a közös munkapéldányba; ne cherry-pickeld újra.
- A másik munkamenet React Router-, Auth-, CSS- és függőségváltozásai megmaradtak.
- Az új `src/auth/HostArea.tsx` négy felirata is egyszerűsítve: „ONLINE BELÉPÉS”,
  „Játékmester”, „Játékmesteri fiók”, „Nem sikerült ellenőrizni a belépést.”.
  Ezek az új fájlban vannak, a fenti commit nem tartalmazza őket.
- A külön ágon sikeres `npm run check` (25 teszt), majd 8 Playwright-próba a
  production builden, asztali és 360 px mobilméretben. A képek is átnézve.
- A közös `npm run check` végül sikeres: típusellenőrzés, lint, 48 teszt és
  production build. Az első futás Auth-teszthibáit a párhuzamos munkamenet
  javította; a szövegezési munkamenet nem módosította ezeket a teszteket.
- Az egyesített alkalmazás külön kimeneti könyvtárba készült buildjén is
  sikeres a 8 kezdőlap/demó Playwright-próba. Külön 4187-es port és saját
  tesztkimenet biztosította, hogy más futó fejlesztői szervert ne használjunk.
- Az új belépési oldal konfigurálatlan állapotának feliratai és elrendezése
  360 és 1280 px szélességen ellenőrizve; nincs vízszintes túlcsordulás.
- Következő lépés: az Auth-munkamenet végső integrációjakor a szövegcseréket
  és az új hangnemet megőrizni. A közös indexet ez a munkamenet nem módosította;
  a saját commit kizárólag a külön szövegezési ágon készült.

## Névváltás és arculati profil — 2026-09-24

A termék neve Vakkóstoló; a technikai azonosító `vakkostolo`. A package és
lockfile gyökérnevei, a Supabase helyi project_id és az Auth-tesztek szintetikus
hostneve is frissült. Integrációkor ezeket őrizd meg. A jóváhagyott Halves-alapú
bordó–törtfehér profil már a személyes frontend skill része; az alkalmazás vizuális
átvezetése is elkészült. Aktuális irány: `docs/design.md`; átadás: `memory/design-handoff.md`.
A felhasználó most kifejezetten kérte a közös munkapéldány változásainak commitolását;
a név-, arculati és szövegezési változások együtt kerülnek a `main` ágra.
