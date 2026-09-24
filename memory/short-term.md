# Aktuális munkamenet

## Szerkeszthető kóstolómenet és élő vezérlés kész — 2026-09-24

- Host → Borok és szünetek → Menet szerkesztése: mentett draft és futó kóstoló
  hátralévő borainak hozzáadása/törlése/sorrendje/adatainak/idejének módosítása.
  Egyedileg elhelyezhető szünetek, cím/szöveg, opcionális óra; mindig kézi folytatás.
- Élő vezérlés: idő rövidítése/hosszabbítása a mentéstől, korai zárás, következő
  lépés, blokkos boradatfelfedés és befejezés. A lejárt kör nem nyitható újra.
  A megkezdett boradatok és tippek megmaradnak. Játékos: egyetlen sticky óra,
  időállításkor piszkozatmegőrzés; lezáráskor 00:00 és tiltott beküldés.
- 0011 migráció privát menettel/kérésnaplóval; host+aal2, verzió és játék→kör
  sorzár, idempotens műveletek. Játékosnak csak aktuális szünet és felfedett borok.
  Helyi Supabase-en alkalmazva. A másik worktree fotós 0010 száma szabadon maradt;
  annak integrációja `migration up --local --include-all`-t és típusgenerálást kér.
- `npm run check`: 257/257, típusok/lint/build sikeres. Érintett games/live/schedule
  E2E: 28/28; utolsó órakijelzés-javítás után a két élő mobil/asztali próba 2/2
  és új build sikeres. Renderelt editor, óra és szünet átnézve; képek:
  `test-results/tasting-schedule-final/`, `test-results/tasting-schedule-clock/`.
- `npm run test:schedule:local`: valódi helyi Auth/Realtime, párhuzamos mentés és
  mentés–lezárás versengés, élő átrendezés, saját tipp megőrzése, időváltozás,
  szünet és befejezés sikeres; saját szintetikus adatok törölve.
- A 5173-as fejlesztői szerver elérhető, a 4457/4458 tesztszerverek leálltak.
  Fizikai telefonpróba és hosztolt deploy nem volt; commit nem készült.
  Következő termékegység: szerverpontozás/ranglista. A borfotó-agent külön
  worktree-ben folytatja. Dokumentáció: docs/tasting-schedule.md;
  együttműködési részletek: memory/tasting-schedule-handoff.md.

## Tippelőlap: árkategóriák, alkoholléptető, tetszéskártyák kész — 2026-09-24

- `main` `59f86c7`: 0009 migráció (`ratings.price_bucket` 1–8, új `submit_rating`
  `p_price_bucket`-tel, `RATING_INVALID`, pontozás v2 alapértékként). Közös
  `src/rating/RatingFields` az élő körben és a demóban; 12,0 helyőrző fókuszkor kitöltve.
- Integráció utáni friss ellenőrzés: `npm run check` 247/247, teljes E2E 78/78
  három workerrel. A három böngészős „két vendég automatikusan értékel” teszt teljes
  időkerete 60 s lett a korábbi terhelésfüggő 30 s túllépés miatt; az assertionök
  határideje változatlan. Az új futásban asztalon 14 s, mobilon 17 s alatt sikeres.
- Helyi Supabase-en 0009 alkalmazva; friss `test:live:local` sikeres, beleértve
  a szerverhatáridőt és hozzáférésvédelmet; saját szintetikus adatok kitakarítva.
  Korábbi `test:lobby:local`, `test:presence:local` sikeres. Renderelt mobil/asztali
  értékelőlap átnézve: `test-results/rating-integration/`. Hosztolt deploy nem történt.
- Az integráció kész; következő kézi ellenőrzés a valódi telefonos léptető és
  számbillentyűzet. Következő termékegység továbbra is az élő körvezérlés.
  Részletek: `memory/sessions/2026-09-24-rating-cards.md`.

## Egységes háttér minden oldalon kész — 2026-09-24

