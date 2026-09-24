# Szerkeszthető kóstolómenet

A játékmester a mentett kóstolóban, a **Borok és szünetek → Menet szerkesztése**
gombbal nyitja meg a szerkesztőt. A teljes mentett menet a szerkesztőn kívül is
látható, újratöltés után is, a szünetek címével és szövegével együtt. Mentett draftban, a váróban és futás közben is
módosíthatók a még meg nem kezdett lépések. Egy menet 1–12 bort és összesen
legfeljebb 60 lépést tartalmazhat.

- Bor felvehető, kivehető, átrendezhető; neve, ára, alkoholfoka és saját
  beküldési ideje (időkorlát nélkül vagy 30–1800 másodperc) módosítható.
- Szünet bárhová beilleszthető, egyedi címmel (100 karakter) és szöveggel
  (2000 karakter). 0 másodperc esetén nincs óra; egyébként legfeljebb 7200
  másodperc. A számláló lejárta nem indít automatikusan új tételt.
- Felfedés kártya címmel, üzenettel és egy vagy több bemutatandó borral
  illeszthető be. Csak a kártya előtti borok választhatók; az átrendezés vagy
  törlés miatt érvénytelenné vált kijelölést javítani kell. Korábban felfedett bor
  újra bemutatható. A kártyán nincs óra, a játékmester léptet tovább.
- A borok számozása a sorrendet követi, a szünet nem kap borsorszámot. A
  játékmesternek a fizikai palackjelöléseket is hozzá kell igazítania.
- A megkezdett és lezárt tételek adatai és helye megmaradnak. A leadott
  válaszokat és a futó kör határidejét a menetszerkesztés nem érinti.
- Két böngésző egymást felülíró mentését a verzióellenőrzés elutasítja.
  A felület megőrzi a piszkozatot, és külön gombbal tölthető be a mentett menet.

Az **Élő vezérlésben** az időkorlát kikapcsolható, illetve a futó kör hátralévő ideje 30–1800 másodpercre állítható,
a mentéstől számítva. Rövidíteni és hosszabbítani is lehet, de lejárt vagy
lezárt kör nem nyitható újra. A **Kör lezárása most** azonnal letiltja a tippeket.
Időkorláttal a játékos egyetlen, görgetéskor is látható, nem villogó órát lát; nélküle az „Időkorlát nélkül” jelzést. A határidő
frissítése ugyanazt a körkomponenst tartja meg, így a helyi piszkozat megmarad.

A **Következő lépés indítása** a mentett sorrend szerint lép: bor esetén
beküldést nyit, szünet esetén megjeleníti az átvezető szöveget,
Felfedés kártyánál pedig csak a kijelölt borokat mutatja be.
Nyitott, még le nem járt körből nem enged továbblépni. Nincs kötelező
blokkos felfedés vagy automatikus adatközlés körlezáráskor.
A **Kóstoló befejezése** akkor használható, ha nincs hátralévő lépés vagy nyitott
kör. A ki nem választott borok befejezéskor is rejtve maradnak. A végső ranglista
a felfedett borok alapján készül.
Az élő felfedés a fotós borlapot, a játékos saját tippjeit és pontjait,
valamint a közös ranglistát is megmutatja: [eredmények](results.md).

## Adatbázis és jogosultság

`202609240011_tasting_schedule.sql`:

- `private.tasting_steps`: sorrend és szünetek, egyedi időkeret. A bor lépés-ID-je
  megegyezik a tartós kör-ID-vel. A meglévő és új körök automatikusan kapnak lépést.
- `private.schedule_requests`: visszajátszható műveletek teljes payloadjával;
  azonos kérés nem módosít újra időt, nem hoz létre új bort. Eltérő payload azonos
  request ID-val hibát ad.
- `get_tasting_schedule`, `save_tasting_schedule`, `control_tasting`: csak a saját
  superadmin host, aal2 munkamenettel. Játék-sorzár és expected_version védi a
  módosításokat; a körzár a beküldésével azonos játék → kör zárolási sorrendet használja.
- A `start_round` a menet első lépését indítja, így kezdő szünetet is támogat.
  A korábbi indítások idempotens visszaigazolása továbbra is működik.
- A `get_game_snapshot` csak az éppen aktív szünet címét/szövegét/határidejét adja
  át; a jövőbeli szüneteket, borokat, más játékos rejtett válaszait nem.
  A `revealed` mező kizárólag a `revealed_wines` adataiból készül.
- A privát táblák nincsenek Realtime publicationben. A `games.version` és a
  nyilvános köridő változása új, jogosult snapshot lekérését váltja ki.

## Ellenőrzés

DB-próbák: `tests/schedule-db.test.ts`; böngészős próbák:
`tests/e2e/schedule.spec.ts`. Valódi helyi Auth/Realtime és párhuzamos
módosítások: `npm run test:schedule:local` (csak localhost, saját szintetikus
adatok takarításával). A fizikai telefonos elfogadási próba továbbra is kézi.

## Opcionális időzítés

A 0013 migrációban a beállítás 0 másodperce időkorlát nélküli kört jelent.
Az aktív kör `closes_at` értéke ilyenkor NULL; nincs mesterséges távoli határidő.
A szerver ettől függetlenül ellenőrzi a nyitott állapotot, tagságot és jogosultságot.
Kikapcsolás és visszakapcsolás verzióvédett, idempotens művelet; visszakapcsoláskor
a megadott idő a mentéstől számít. Az eredménysnapshot külső projekciója megmarad.

## Felfedési kártyák — 0014

A `202609240014_reveal_cards.sql` bővíti a privát menetet: `kind='reveal'`,
`reveal_round_ids uuid[]`. Mentéskor ugyanazon játék korábbi borai, 1–12 egyedi
azonosító engedélyezett. Végrehajtáskor minden kiválasztott kör closed/revealed.
A kijelölés, a felfedési másolat és a verzióváltás egy tranzakció.
A régi `reveal` vezérlőakció is kizárólag a soron következő Felfedés kártyát
indíthatja; nem kerülheti meg a sorrendet.

A `get_host_game.schedule` tartalmazza a mentett menetet. A játékos snapshotjában
csak az aktív kártya `reveal_card: {id,title,message,round_ids}` mezője jelenik meg,
az aktiválással már felfedett borazonosítókkal. A borlapok a kártya kijelölését
követik, a ranglista az összes eddig felfedett bort összesíti.

A `reveal_every` mező és létrehozási paraméter visszamenőleges kompatibilitás
miatt megmarad, de már nem vezérli a felfedést. Régi kóstolókhoz nem készülnek
automatikusan kártyák: a játékmester a hátralévő menethez adhatja hozzá őket.

## Gyors kártyahozzáadás

A mentett kóstoló tetején, az élő vezérlő előtt látható a menet.
A **Szünet hozzáadása** és **Felfedés hozzáadása** gomb közvetlenül megnyitja
a szerkesztőt az új kártyával. A szerkesztőben a hozzáadógombok a lista fölött
vannak. A kártyák továbbra is a **Menet mentése** gombbal rögzülnek.
Új kóstolónál a Bor hozzáadása, Szünet hozzáadása és Felfedés hozzáadása már
az első mentés előtt elérhető. Közös listában rendezhetők, a felfedési kártya
előtti borok jelölhetők ki. A teljes menet egyetlen létrehozással mentődik.
