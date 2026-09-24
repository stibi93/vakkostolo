# Megvalósítási terv

A becslések egy fejlesztő fókuszált munkaóráira vonatkozó tervezési sávok,
nem garantált szállítási határidők. Fiókbeállításra és valódi eszköztesztre
várakozás nincs bennük. AI-támogatott fejlesztés mellett is szükséges ellenőrzés.

| Fázis | Tartalom / kimenet | Becsült óra | Állapot |
| --- | --- | ---: | --- |
| 0. Projektalap | termékterv, architektúra, frontend-váz, CI, DB-alap és tesztek | 8–12 | jelen átadás |
| 1. Fejlesztői AI és memória | AGENTS, skillek, rövid/hosszú memória, átadás | 3–5 | jelen átadás |
| 2. Belépés és váró | host Auth, vendég Auth, meghívó/QR, tagság, visszatérés | 8–12 | következik |
| 3. Élő játék | host szerkesztő, RPC állapotgép, Realtime, időzítés, értékelő | 14–22 | tervezett |
| 4. Felfedés és eredmények | blokkos felfedés, szerverpontozás, kivetítő, ranglista | 10–16 | tervezett |
| 5. Pilot és kiadás | jogosultsági integráció, eszközök, hálózati hibák, deploy, mentés | 10–16 | tervezett |
| 6. Opcionális AI a termékben | anonim eredmény-összefoglaló, értékelés, költségkorlát | 6–10 | MVP után |

MVP összesen 53–83 óra tervezési keret; 20% tartalékkal kb. 64–100 óra.
A jelen átadásra jelölt sorok keretbecslések, nem utólag mért ráfordítások.
Az opcionális futásidejű AI további 6–10 óra, nem része az MVP-összegnek.

## Következő konkrét fejlesztési szelet

Egy host bejelentkezik, létrehoz egy játékot, megnyitja a várót; két telefon
ugyanazon QR-ról anonim vendégként belép, újratöltéskor megőrzi tagságát.
Ehhez create_game/open_lobby/join_game RPC, Supabase Auth-konfiguráció,
meghívókezelés, QR-generálás és a demo helyett valódi adatadapter szükséges.
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