- App-szintű egyetlen HomeAtmosphere, AppMotionContext/useAppMotion közös
  állapottal. PageFrame, demó és kivetítő fejléce kapott közös kapcsolót;
  a kezdőlapi rajz ugyanazt használja. Navigáláskor megmarad a szüneteltetés.
- A külön kezdőlapi/váró/kivetítő háttérpéldányok megszűntek. A háttér aktív
  körben is fut, a felhasználó minden oldalra kért animációt. A kivetítő külső
  háttere átlátszó, a QR és az űrlapok fedettek. Betöltés és 404 is közös hátteret kap.
- Check 239/239, típusok/lint/build sikeres. App/demo/invite/lobby E2E 38/38;
  11 útvonalon egy háttér/egy kapcsoló, pause, navigációs megőrzés, reduced-motion
  és túlcsordulás próbálva mobilon/asztalon. Renderelt belépés, host és demó átnézve.
  Képek: test-results/global-atmosphere/. A böngészős Auth/Realtime próba szintetikus.
- A párhuzamos rating-cards agent DemoApp RatingFormjához nem nyúltam;
  csak importok/hook/fejléc változott, a koordinációs jegyzet ezt rögzíti.
- A 4297/4298 tesztszerverek leálltak; commit/deploy nincs. A kért munka kész;
  a párhuzamos értékelőlap-fejlesztés a saját átadása szerint folytatódik.

## Háttérkontraszt és kapcsolatpulzus kész — 2026-09-24

- Közös HomeAtmosphere erősebb árnyékokkal (11–13%) és szélvonalakkal (32%),
  beljebb húzott rétegekkel. Nem került be új háttérréteg vagy függőség.
- Játékosváró: 72%-os papírfedettségű panel kizárólag lobby állapotban;
  kivetítő résztvevőpanelje 78%-os. QR és értékelőlap továbbra is fedett.
- Az Élő kapcsolat zöld pontja 2 s pulzust kap. Friss snapshot + live állapot
  szükséges; hibánál, offline/betöltéskor nem zöld és nem animált. Reduced-motion
  és háttérbe tett lap megállítja; csak opacity/transform mozog.
- npm run check: 239/239 teszt, típusok/lint/build sikeres. App/invite/lobby E2E
  első futás: 28 sikeres, két asztali újratöltés/jelenlét próba időkorlátba futott.
  A kettő külön, egy workerrel változtatás nélkül sikeres (2/2). Új pulzuspróba
  mobilon és asztalon is sikeres: live → reduced-motion → hiba → visszatérés → offline.
- Renderelt kezdőlap, mobil/asztali váró és asztali QR-kivetítő átnézve:
  test-results/contrast-motion/. Újrapróba: contrast-motion-recheck/.
  Auth/RPC/Realtime szintetikus, új élő Supabase- vagy fizikai telefonpróba nincs.
- A 4287/4288 saját E2E-szerverek a tesztfutások végén leálltak. Commit/deploy nincs.
  A kért felületi munka kész; következő termékfeladat továbbra is körvezérlés.

## Váró élő jelenléttel és kezdőlapi háttérrel kész — 2026-09-24

- Kivetítőn és játékosváróban kezdőlapi háttérmozgás; QR átlátszatlan fehér kártyán.
  Résztvevők számozott címkecsempéken, „bent van / nincs bent” élő jelzéssel.
- Privát Realtime Presence (0008 migráció), kézi frissítőgomb megszűnt (hibánál Újrapróbálás).
- check 239/239, e2e 72/72, `npm run test:presence:local` 8/8 valódi helyi Realtime-mal.
- Hiányzik: fizikai telefonos próba (képernyőzár, háttérbe tett böngésző).

## Superadmin játékmester-belépés kész — 2026-09-24

- /host: felhasználónév + jelszó + TOTP (hitelesítő app). Jog: `app_metadata`
  superadmin szerep + aal2 szerveroldalon (0006); nyilvános jelszavas regisztráció
  Auth hookkal tiltva (0007). Google-belépés csak játékosoknak a /join/:token oldalon.
