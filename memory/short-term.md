# Aktuális állapot — 2026-09-27

## Felfedés színe a szerkesztőben

- A felfedéskártya a szünet kékje mellé külön, bordóhoz illő rózsaszín felületet kap az új kóstoló űrlapon és a menet szerkesztőjében.

# Aktuális állapot — 2026-09-27

## Több bor, egyszerűbb játékmesteri lista

- Egy kóstoló 1–40 bort fogadhat; a menet továbbra is legfeljebb 60 lépés. Új migráció: `202609270005_more_wines.sql`.
- A bejelentkezett `/host` lista kártyán mutatja a létrehozott kóstolót: nagy cím, állapotjelvény. A fiókcím és a belépés felirata bejelentkezés után nem ismétlődik.
- A helyi adatbázison a `202609270005` migráció alkalmazva.

# Aktuális állapot — 2026-09-27

## Kóstolómásolat fotóval, rögzített hozzáadógombok

- A másolat a borfotókat is átviszi a privát tárolóban, új körútvonalra. Mentés előtt cserélhetők vagy elhagyhatók.
- A Bor, Szünet és Felfedés hozzáadása a szerkesztőben és az új kóstoló űrlapon görgetés közben felül marad.
- Ellenőrzés: create-game-draft és games-api egységteszt; a felület böngészős ellenőrzése a másolás és a rögzített sáv.

# Aktuális állapot — 2026-09-27

## Kezdőlap: köröző pohár

- A szüreti rajz pohara véletlen szünet után kisebb, szabálytalan köröket ír le a vízszintes síkban: oldalaz és közeledik-távolodik, fel-le nem jár. A perem megdől, a tempó egy lögybölésen belül változik. A bor a kehely vonalán belül marad.
- Csak látható rajz és bekapcsolt háttérmozgás mellett, `prefers-reduced-motion` nélkül. Ellenőrzés: asztali nézet, egy lögybölés oldalirányban 9 px alatt, függőleges elmozdulás nincs, a bor nem lép ki a falon.

# Aktuális állapot — 2026-09-27

## Kezdőlapi pohár

- A pohár a szár körül, egy csuklókör vetületeként mozog: oldalra dől, a kör másik felén méretet vált, a bor felszíne vízszintes marad.

# Aktuális állapot — 2026-09-27

## Demó mód kivéve

- A `/demo` útvonal, a `src/demo` felület és a próbakóstoló gombok kikerültek. A `/demo` 404. A dokumentáció sem ír le helyi demót.
- A tesztek mintafotója: `tests/fixtures/sample-wine.png`.

# Aktuális állapot — 2026-09-27

## Játékos felfedési borlap

- A fotó és a valódi adatok maradnak felül. Az átlagos tetszés mellett ott a saját tetszés is.
- Alatta a saját eredmény, majd az egyedi kérdések ugyanabban a sorformában: saját tipp, valódi érték, pont. A szürke kérdéskártya és a telefonos tippeloszlás kikerült. A kivetítő Tippeloszlása megmaradt.
- Ellenőrzés: results E2E játékos, egyedi kérdés és kivetítő, mobilon és asztalon.

# Aktuális állapot — 2026-09-27

## Tippelés közben rejtett korábbi eredmények

- Nyitott vagy lezárt körnél a játékos nem látja az „Eredmények” és a „Felfedett borok” blokkot. A kivetítő és a játékmester továbbra is látja. Felfedéskor, szünetben és a végén a játékosnál is megjelenik.
- Ellenőrzés: results E2E „csak felfedés után” mobilon és asztalon átment.

# Aktuális állapot — 2026-09-27

## Játékos visszatérése ugyanarra a helyre

- Az anonim belépés elvesztése (bezárt telefon, lejárt munkamenet) eddig új
  résztvevőt hozott létre. A telefon most helykulcsot őriz; a szerver csak a
  hashét. Új belépés vagy lejárt meghívó után is a régi játékos tér vissza,
  a tippekkel és a kóstoló aktuális állásával. Google-helyet a kulcs nem vesz át.
- Migráció: `202609270004_reclaim_seat.sql`. Ellenőrzés: invite-join DB-tesztek.

# Aktuális állapot — 2026-09-27

## Kivetítő: nagyobb borfotó, szürke háttér, lebegő üveg

- A prezentációs borlapon a fotó fehér mezőben, nagyobb keretben áll.
  Az üveg lassan fel-le mozog, az alatta lévő árnyék ezzel együtt keskenyedik és halványul.
  Csak a kivetítőn (`lift`); a játékos nézete változatlan. `prefers-reduced-motion` mellett nincs animáció.
