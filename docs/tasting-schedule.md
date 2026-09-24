# Szerkeszthető kóstolómenet

A játékmester a mentett kóstolóban, a **Borok és szünetek → Menet szerkesztése**
gombbal tölti be a menetet. Mentett draftban, a váróban és futás közben is
módosíthatók a még meg nem kezdett lépések. Egy menet 1–12 bort és összesen
legfeljebb 60 lépést tartalmazhat.

- Bor felvehető, kivehető, átrendezhető; neve, ára, alkoholfoka és saját
  beküldési ideje (30–1800 másodperc) módosítható.
- Szünet bárhová beilleszthető, egyedi címmel (100 karakter) és szöveggel
  (2000 karakter). 0 másodperc esetén nincs óra; egyébként legfeljebb 7200
  másodperc. A számláló lejárta nem indít automatikusan új tételt.
- A borok számozása a sorrendet követi, a szünet nem kap borsorszámot. A
  játékmesternek a fizikai palackjelöléseket is hozzá kell igazítania.
- A megkezdett és lezárt tételek adatai és helye megmaradnak. A leadott
  válaszokat és a futó kör határidejét a menetszerkesztés nem érinti.
- Két böngésző egymást felülíró mentését a verzióellenőrzés elutasítja.
  A felület megőrzi a piszkozatot, és külön gombbal tölthető be a mentett menet.

Az **Élő vezérlésben** a futó kör hátralévő ideje 30–1800 másodpercre állítható,
a mentéstől számítva. Rövidíteni és hosszabbítani is lehet, de lejárt vagy
lezárt kör nem nyitható újra. A **Kör lezárása most** azonnal letiltja a tippeket.
A játékos egyetlen, görgetéskor is látható, nem villogó órát lát. A határidő
frissítése ugyanazt a körkomponenst tartja meg, így a helyi piszkozat megmarad.

A **Következő lépés indítása** a mentett sorrend szerint lép: bor esetén
beküldési határidőt nyit, szünet esetén megjeleníti az átvezető szöveget.
Nyitott, még le nem járt körből nem enged továbblépni. A felfedési blokkok
szabálya továbbra is érvényes: minden N. lezárt bor után felfedés kell az újabb
bor előtt. A végső kisebb blokk is felfedhető. A **Kóstoló befejezése** csak
az összes bor felfedése és a hátralévő lépések befejezése után használható.
Az élő felfedés jelenleg a valódi boradatokat mutatja; szerveroldali pontozás
és ranglista külön fejlesztés.

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
