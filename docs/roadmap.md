# Megvalósítási terv

A becslések egy fejlesztő fókuszált munkaóráira vonatkozó tervezési sávok,
nem garantált szállítási határidők. Fiókbeállításra és valódi eszköztesztre
várakozás nincs bennük. AI-támogatott fejlesztés mellett is szükséges ellenőrzés.

| Fázis | Tartalom / kimenet | Becsült óra | Állapot |
| --- | --- | ---: | --- |
| 0. Projektalap | termékterv, architektúra, frontend-váz, CI, DB-alap és tesztek | 8–12 | helyi alap kész |
| 1. Fejlesztői AI és memória | AGENTS, skillek, rövid/hosszú memória, átadás | 3–5 | alap kész |
| 2. Belépés és váró | host Auth, vendég Auth, meghívó/QR, tagság, visszatérés | 8–12 | helyi Auth, meghívó és közös váró kész; fizikai eszközpróba hátravan |
| 3. Élő játék | host szerkesztő, RPC állapotgép, Realtime, időzítés, értékelő | 14–22 | tervezett |
| 4. Felfedés és eredmények | blokkos felfedés, szerverpontozás, kivetítő, ranglista | 10–16 | tervezett |
| 5. Pilot és kiadás | jogosultsági integráció, eszközök, hálózati hibák, deploy, mentés | 10–16 | tervezett |
| 6. Eredmény e-mailben | kóstoló végén a Google-fiókos (vagy e-mailt megadó) játékos kérheti az eredményét; külön hozzájárulás, e-mail-szolgáltató | 3–5 | tervezett |
| 6. Opcionális AI a termékben | anonim eredmény-összefoglaló, értékelés, költségkorlát | 6–10 | MVP után |

MVP összesen 53–83 óra tervezési keret; 20% tartalékkal kb. 64–100 óra.
A késznek jelölt sorok keretbecslések, nem utólag mért ráfordítások.
Az opcionális futásidejű AI további 6–10 óra, nem része az MVP-összegnek.

## Önálló fejlesztési egységek

Minden egység külön, működő és ellenőrzött commit legyen; nagyobb szeletnél
több összetartozó commit megengedett. Új migráció külön fájlba kerül.

| Egység | Kimenet és ellenőrzési feltétel | Állapot |
| --- | --- | --- |
| Projektalap rögzítése | meglévő források, tervek és lockfile helyi Gitben; `npm run check` | kész |
| Alkalmazásváz | magyar kezdőlap, külön `/demo`, ismeretlen oldal, mobil navigációs próba | kész |
| Auth és adatkapcsolat | központi router, host-belépés/kilépés, munkamenet-visszaállítás, konfigurációs és hálózati hibák kezelése | kliens kész, szimulált Auth-próbákkal; valódi integráció hátravan |
| Játék létrehozása | atomikus, idempotens `create_game`, hostlista/részletek, típusos adapter és magyar űrlap | helyi implementáció és tesztek kész; Supabase-integráció hátravan |
| Meghívó és vendégbelépés | `issue_invite`/`join_game`, QR, anonim Auth; meghívó nem ad hostjogot | kliens és DB kész; helyi Supabase-en valódi próba lefutott; LAN-próba `npm run dev:lan`-nal; telefonos próba hátravan |
| Kivetítő váró | `/present/:gameId`: cím, QR, link, becenevek, boradat nélkül | kész (host böngészőjének másik lapja) |
| Közös váró | validált snapshot, Realtime és reconnect; két vendég, újratöltés és idegen játék tiltása | implementáció és helyi Supabase-próba kész; fizikai eszközök hátravannak |
| Első élő kör és válaszadás | idempotens indítás, szerverhatáridő, saját mentett tipp és visszatérés | helyi implementáció és valódi Supabase-próba kész |
| További körvezérlés | korai zárás, hosszabbítás, következő kör és blokkhatár | következő egység |
| Felfedés és eredmények | szerverpontozás, blokkos felfedés, ranglista és kivetítő | tervezett |

Az utolsó két egység további, külön ellenőrizhető szeletekre bontandó a megvalósításkor.
A belépés/váró mérföldkő csak valódi Supabase Auth és több kliens integrációs
próbája után tekinthető késznek; a helyi PGlite-próba önmagában nem elég.

## Következő konkrét fejlesztési szelet

Egy host bejelentkezik, létrehoz egy játékot, megnyitja a várót; két telefon
ugyanazon QR-ról anonim vendégként belép, újratöltéskor megőrzi tagságát.
Ehhez create_game/open_lobby/join_game RPC, Supabase Auth-konfiguráció,
meghívókezelés, QR-generálás és a demo helyett valódi adatadapter szükséges.
A host Auth és a játék létrehozásának helyi implementációja elkészült.
A meghívó/QR, anonim vendégbelépés és közös váró snapshot/Realtime elkészült.
Az első kör szerveroldali indítása és a saját tippek beküldése is elkészült.
A következő egység a korai körzárás, hosszabbítás és a következő tétel indítása,
a blokkos felfedéshez szükséges állapotátmenetekkel.
A fizikai telefonos és hosztolt integráció külön ellenőrzési kapu.
A külső tesztprojekt Google/Supabase beállítása a `docs/auth.md` alapján végezhető.
Az adapter a migrációból generált Supabase TypeScript-típusokat használja;
a snapshot válaszát futásidőben is validálni kell a határon.
Kész, ha az idegen játék olvasása továbbra is tiltott és a QR nem ad hostjogot.

## Függőségi sorrend

Auth + tagság → játék-RPC-k → Realtime/snapshot → értékelés → felfedés → ranglista.
A dizájn finomítása párhuzamosan haladhat a DB-munkával. A termék-AI csak a
determinista eredmények után kapcsolható be; nem blokkolja a játékot.

## Kiadási kapuk

- A `npm run check` zöld, lockfile verziózott.
- Supabase tesztprojektben valódi anonim és Google Auth + RLS ellenőrizve.
- 10 eszközös próbakóstoló; háttérbe tett telefon, reconnect, két hostlap tesztelve.
- Telefonon a titkos adatok nem szerepelnek API-válaszban vagy éles bundle-ben.
- Esemény előtt projekt aktív, kvóták elegendők, mentés visszaállítása kipróbálva.
- A demo nincs összetéveszthetően éles játék néven közzétéve.

## Később eldönthető preferenciák

A munkanév, végleges színvilág, pontképlet és alap felfedési gyakoriság
változtatható. Több pénznem, egyedi kérdések, csapatjáték, export, host nélküli
eredménymegosztás és játékosfiókhoz kötött történet külön bővítés.
