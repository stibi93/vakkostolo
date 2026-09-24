# Termékterv

## Cél és induló feltételezések

Baráti, személyes kóstoló, kezdetben 2–30 játékos és 1–12 bor. Tervezési cél,
nem bemért kapacitás. Magyar felület, HUF palackár (0,75 liter), alkoholtartalom
% vol, 1–10 egész tetszési érték. A játékmester kezeli a fizikai borokat és
a sorszámokat. A játékos csak „01. tétel” jelölést lát felfedésig.

## Szerepek és útvonalak

| Szerep | Tervezett felület | Feladat |
| --- | --- | --- |
| Játékos | `/join`, `/join/:token`, `/play/:gameId` | Meghívólink, becenév (anonim vagy opcionálisan Google-fiókkal), váró, saját tippek, engedélyezett eredmény |
| Játékmester | `/host`, `/host/:gameId` | Csak superadmin (felhasználónév + jelszó + hitelesítő kód): borok, meghívás, időzítő, körváltás, felfedés |
| Kivetítő | `/present/:gameId` | QR/váró, tételszám, felfedett eredmény, ranglista |

A hostbelépés, játéklétrehozás, meghívás, közös váró és az első élő kör
beküldése elkészült. A szerkeszthető menet, szünetek, időállítás és további körvezérlés is elkészült; a szerveroldali pontozás, saját eredmény és prezentációs ranglista is elkészült. Részletek: [eredmények](results.md). A kezdőlap a `/` címen van;
a jelenlegi demo a `/demo` alatt három nézetkapcsolóval egy oldalon fut.
A kezdőlap főgombja a `/join` játékosbelépésre vezet. Itt a játékmestertől
kapott teljes meghívólink illeszthető be; a QR közvetlenül a `/join/:token`
oldalt nyitja. A meghívó ellenőrzése és a becenév megadása után a játékos a
közös váróba kerül, a játékmester indításakor automatikusan a kóstolólapra vált.
Nincs nyilvános játéklista vagy külön, rövid belépőkód. A demó nem a kezdőlap
elsődleges belépési folyamata.
Az MVP-kivetítő a játékmester bejelentkezett böngészőjének másik lapja;
megosztható, csak olvasható prezentációtoken későbbi bővítés. A váróállapota kész:
kóstolócím, QR-kód, link és becenevek; boradatot nem kér le. A meghívó tokenjét a
host böngészője tárolja, ezért más böngészőben a kivetítő nem tudja megmutatni.

## Játékfolyamat

1. A játékmester bejelentkezik (Google vagy később e-mailes megoldás), megadja
   a kóstoló címét, a titkos boradatokat, sorrendet és az időkeretet.
2. Megnyitja a várót. A QR legalább 128 bit véletlen entrópiájú meghívó URL-t
   tartalmaz, nem adminjogot. A kézi belépés az első verzióban ugyanennek a
   linknek a beillesztése; rövid kód csak külön próbálkozás-korláttal jöhet.
3. A játékos becenevet ad, anonim Auth-munkamenetet kap, belép a váróba.
   Nem szükséges e-mail vagy Google. Azonos nevű embereket rövid azonosító
   különböztet meg. A résztvevőlista és létszám frissül.
   Elkészült: `/join/:token` (anonim munkamenet csak a beküldéskor jön létre,
   újratöltéskor a tagság visszatér), host QR/link/új meghívó és közös
   résztvevőlista. A host nem játszhat a saját kóstolóján, mert ismeri a
   borokat. A meghívó 12 óráig érvényes; új meghívó a régit érvényteleníti.
   Elkészült a `/play/:gameId` közös váró is: számozott résztvevőlista, Realtime,
   15 másodperces pótló lekérés és visszacsatlakozás. Újratöltéshez a már belépett
   vendégnek nem kell újra a meghívó. A lista nem online jelenlétjelzés.
