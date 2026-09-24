# Aktuális munkamenet

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