- Kezelés: `npm run superadmin -- create|reset-password|reset-mfa|revoke|list`.
  A felhasználó saját superadminja és tartalékfiókja még nincs létrehozva.
- Ellenőrzés: check 228/228, e2e 72/72, valódi helyi Supabase- és böngészőpróba.
  Hiányzik: valódi Google-játékos kézi próba; hosztolt projektben hook + MFA beállítása.
- Következő: eredmény e-mailben (roadmap 6.) később; termékben továbbra is körvezérlés.

## Kezdőlapi infotainment elkészült — 2026-09-24

- Új TastingInsights komponens: érzékelés/emlékezet, elvárások, társas vélemény.
  Három meglévő fotó, rövid ismertetők, kipróbálható ötletek és lenyitható
  kutatási háttér 3 eredeti forráslinkkel. Forrásellenőrzés: docs/tasting-insights.md.
- A korábbi home-guide szervezési blokkot és CSS-t leváltotta. A párhuzamos
  /join főgomb és belépési munka megmaradt; csak saját diff kerül a commitba.
- Integrált check: 210/210, típusok/lint/build sikeres; app E2E 14/14.
  Mobil/asztali nézet, lenyitott részletek, billentyűzet és képhiba ellenőrizve;
  képek: test-results/tasting-insights/. Az alkalmazás hatásosságára nincs ígéret.
- E kérés kész; következő termékegység továbbra is körvezérlés. A párhuzamos
  belépési/Auth-munka saját átadás szerint folytatandó. Push/deploy nem történt.

## Kezdőlapi valódi játékosbelépés kész — 2026-09-24

- Főgomb: Csatlakozás a játékhoz → /join. Új PlayerEntryPage fogadja a teljes
  meghívólinket, majd a meglévő /join/:token beceneves belépés és /play/:gameId
  közös váró következik. A QR továbbra is közvetlenül a meghívót nyitja.
- A kezdőlapi demóhivatkozások és a szervezői aloldal próbagombja kikerült;
  a képes útmutató harmadik eleme a csatlakozást és a várakozást magyarázza.
  A külön /demo útvonal megmaradt. Jogosultság és játéklogika nem változott.
- Az új beviteli mező csak a jelenlegi vagy konfigurált publikus oldal meghívóját
  fogadja el; mindig helyi útvonalra navigál. Üres/hibás linknél fókusz és
  hibaüzenet, konfiguráció nélkül egyértelmű tájékoztatás.
- npm run check: 210/210 teszt, típusok, lint, build sikeres. Célzott app/invite/live
  Playwright 34/34: kezdőlap → link → becenév → váró, újratöltés, hibák,
  billentyűzet; hostindításra két vendég automatikus kóstolólapja is sikeres.
  Szintetikus Auth/RPC/Realtime válaszok, ebben a körben új élő Supabase-próba nem volt.
- A renderelt mobil/asztali kezdőlap, belépési űrlap és váró átnézve; nincs
  túlcsordulás. Képek: test-results/player-entry-e2e/, player-entry-home-*.png.
- Párhuzamos új superadmin/Google Auth munka külön worktree-ben látható.
  A saját változások és integrációs határok: memory/player-entry-handoff.md.
  A másik agent Auth és JoinPage fájljait megőriztem; commit/deploy nem történt.
- E feladat kész. Következő integráció: a külön készülő Google-játékosbelépés
  kapcsolódjon a /join felülethez, a meghívó és visszatérő tagság megőrzésével.

## Kezdőlapi képek funkciója és feliratok — 2026-09-24

- A közös és demófejléc külön VAKBORKÓSTOLÓ felirata, valamint a lábléc
  márkaneve eltávolítva. Az üres közös lábléc megszűnt; a demó vissza-linkje megmaradt.