- Ellenőrzés: results E2E „fotós borlap” asztalon átment; a palack a szürke padló fölött marad, az árnyék látszik.
  Következő: a lebegést valódi kivetítőn megnézni.

# Aktuális állapot — 2026-09-27

## Ranglista és kategóriatippek

- A ranglista három dobogófokot mutat akkor is, ha kevesebb a játékos.
  Holtversenynél a nevek egy fokon állnak. Alatta táblázat: soronként egy játékos,
  oszloponként az összesített ár-, alkohol- és egyedi kérdés pont.
- 0019 `202609270003_revealed_scorecards.sql` helyi adatbázison alkalmazva.
- Ellenőrzés: results/questions tesztek sikeresek. A kivetítő ranglista E2E
  asztalon és mobilon átment, a lapozó a képernyőn marad.

# Aktuális állapot — 2026-09-27

## Host: külön lista, új kóstoló, másolat

- `/host`: csak saját kóstolók listája és „Új kóstoló” gomb.
- `/host/new`: üres létrehozó űrlap; `/host/new?from=<id>` meglévő másolata
  (cím, idő, borok, menet, kérdések; fotók nem).
- Kóstoló részletein is elérhető a „Kóstoló másolása”.
- `buildCreateDraftFromGame` + unit teszt; games E2E frissítve (új útvonal, másolás).
- Ellenőrzés: `npm run check` 312/312; következő: `npm run test:e2e` games fájl
  felhasználói környezetben, ha még nem futott.

# Aktuális állapot — 2026-09-24

## Boronkénti egyedi kérdések és térközjavítás

- Új és mentett kóstoló borlapján közös QuestionEditor: szőlőfajta-, ország-
  és saját kérdés; legfeljebb 5 kérdés, 2–6 opció, egy kijelölt helyes válasz.
  Hátralévő bor szerkeszthető; a mentett áttekintésben a kérdések megnyithatók.
- Játékos a meglévő tipp mellett minden kérdésre választ ad. Atomi mentés,
  felülírás és újratöltés; a kiértékelésnél saját/helyes válasz és találatjelzés.
  Kivetítőn csak a helyes válasz. A 100 pontos rangsor változatlan.
- 0017 migráció alkalmazva a helyi Supabase-en, ne írjuk át. Privát kérdés-
  és választáblák, szerveres validálás, régi submit_rating sem kerülheti meg
  a kérdéseket. Felfedés előtt csak aktuális kérdés/opciók és saját válasz.
- Felhasználói visszajelzés alapján a kérdésmezők között 20 px távolság,
  külön sor a hozzáadógombnak és a helyesválasz-mezőnek, kerettől elválasztott
  címek, mobilon tördelődő műveletek. Mindhárom kérdéstípusra ellenőrizve.
- Ellenőrzés: npm run check sikeres (310 teszt, típusok/lint/build);
  games/live/results/schedule E2E 62/62 asztalon és 360 px-en, billentyűzettel
  is. Az érintett szerkesztő-, játékos-, eredmény- és kivetítőképek átnézve.
  node scripts/test-questions-local.mjs: valódi helyi Auth/RPC teljes folyamat
  sikeres, saját szintetikus adatok törölve. Ez nem távoli élesítési próba.
- Másik munkamenet háttér-/szüretigrafika-módosításai megőrizve. Az alábbi
  korábbi teljes-check akadályt a mostani sikeres check feloldotta.
- Következő: felhasználói próba saját borral az Egyedi kérdések részben;
  távoli használat előtt a 0017 migráció alkalmazása és ottani integrációs próba.


## Többszínű háttér és intenzívebb szüreti rajz

- HomeAtmosphere: bordó/zsálya/szilva/kék/agyagrózsaszín levelek és szélvonalak,
  új mozgó pohárkarikák és sodródó levélrészletek minden útvonalon.
- HarvestArtwork: eltérő színű szőlőbogyók, zöld/kék levelek, rétegzett színfoltok,
  külön mozgó szélrajz; ág 4,8 s félciklus, −6/+7 fok. Galériacímkék is színesek.
- Hat háttér + három kezdőlapi animáció; csak transform/opacity. Közös szünet,
  reduced-motion és képernyőn kívüli szünet megmarad. Nincs új függőség.