4. A játékmester elindítja az első tételt. Mindenki az aktív értékelőt látja:
   becsült palackár (árkategória-kártyák), becsült alkoholfok (fél fokos léptető
   vagy beírás, 12,0 helyőrzővel), tetszési index (1–10 kártyák). Mindhárom kötelező.
   Árkategóriák: < 1 000, 1 001–2 000, 2 001–3 000, 3 001–4 000, 4 001–6 000,
   6 001–8 000, 8 001–10 000 és 10 000+ Ft (felső határ a kategóriába tartozik).
5. A beküldés szerver-visszaigazolást ad. A játékos a kör lejártáig módosíthat.
   Nincs kötelező automatikus beküldés, és nincs hamis „mentve” hálózati hibánál.
   Az első kör indítása és ez a válaszadási folyamat elkészült; részletek:
   [első élő kör](live-round.md).
6. A határidő lezárja a beküldést. A játékmester korábban is zárhat, vagy
   lejárat előtt hosszabbíthat. Új tétel mindig tudatos játékmesteri művelet.
7. A menetszerkesztőben külön **Felfedés** kártyák helyezhetők a borok és
   szünetek közé. Minden kártyán egy vagy több, előtte szereplő bor választható.
   A kártya indításakor a szerver csak ezeket fedi fel. A bor lezárása önmagában
   nem teszi láthatóvá az adatait, nincs kötelező N boros blokkhatár.
8. Egy már felfedett bor későbbi bemutatókártyán is szerepelhet.
   A kóstoló akkor fejezhető be, ha nincs hátralévő lépés vagy nyitott kör.
   A kártyákból kimaradt borok ekkor is rejtve maradnak; a végső ranglista
   kizárólag a felfedett borokból számol.

## Játékmesteri vezérlő

Asztali gépen két oszlop, telefonon egymás alatti panelek. Felül játékállapot és
kapcsolatjelző. Középen aktuális tétel, hátralévő idő, beküldött/aktív játékosok
száma. Elsődleges gomb mindig az aktuális állapothoz tartozik: váró megnyitása,
indítás, kör lezárása, következő tétel. Külön vezérlő: időállítás és prezentáció. A lezárás és felfedés következményét röviden jelzi a UI.

Oldalsáv: sorszámozott borlista (várakozik/kóstolás/lezárt/felfedett),
létszám, meghívó link és valódi QR. Titkos ár és alkohol csak a host szerkesztőben.
A megkezdett bor adatai és helye zárolódik; a hátralévő borok és egyedi szünetek futás közben is szerkeszthetők. Részletek: [szerkeszthető menet](tasting-schedule.md). A résztvevőlista
nem mutat mások tippjeit; a host beküldési darabszámot külön végponton kapja.

Időkeret: kikapcsolható vagy 30–1800 másodperc, alapérték 120. Időkorlát nélkül csak a játékmester kézi lezárása állítja le a tippek fogadását. Futó, még nyitott körben az időzítés ki-be kapcsolható; lejárt kör nem nyitható újra. Szünet két tétel között van;
futó kör megállítása nem MVP-funkció. Lejárt kör nem nyitható újra. Későn érkező
játékos a következő tételtől csatlakozhat, a korábbi körök válasza hiányzó marad.

## Pontozás v2 — árkategóriás tipp (új játékok alapértéke)

Legfeljebb 100 pont/bor, fele ár, fele alkohol. A játékos árkategóriát tippel;
a valódi árat a szerver sorolja kategóriába.

```text
árpont = 50, ha a kategória egyezik; 25 a szomszédos kategóriánál; különben 0
alkoholpont = 50 × max(0, 1 − abs(tipp − valódi %) / 3)
összpont = round(árpont + alkoholpont)
```

Példa: 5000 Ft / 13,5% bornál (4 001–6 000 Ft) 6 001–8 000 Ft / 14,0% tipp → 67 pont.
A `games.scoring_version` 2 az új játékoknál; a v1 csak a régebbi, forintos tippű
játékok újraszámolására marad.