- A képes blokk most szervezői útmutatóhoz vezet, helyben nyitható előkészítési
  ellenőrzőlistát ad, illetve a demót nyitja meg. Az ismétlődő lépéssor megszűnt.
  Kategóriafelsorolás nem került vissza; a képek és a párhuzamos arculati munka megmaradtak.
- Check 199/199, típusok/lint/build és app+demo E2E 20/20 sikeres. Új navigáció,
  billentyűzetes listanyitás, képhiba és mobil túlcsordulás ellenőrizve.
  Mobil/asztali kezdőlap és nyitott asztali lista renderelve, átnézve:
  test-results/home-purpose/. Következő termékegység továbbra is a körvezérlés.
- A külön agent fotóigazítási és dokumentációs módosításai megmaradtak;
  a mostani commit kizárólag e feladat saját diffjét tartalmazza. Push/deploy nincs.

## Gyorsabb mozgás, galéria és játékmesteroldal kész — 2026-09-24

- Levélárnyékok 12/15 s, szőlőág 7,5 s félciklus; két finom SVG-szélfuvallat
  9/11 s ciklussal. Közös szüneteltetés, reduced-motion és háttérlap-kezelés megmaradt.
- Háromképes, számozott kezdőlapi galéria és saját pohárpecsét. Új generált
  progresszív JPEG-ek: vineyard-rows.jpg (295 KiB), blind-tasting-table.jpg (181 KiB).
  Pontos promptok: public/images/GALLERY-SOURCES.md. Stabil képhiba-helyőrző.
- Szervezési tájékoztató és belépés külön /jatekmester oldalon, fejlécből elérhető.
  A funkcionális /host útvonal és a párhuzamos élőjáték-fejlesztés megmaradt.
- Friss check: 199/199 teszt, típusok, lint és build sikeres; app Playwright 12/12.
  360/768/1440 px renderelt kezdőlap és aloldal átnézve; végső fotóigazítás
  után új build és 360/1440 px vizuális próba is sikeres. Kimenet: test-results/breeze-review/.
- Production Chromium: 3–3 s mérés, 6 animáció; 0 layout, 0 paint, 0 ms script,
  107/96 ms alatti főszálmunka mobil/asztali viewporton. Rövid helyi minta, nem fizikai telefonmérés.
- A párhuzamos munkamenet közben a1f04a0 és 7f82aa8 commitokba rögzítette az
  arculati változásokat; ez az agent nem indított commitot vagy deployt.
  A későbbi 7159661 szövegpontosítás megmaradt. Saját végső módosítás: fotóigazítás és docs/memória.
- E feladatból nincs hátralévő megvalósítás. A következő termékegység továbbra is
  a szerveroldali körvezérlés; az alábbi aktív arculati jegyzet történeti állapot.

## Bemutatkozó szövegek és arculati commit — 2026-09-24

- A meglévő arculati folytatás felhasználói kérésre rögzítve: `7f82aa8`
  (szélfuvallatok, gyorsabb mozgás, képfeliratok, galériaforrások és app E2E).
  Commit előtt check 199/199 és app E2E 12/12 sikeres.
- Új kérésre az ár–alkoholfok–tetszés felsorolás kikerült az alkalmazás és
  demó láblécéből, a címkegrafikából, bemutatkozó és kísérőszövegekből.
  A kezdőlap és játékmesteroldal általánosan a kóstolólapról/értékelésről ír.
  A működő mezők, mezőhibák és játéklogika megmaradtak; a kérés szövegmódosításként
  kezelve. A régi arculati prototípusok történeti dokumentumok maradtak.
- Módosítás utáni check 199/199, típusok/lint/build és app+demo E2E 18/18 sikeres.
  Mobil és asztali kezdőlap, asztali demó renderelt képei átnézve;
  kimenet: test-results/copy-without-rating-categories/.
- Párhuzamos arculati munka közben új docs/design.md és editorial.css módosítás
  jelent meg; ezek megmaradnak a munkafában, nem részei a szövegcommitnak.
  Következő termékegység a körvezérlés. Push/deploy nem történt.