- Renderelt kezdőlap 360/1280 px átnézve: test-results/colour-motion/.
  Célzott E2E 4/4, saját komponenslint sikeres. Külön böngészőpróba mind a
  kilenc animáció szünetét, reduced-motion leállást és túlcsordulást ellenőrizte.
  Chromium 3 s mérés: 0 új layout, 0 stílus-újraszámítás, 0 s script;
  ez asztali mérés, nem általános telefonos teljesítménygarancia.
- Az első, csak hátteret érintő állapot npm run check: 304/304, build/lint sikeres.
  A végső teljes check a párhuzamos egyedi-kérdés fejlesztés ResultsPanel.tsx:57
  szintaktikai hibáján állt meg. Teljes app E2E 10/16, útvonalbetöltési hibákkal;
  a célzott animációtesztek újrafuttatva 4/4. Másik munkamenet fájljai érintetlenek.
- Következő: a párhuzamos fejlesztés lezárása után teljes check és app E2E.

## Teljes kóstolómenet az új űrlapon, kártyás felfedés és admin törlés

- Új kóstoló létrehozásakor közvetlen Bor / Szünet / Felfedés hozzáadás.
  Közös sorrend, nyilas mozgatás, törlés; szünetcím/szöveg/idő, felfedéscím,
  szöveg és egy vagy több korábbi bor kijelölése. Nem kell előbb bort menteni.
  Érvénytelen kijelölés javítható; hibás menetet a kliens és a szerver is tilt.
- 0016: create_game_with_schedule, atomi létrehozás és menetrögzítés.
  Indexekből tartós kör-ID-k, teljes kezdeti bemenet hash-e és host/kérés zár.
  Ismétlés nem dupláz és nem írja vissza a később módosított menetet.
- 0014: explicit Felfedés kártyák. Nincs kötelező N boros blokk vagy automatikus
  adatfelfedés lezáráskor. Csak a kijelölt borok válnak láthatóvá; korábbi bor
  ismételhető. Kivetítő és játékos kártyánként lapoz, ranglista összesített.
  Befejezés nem fed fel kimaradt bort. reveal_every csak kompatibilitási adat.
- Mentett kóstoló tetején állandó menetáttekintés és közvetlen kártyagombok,
  szerkesztésen kívül és újratöltve is látható szünetekkel, üzenetekkel.
- 0015: saját superadmin aal2 kóstolót törölhet a listából/részletekből,
  cím szerinti megerősítéssel. Fotók előbb Storage API-n át, majd DB kaszkád.
  Maradék fotónál véglegesítés tiltott, ismétlés biztonságos. Nincs SQL
  Storage-metaadattörlés. Futó kóstoló is törölhető.
- Mindhárom migráció (0014–0016) alkalmazva a helyi Supabase-en; ne írjuk át.
  A felhasználó kérte az elkészült változtatások commitolását.
  Alap 6554de5, a friss git log mutatja a rögzítés állapotát.

## Ellenőrzés

- Új teljes menet: npm run check 304/304, típus/lint/build sikeres.
- Létrehozó és fotó-E2E mobilon/asztalon 20/20; üres kijelölés tiltása,
  többboros kijelölés, hálózati hiba és azonos kéréses újrapróba ellenőrizve.
  Renderelt új űrlap átnézve: test-results/create-full-schedule/.
- Valódi helyi node scripts/test-create-schedule-local.mjs sikeres:
  kezdő szünet, bor és felfedés; párhuzamos ismétlés; hibás menet visszagörgetése.
- Korábbi kártyás eredmény/szerkesztő/demo E2E 28/28. Admin törlés/gyorsgomb
  E2E 22/24 + a két terhelési időtúllépés külön ismételve 2/2 sikeres.
- test:schedule:local, test:results:local, test:delete:local sikeres:
  valódi Auth/Realtime, szerverpontok és privát Storage. Saját próbaadatok törölve.
- Helyi Storage-korlát: szándékosan tiltott felfedettfotó-felülírás után
  ugyanazon objektum törlése timeoutolt. A pozitív törlési próba külön
  test:delete:local; a negatív fotózárolási próba a test:photos:local-ban maradt.
  A normál felület zárolt képre nem küld felülírást; hibánál nincs végleges törlés.

## Következő lépés

Fizikai pilot admin + két telefon + kivetítő: új kóstoló már szünet/felfedés
kártyákkal; tippek, egy- és többboros bemutató, újratöltés és befejezés.
Távoli deploy és fizikai eszközteszt nem volt. Az 5173-as fejlesztői szerver
megmaradt; a régi worktree-ket nem kell ismét beolvasztani.
