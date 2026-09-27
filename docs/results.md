# Felfedett eredmények és prezentáció

Felfedéskor a játékos `/play/:gameId` oldalán automatikusan megjelenik az
**Eredmények** rész. A már felfedett borok között a nyilakkal vagy a
választómezővel lehet lapozni; a **Ranglista** gomb a közös állást mutatja.
Újabb kör közben a korábbi eredmények lenyithatók, a kitöltés marad előtérben.

## Telefonos borlap

- A mentett borfotó, a bor neve, valódi palackára és árkategóriája,
  alkoholtartalma, átlagos tetszése és a beérkezett értékelések száma.
- A saját ár- és alkoholtipp a valódi érték mellett; részpontok és összpont.
- Saját tetszés külön, versenypont nélkül. Hiányzó tippnél kifejezett jelzés,
  0 pont; hiányzó értékelés nem kerül nulla tetszésként az átlagba.
- Ugyanaz az összesített tippeloszlás, mint a kivetítőn, plusz „a te tipped”
  a saját sávon. A név nélküli eloszlás nem sorolja fel, ki mit mondott.
- A **Ranglista** összpontos dobogója mellett Ár, Alkohol és Kérdések nézet
  mutatja minden résztvevő felfedett tippjét és az arra kapott pontot.
  A még fel nem fedett bor válasza itt sem látszik.
- Összpont és helyezés a már felfedett borok alapján. Játék közben részállás,
  befejezett kóstolónál végeredmény. Holtverseny: 1, 1, 3 sorrend.

## Kivetítő

A meglévő **Kivetítő nézet** hivatkozás a `/present/:gameId` oldalra visz,
a host bejelentkezett böngészőjének másik lapján. A váróban megmarad a QR;
a játék indulásakor eltűnik a nagy belépési blokk. Az eredményhez már nem kell
érvényes, böngészőben tárolt meghívó. A host az eredményeknél az
**Eredmények kivetítése** gombbal is megnyithatja, befejezett kóstolónál is.

A prezentáció nagy, lapozható borlap: teljes palackot megőrző fotó baloldalt,
a név és a valódi értékek mellette. A **Tippeloszlás** nézet ugyanahhoz a borhoz
az árkategóriák, az alkoholskála, az egyedi kérdések és a tetszés darabszámait
mutatja. A helyes árkategória, alkoholfok és kérdésopció kiemelt; a tetszésnél
csak az átlag. A borlapon nincs saját válasz. A **Ranglista** a telefonnal
azonos kategóriabontást mutat: összpont, ár, alkohol és egyedi kérdés, játékosonként
a tippel és a ponttal. Öt résztvevőnként lapozható, hogy normál 720p kivetítőn is
olvasható legyen.
Mobilon a fotó és az adatok egymás alá kerülnek. Hosszú bornevek tördelhetők;
a tartalmat nem vágjuk le. További kérdésekhez a borlap statisztikai része bővíthető;
most a ténylegesen feltett ár-, alkohol- és tetszéskérdéseket jeleníti meg.

## Szerverpontozás és jogosultság

`202609240012_results.sql`: `private.rating_points` számítja a verziózott
pontokat, `get_game_results` csak tagság/hostjog ellenőrzése után ad eredményt.
A `get_game_snapshot` a felfedéstől ugyanebbe az adatfolyamba ágyazza az eredményt,
így a meglévő Realtime, ritka poll és újracsatlakozás frissíti a kijelzést.

- A számítás kizárólag `revealed_wines` + `revealed` kör adataiból történik.
  Nincs fel nem fedett körből pont, tetszésátlag, válaszszám, fotómetaadat vagy egyéni tipp.
- A `scorecards` mező a ranglista minden résztvevőjére, csak a már kiadott borokra
  tartalmazza az ár-, alkohol- és kérdéstippet, valamint a kategóriapontot.
  A borlap `own` mezője továbbra is csak a hívó játékosé; a hostnál null.
- v3: pontos árkategória, pontos alkoholfok és helyes egyedi válasz egyenként 1 pont.
  Nincs részpont. A tetszés nem ad pontot.
- v2: pontos árkategória 50 pont, szomszédos 25; alkohol legfeljebb 50 pont,
  3 százalékpont eltéréstől 0. A szerver a teljes összeget egyszer kerekíti.
- v1: a meglévő forintos tipp az eredeti relatív árhibás képletet követi.
  Régi v1 játékban csak árkategóriát tartalmazó válaszhoz nincs forintos adat:
  nem találunk ki árat/pontot, a válasz nem pontozható és az összesítés hiányosnak
  van jelölve. A játék `scoring_version` mezője nem változik.
- A pontok a felfedett, zárolt adatokból számolhatók újra; nincs kliensoldali
  pontírás, külön módosítható ponttábla vagy új Realtime publication.

## Fotó

A 0010 fotómigráció privát `wine-photos` bucketje a forrás. Az eredmény csak a
felfedett fotó meglétét/frissítési idejét jelzi. A kliens az aktuálisan kiválasztott
bor képét hitelesített Storage-letöltéssel kéri; a Storage RLS ettől függetlenül
ellenőrzi a tagságot és a felfedést. A blob-URL borváltáskor/eltűnéskor felszabadul.
Nincs fotó-előtöltés a rejtett borokról, nincs publikus bucket vagy külső képlink.

Kép nélkül számozott helyőrző látszik; hálózati/képhibánál a név, értékek és
pontok használhatók maradnak, a fotó külön újrapróbálható. `object-fit: contain`
őrzi a teljes palackot. A tesztképek a meglévő, generált helyi mintaborfotók;
nem valódi termékazonosságot vagy eredményt állítanak.

## Ellenőrzés

- `tests/results-db.test.ts`: felfedési/adatvédelmi határ, fotóhozzáférés, részpont,
  kategóriahatár, holtverseny, hiányzó válasz, v1 kompatibilitás és idegen hívó.
- `tests/results.test.ts`: a hálózati válasz célzott, futásidejű validálása.
- `tests/e2e/results.spec.ts`: mobil/asztali játékos és prezentáció, fénykép,
  képhiba/újrapróba, billentyűzetes lapozás, ranglista és meghívó nélküli végeredmény.
- `npm run test:results:local`: valódi helyi Auth/Realtime/Storage, felfedés előtt
  tiltott, utána engedélyezett fotó; saját/közös DTO és pontozás, saját próbaadatok takarításával.

Fizikai telefonos és valódi kivetítős elfogadás külön kézi próba.

A Felfedés kártya alatt a kijelölt borok lapozhatók, a ranglista az összes eddig
felfedett borból számol. A kóstoló lezárása nem fed fel új bort; a kártyákból
kimaradt borok a végső eredményből is kimaradnak.