## Első online kör elkészült — 2026-09-24

- Mainbe integrálva, külön commitokban: szerveroldali indítás és privát snapshot
  (`f3d10e8`), játékoslap és mentés (`c224350`), azonos Auth-munkamenet
  visszatérésekor piszkozatmegőrzés (`901e755`). A meghívó-előnézet is megmaradt.
- Host indítás, élő átmenet a váróból, szerveridős számláló, saját ár/alkohol/tetszés
  mentése és módosítása, újratöltés utáni visszaállítás kész. Késői belépő nem adhat
  tippet; rejtett boradat és más válasza nem kerül a játékoshoz.
- Végső `npm run check`: 199/199, típusok/lint/build sikeres. Integrált teljes
  Playwright 66/66; az utolsó Auth-javítás után érintett próbák 30/30.
  Mobil és asztali renderelt állapotok ellenőrizve. Valódi helyi Supabase-próba
  sikeres: párhuzamos hostindítás, Realtime, saját válasz, késői belépő és lejárat.
- A 005 migráció helyben alkalmazva, új változás új migrációba kerüljön.
  Google OAuth, hosztolt projekt és fizikai telefon ellenőrzése még hátravan.
  Részletek: `docs/live-round.md`, `memory/live-round-handoff.md`.
- Következő egység: szerveroldali korai körzárás, hosszabbítás és következő kör,
  a felfedési blokkok szabályainak betartásával. Most csak az első kör indítható.
- A párhuzamos kezdőlapi háttér/JPEG munka megmaradt a közös munkafában, nincs
  ebbe a fejlesztésbe commitolva. Az alábbi korábbi átadások történeti állapotok.

## Teljes kezdőlapi háttér és JPEG — 2026-09-24

- Felhasználói kérésre két halvány szőlőlevél-árnyék mozog a teljes kezdőlap
  mögött. A jóváhagyott rajz megmaradt. HomeAtmosphere + home-atmosphere.css,
  közös useAmbientMotion; PageFrame opcionális headerAction kapta a kapcsolót.
  A fejlécben nem takarja a tartalmat, minden kezdőlapi mozgást együtt állít.
- A háttér fix és nem interaktív; CSS-transform animációk, nincs framehurok,
  videó vagy új függőség. Háttérlapon/reduced-motion esetén mind szünetel;
  a rajz képernyőn kívül külön leáll. Más útvonalon nincs levélháttér.
- Beépített image_gen-nel generált szőlőfürtös kép a játékmesteri rész mellett:
  `public/images/harvest-grapes.jpg`, 1536×1024, kb. 222 KiB. Az eredeti PNG
  kompozíciója változatlan, csak progresszív JPEG-kódolás. Lazy loading,
  stabil képarány; képhibánál kihagyott fotó, használható belépés.
  Eredet és végleges prompt: `public/images/IMAGE-SOURCES.md`.
- Végső `npm run check`: 169/169, típusok/lint/build sikeres. Érintett
  böngészős próbák 12/12, képhibával és közös animációkapcsolóval is.
  360/768/1440 px renderelt képek átnézve, nincs túlcsordulás.
  Kimenet: `test-results/atmosphere-review/`, `atmosphere-final-e2e/`.
- Production Chromium 3–3 s minta 360/1440 px-en: 4 animáció, 0 layout,
  0 paint, 0 ms script; kb. 106/112 ms főszálmunka. Rövid helyi mérés,
  nem fizikai eszközteszt. Szintetikus Page Visibility jelre mind leáll,
  pause után változatlan transzformáció, reduced-motion alatt 0 animáció.
- Kész, nincs commit/deploy. A live-round agent saját jegyzete/kódja megmaradt.
  Portütközés elkerülésére a design 4235–4238 szerverei már leálltak;
  a végső mérés külön 4245-ön futott, ez is leállítva.