## Pontozás v1 — forintos tipp (régi játékok)

Legfeljebb 100 pont/bor, fele ár, fele alkohol. A mércét indulás előtt mutatjuk.

```text
árpont = 50 × max(0, 1 − abs(tipp − valódi ár) / valódi ár)
alkoholpont = 50 × max(0, 1 − abs(tipp − valódi %) / 3)
összpont = round(árpont + alkoholpont)
```

Példa: 5000 Ft / 13,5% bornál 6000 Ft / 14,0% tipp → 82 pont.
0 pont jár legalább 100% árhibánál, illetve legalább 3 százalékpont alkoholhibánál
az adott részre. A valós ár pozitív. Az alkoholt egész tizedekben tároljuk:
13,5% = 135. A kerekítés egyszer, az összeg végén történik.

Tetszés: közönségkedvenc és átlag (kijelzésnél 1 tizedes), nincs „helyes” érték.
Hiányzó válasz versenypontja 0, de a kedveltségi átlag nevezőjébe nem kerül.
Ranglista összesített pont szerint, holtverseny azonos helyezéssel (1, 1, 3).
Felfedés előtt pontszám sem szivároghat ki: abból a valós érték következtethető.

## Eredmények és prezentáció

Boronként: név/évjárat, valódi ár és alkoholfok, saját tipp és pont, átlagos
tetszés, a beküldések száma. A következő lépésben tippeloszlás és a játékosok
válaszainak táblája. Összesítő: ranglista, teljesített körök, közönségkedvenc.
A projektben megjelenő mintaszámok demonstrációs adatok, nem valódi esemény adatai.

## Mobil és hozzáférhetőség

360 px szélességtől nincs vízszintes görgetés; 44 px-es érintési célok,
címkézett űrlapok, billentyűzet-fókusz, legalább WCAG AA színkontraszt mint cél.
Natív numerikus beviteli mezők, sem appletöltés, sem saját kamera-hozzáférés nem kell:
a telefon kamerája olvassa a QR-t. Android Chrome, iOS Safari, asztali böngészők.
Az MVP elfogadása valós iPhone és Android próbát is igényel.

## Hálózat és visszatérés

Frissítés és mobil háttérből visszatérés után teljes jogosult állapot újralekérése.
A Realtime esemény frissítési jel, nem az egyetlen igazságforrás. Kimaradáskor
15 másodperces ritka poll, visszatérő kapcsolatnál ismételt lekérés. Nincs
offline többjátékos mód. A helyi piszkozat nem minősül beküldött válasznak.
Anonim munkamenet elvesztése/új eszköz új résztvevőt jelent az MVP-ben; a
játékmester későbbi helyreállító folyamata külön feladat.

## MVP elfogadási feltételek

- 10 külön eszköz QR-ról belép, váróban megjelenik, egyszerre kapja meg a kört.
- Újratöltés után saját tagság és mentett válasz visszatér.
- Határidőn túli és idegen játékhoz tartozó beküldést a DB elutasít.
- Következő tétel és blokkos felfedés két hostlap párhuzamos kattintásánál is helyes.
- Egy játékos közvetlen API-val sem olvas rejtett bort vagy idegen rejtett választ.
- Hálózatszakadás után nem vész el visszaigazolt válasz, a UI helyreáll.
- A végső pontok újraszámolhatók a zárolt boradatokból és válaszokból.

Nem MVP: fizetés, nyilvános közösségi háló, borfelismerő AI, offline szerver,
natív mobilapp, globális ranglista vagy korlátlan nagyrendezvény.

## Kóstoló törlése

A saját kóstolók listáján és a kóstoló részletein elérhető a **Kóstoló törlése**.
A cím és a végleges adatvesztés ismertetése után külön **Végleges törlés**
gomb indítja. Futó és befejezett kóstoló is törölhető; a meghívó és a
játékosok hozzáférése megszűnik. A kapcsolt fotók és értékelések is törlődnek.
