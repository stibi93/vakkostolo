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