- Nincs hátralévő kezdőlapi teendő; a következő termékfeladat továbbra is
  az élő kör, külön munkamenetben. Az alábbi kezdőlapi jegyzetek történetiek.

## Kész változások rögzítése — 2026-09-24

- Felhasználói kérésre a közös munkapéldány kész változásai a main ágon
  rögzítve: arculati prototípus (`2012029`), majd alkalmazásarculat,
  helyi demófotók és szüreti kezdőlap külön commitban. A közös váró
  korábbi három commitja változatlanul megmaradt.
- Friss `npm run check`: 169/169 teszt, DB-típusok, TypeScript, lint és build
  sikeres. Alkalmazáskódot ebben a commitolási körben nem változtattam.
  Korábbi böngészős bizonyíték: közös váró integráció 50/50, az utána készült
  szüreti kezdőlap célzott próbái 10/10; most nem volt új böngészős futtatás.
- Következő termékfeladat az első élő kör szerveroldali indítása és a
  játékos kóstolólapja. Fizikai telefonos és Google OAuth-próba hátravan.
- Az alábbi átadások történeti állapotok; a „nem commitolt” megjegyzéseiket
  ez a rögzítés felülírja. Push és deploy nem történt.

## Kezdőlapi szüreti illusztráció — 2026-09-24

- Felhasználói kérésre a kezdőlapi nagy címke helyére saját SVG-csendélet
  került: szőlőfürt, levelek, számozott palack, pohár és finom dűlősorok.
  A meglévő palettát és tipográfiát követi; mobilon a főművelet alatt látható.
  Forrás: `src/ui/HarvestArtwork.tsx`, `src/ui/harvest.css`; HomePage import.
- Két lassú CSS-transform animáció, új csomag, videó, blur és JS-framehurok
  nélkül. Gombbal fázistartó szünet/folytatás; reduced-motion esetén nincs
  animáció. Képernyőn kívül és rejtett böngészőlapon automatikusan szünetel.
- A többi arculati és közösváró-változás megmaradt. A demó grafika, játéklogika
  és képkezelés változatlan. A korábbi nagy címke a tanulmány történeti része.
- `npm run check`: 169 teszt, típusok, lint és build sikeres. Érintett
  Playwright apppróbák 10/10: navigáció, billentyűzetes pause, reduced-motion
  és képernyőn kívüli szüneteltetés. 360/768/1440 px renderelt képek átnézve,
  nincs túlcsordulás. Kimenet: `test-results/harvest-review/`, `harvest-e2e/`.
- Production Chromium, 360/1440 px, 3–3 s aktív animáció: 0 layout, 0 paint,
  0 ms script, kb. 66–67 ms főszálfeladat. Ez rövid helyi mérés, nem fizikai
  telefonbenchmark. A Page Visibility kezelő szintetikus eseménnyel próbálva;
  a pause után a transzformáció állandó. Részletek: `performance.json` a képek mellett.
- A kért kezdőlapi bővítés kész; nem történt commit vagy deploy. Következő
  termékfeladat továbbra is az élő kör, külön munkamenetben. Új kezdőlapi
  díszítésnél a mostani két mozgó réteg és leállítási szabály maradjon az alap.

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

## Számozott címkés arculat az alkalmazásban — 2026-09-24

- Az elfogadott frontend-design profil átvezetve a közös alkalmazásba:
  törtfehér–borvörös–halványkék paletta, helyben betöltött Bricolage,
  számozott címkemotívum, új kezdőlap és tömör értékelőlap. A host-, belépési,
  mentett kóstoló-, meghívó- és kivetítőfelületek közös arculatot használnak.
- Három AI-mintafotó a `public/demo/` könyvtárban; a demó játékmesteri
  képszerkesztőjében helyi csere, törlés és visszaállítás. Hibás/rossz típusú/
  túl nagy képnél az előző megmarad. Felfedés előtt a játékos és prezentáció
  nem kap képelemet. Ez nem online feltöltés, frissítéskor a saját kép elvész.
- Kezdőlapi megállítható háttérmozgás, élő reduced-motion követés. Online
  játéklogika és DB nem módosult. A létrehozó súgója már jelzi a kész meghívást.
- Külön worktree-ben készült (`/tmp/vakkostolo-numbered-design-20260924`,
  alap `ef15b1f`), saját diffből integrálva a `613e52d` utáni közös forrásba.
  A LAN/kivetítő változások megmaradtak. Nincs új commit/push/deploy.
  Átadás: `memory/numbered-design-handoff.md`; arculat: `docs/design.md`.
- Közös forráson `npm run check` sikeres: típusok, lint, 141 teszt és build.
  Teljes Playwright: 44/44. Az utolsó hostlista/súgó finomítás után
  további 10/10 célzott játék-E2E és lint sikeres. Auth/RPC szintetikus, nem élő Google-próba.
- 360/768/1440 px-en hét renderelt állapot: kezdőlap, létrehozás, QR-váró,
  kivetítő, képszerkesztő, játékoslap és eredmények. Fontok/képek betöltődtek,
  nincs túlcsordulás vagy JS-oldalhiba; a képernyőképek átnézve.
  Képek: `test-results/numbered-design-review/` (Gitből kizárt).
- Az arculat alkalmazásba integrálása kész. A közös váró továbbra is a külön
  agent feladata (`memory/shared-lobby-handoff.md`); új nézetei a közös
  tokeneket kövessék. Borfotók következő önálló feladata: privát tartós tárolás
  és felfedéshez kötött kiszolgálás, backend-jogosultsági ellenőrzéssel.

A lentebbi bejegyzések korábbi munkamenetek állapotát rögzítik.

## Frontend-skill bővítve — 2026-09-24

- Felhasználói kérésre a személyes `frontend-design` skill általános része
  bővült: saját vizuális koncepció, referenciaelemzés, karakterellenőrzés,
  prototípus és implementáció elválasztása, párhuzamos munka megőrzése.
- Új, a fő skillből hivatkozott útmutatók: `references/art-direction.md` és
  `references/images-and-motion.md`. Fotók, feltöltési állapotok, hibák,
  aszinkron képcsere, megállítható mozgás és tényleges vizuális ellenőrzés.
- A Vakkóstoló arculata továbbra is külön projektprofil. Az automatikus
  kiválasztás és a globális AGENTS-előírás megmaradt.
- Skillvalidátor, belső hivatkozások és felfedezési symlink ellenőrzése sikeres.
  Új alkalmazáskód vagy UI-változás nem készült; böngészős apppróba nem kellett.
- Skillteendő nincs. Következő felületi munkánál már ez az útmutató alkalmazandó.

## Elfogadott irány, fotós bővítés — 2026-09-24

- A felhasználó elfogadta a számozott címkés irányt, borfotós mintákat és
  stílushoz illő hátteret/mozgást kért. Az interaktív tanulmány bővült:
  `docs/design-proposals/numbered-label/index.html`.
- Három AI-mintafotó, boronkénti helyi fájlválasztás, csere/törlés/visszaállítás,
  fotós felfedés. Csak a mintalap első borához tartozik tipp. A kezdőlapon
  lassú, megállítható fénykarika-animáció, reduced-motion esetén statikus.
- 360/768/1440 px négy nézet ellenőrizve; feltöltés-előnézet és hibák, képtörlés,
  billentyűzet és mozgásbeállítás sikeres; renderelt képek átnézve. Prototípus-lint
  és JS szintaxisellenőrzés sikeres. Az alkalmazáskódot nem módosítottam.
- A személyes frontend-skill projektprofilja aktualizálva és validálva.
- Következő: az elfogadott tanulmány alkalmazásba integrálása. Tartós, privát
  képfeltöltés még nincs; a mostani fájlválasztás kizárólag helyi előnézet.

## Új arculati javaslat — 2026-09-24

- A felhasználó a megvalósított Halves-adaptációt túl jellegtelennek találta;
  a Siteinspire borászati válogatásából inspirálódó új irány kidolgozását kérte.
- Elkészült a „számozott címke” interaktív tanulmány:
  `docs/design-proposals/numbered-label/index.html`, részletes indoklás ugyanott
  a README-ben. Saját címkegrafika, erős groteszk tipográfia, borvörös–halványkék.
- Kezdőlap, kitölthető kóstolólap és felfedés, egyértelmű mintaadatokkal.
  Mindhárom nézet 360/768/1440 px-en ellenőrizve; billentyűzetes bevitel és
  helyi mintamentés sikeres, renderelt képek átnézve.
- Ez a feljegyzés a korábbi bemutatás állapota; az irány azóta elfogadott (lásd fent). Az alkalmazás forráskódja és a
  személyes skill profilja ebben a munkamenetben nem változott. Következő lépés
  a felhasználó visszajelzése alapján az irány finomítása vagy átvezetése.
- A párhuzamos játék/meghívó munka megmaradt; csak az új tanulmánykönyvtár és
  e projektjegyzetek módosultak.

Dátum: 2026-09-24. A felhasználó kérésére a közös munkapéldány elkészült
változásai a `main` ágon, két logikus egységben rögzítve.

## Elkészült

- `86cc50d`: játék létrehozása. Kanonikus tartós Auth, atomikus és idempotens
  `create_game`, hostlista és részletes boradatok, generált DB-típusok, adapter,
  magyar űrlap és `/host/:gameId`. A feature-ág saját commitjai összevonva kerültek
  a mainre; nem szabad őket ismét alkalmazni. Átadás: `memory/game-creation-handoff.md`.
- `72acc49`: a Vakkóstoló nevet, az akkori jóváhagyott bordó–törtfehér arculatot,
  természetes magyar szövegeket, designelőnézeteket és összefésült projektjegyzeteket
  rögzíti. Georgia címek, Arial UI, közös CSS-tokenek; mobilon teljes szélességű
  mentés, másodlagos kijelentkezés. Átadások: `memory/design-handoff.md`,
  `memory/ui-copy-handoff.md`; arculat: `docs/design.md`.
- A korábbi host Google Auth, PKCE, munkamenet-visszaállítás és háttérellenőrzési
  javítás megmaradt. A demo továbbra is helyi, az online játéktól elkülönített próba.
- A párhuzamos agentek külön worktree-jeit és ágait ez a commitolás nem módosítja.
  A meghívó/QR és anonim vendégbelépés már a közös mainben van: `860ae12`.
  A külön invite-worktree tiszta, ugyanazon a commiton áll. Az invite-handoff
  beolvasztásra váró állítása elavult; itt a Git és a forráskód az irányadó.

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

A 2026-09-24-i friss Git/forrásellenőrzés alapján a következő fejlesztési egység
az élő közös váró: tagságot ellenőrző snapshot RPC, host- és vendéglista, Realtime,
újratöltés és hálózati visszatérés. Jelenleg a host lista 10 másodperces lekéréssel
frissül, a vendégoldal a belépést igazolja vissza; közös élő állapot még nincs.

Párhuzamos változások: az új numbered-label designjavaslat és a helyi Google
provider konfigurációja módosítás alatt látható. Ezekhez külön feladatkör tartozzon;
a váró fejlesztése saját ágon/worktree-ben történjen. A számozott címkés irány
azóta elfogadott; az alkalmazásbeli átvezetése még hátravan. A helyi konfiguráció módosítása önmagában nem igazol
sikeres Google-belépést. A valódi Supabase migráció/Auth/RLS és két kliens próbája
párhuzamos integrációs feladat marad. Utána élő kör indítása és válaszadás következik.
Ebben az állapotfelmérő munkamenetben új tesztfuttatás és alkalmazáskód-módosítás nem volt.
