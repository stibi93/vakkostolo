# Tartós projektmemória

## Kezdőlapról valódi játékba — 2026-09-24

- A felhasználó a próbakóstoló helyett valódi játékosbelépést kér. A kezdőlap
  főművelete /join; teljes meghívólink → /join/:token → becenév → közös váró.
  A játékmester indítása automatikusan megnyitja a kóstolólapot.
- A kézi belépés ugyanazt a meghívót használja, mint a QR. Nem adunk új
  nyilvános játéklistát vagy rövid kódot; a szerver ellenőrzi a meghívót és tagságot.
  Indok: a meglévő biztonságos belépési folyamatot kell elérhetővé tenni a kezdőlapról.

## Kezdőlapi képek szerepe — 2026-09-24

- A felhasználó legújabb kérése szerint a három fotó infotainment szekció:
  mit adhat a vakkóstolás érzékelésben, tanulásban és közös élményként.
  A korábbi szervezési lépéseket felváltja a közérthető magyarázat, kipróbálható
  ötlet és lenyitható kutatási háttér. Indok: a képhez érdemi tudás társuljon.
- Tudományos állítás csak ellenőrzött eredeti kutatásra és annak mért kimenetére
  támaszkodjon; vásárlási döntés nem azonos ízérzet-változással. Az app hatásossága
  nem vizsgált. Források/korlátok: docs/tasting-insights.md.
- A fejlécben csak a Vakkóstoló márkanév szerepeljen, ismétlődő kategórianév
  nélkül; a láblécben ne ismételjük a márkát.

## Kezdőlapi mozgás és szervezési tájékoztató — 2026-09-24

- Felhasználói kérésre élénkebb levél- és szőlőmozgás, két finom szélfuvallat
  egészíti ki az arculatot. Legfeljebb hat transform/opacity animáció; a közös
  szüneteltetés, reduced-motion és képernyőn kívüli leállítás megtartandó.
- A kezdőlap háromképes szerkesztett galériát, számozott címkéket és pohárpecsétet
  használ. Generált hangulatképek, helyi tömörített JPEG-ek, dokumentált promptokkal.
- A játékmesteri tájékoztató külön /jatekmester oldalra került, mert a felhasználó
  külön akarta választani a kezdőlaptól. /host marad a funkcionális belépés.

## Értékelési szempontok a bemutatkozásban — 2026-09-24

- A felhasználó az ár, alkoholfok és tetszés szempontjait még változtatni tervezi.
  Ezért a lábléc, dekoráció és bemutatkozó szöveg ne sorolja ezeket állandó
  termékjellemzőként. Általánosan kóstolólapról és értékelésről írjunk.
  A jelenlegi mezők és pontozás átépítése külön fejlesztés; most szövegjavítás történt.

## Élő kör indítása és saját válasz — 2026-09-24

- A start_round verzióellenőrzést, játék→kör sorzárat és privát kérésnaplót használ.
  Indok: két hostlap versengése vagy elveszett hálózati válasz ne indítson új kört
  és ne tolja ki a határidőt. Azonos request ID és verzió ugyanazt adja vissza.
- A joined_at clock_timestamp() a játékzár megszerzése után keletkezik.
  Indok: az indítás mögött váró belépés ne kapjon tévesen korai jogosultságot.
- A get_game_snapshot a váró adatait körállapottal és kizárólag a hívó saját
  válaszával bővíti. A publication a rounds táblával bővült; borok, tippek és
  meghívók továbbra sem publikálhatók. Ez a korábbi váróleírás kiegészítése.
- A kijelzett határidő szerveridőből és monoton kliensórából származik;
  a beküldésről mindig a szerver dönt. A piszkozat nem mentett válasz.
- Azonos Auth-felhasználó visszatérése frissít, nem bontja el a piszkozatot.
  Fiókváltás, kijelentkezés és tagságvesztés eltávolítja a korábbi játékoslapot.
  Indok: háttérből visszatérve adatmegőrzés, identitásváltáskor adatelkülönítés.

## Közös váró adathatára — 2026-09-24

- A host, vendég és kivetítő azonos `get_lobby_snapshot` RPC-t olvas;
  az aktuális Auth és játéktagság határozza meg a hozzáférést. A `/play/:gameId`
  visszatéréshez nem kell a régi meghívó. Indok: meghívócsere ne bontsa a tagságot.
- Realtime-esemény csak újraolvasást indít; a validált RPC-pillanatkép a mérvadó.
  A Postgres-előfizetés visszaigazolását várjuk (`postgres_changes_options.wait`):
  a puszta websocket-csatlakozás a valódi helyi próbában még túl korai volt.
  15 másodperces lekérdezés pótolja az elveszett eseményt és a törléseket.
- A publication most csak games/participants táblákkal bővül, RLS mellett.
  Borok, tippek és meghívók nem publikálhatók. A jövőbeli mezőbővítéseknél
  a teljes Realtime-sor adatvédelmét is ellenőrizni kell, nem csak a DTO-t.
- A sorszám az azonos becenevek vizuális megkülönböztetése, nem tartós azonosító
  vagy online jelenlét. A résztvevő UUID-ja marad a tényleges kulcs.
- Részletes szerződés és reprodukálható helyi integráció: `docs/lobby.md`.

## Felületi hangnem és párhuzamos munka — 2026-09-24

- Felhasználói kérésre személyes `frontend-design` skill készült; a globális
  `~/.codex/AGENTS.md` írja elő frontendfeladatokhoz. Forrása
  `~/.codex/skills/frontend-design/SKILL.md`, felfedezési linkje
  `~/.agents/skills/frontend-design`. Célja az átgondolt design és a feladathoz
  igazított tényleges vizuális ellenőrzés, a projekt arculatának megtartásával.
- A személyes frontend-skill általános része külön útmutatót tartalmaz a
  vizuális koncepcióhoz/referenciákhoz és a képekhez/mozgáshoz. Indok: a
  technikailag helyes, rendezett felület lehet jellegtelen; az arculatot a
  termékhez illő ötlettel és tényleges használati állapotokban kell igazolni.
  Konkrét boros színek és motívumok csak a Vakkóstoló projektprofiljában élnek.
- Felhasználói kérés: természetes, tárgyilagos magyar feliratok. Ne kerüljenek
  a felületre erőltetett szlogenek, boros szóviccek, színlelt bizalmaskodás vagy
  frappánsnak szánt kiszólások. A cím nevezze meg a funkciót vagy állapotot;
  a súgó mondja el a következő lépést. Indok: a korábbi hangnem kínosnak hatott.
- Maradhat a tegezés és a közérthető „tipp”, „bor”, „kóstoló”. A demó jelölése,
  adatvesztésre vonatkozó tájékoztatása és a pontozás jelentése maradjon pontos.
- Párhuzamos munkamenetnél külön Git-worktree és szűk feladatkör használható.
  Integrációkor az aktuális fájlokba csak a szükséges változások kerüljenek;
  egész fájl visszamásolása felülírhatja a másik munkamenet munkáját.
  A megosztott jegyzet nem visszaigazolt fájlzár. Az aktuális szövegezési
  átadás: `memory/ui-copy-handoff.md`.

## Felhasználói igények — 2026-09-23

- Vakon kóstolt borok telefonos értékelése: ár, alkohol, tetszési index.
- QR-os vendégbelépés, váró, opcionális Google-fiók.
- A host indítja a játékot, időzíti és lépteti a borokat.
- A host szabályozza a felfedés gyakoriságát; boronkénti és összesített eredmények.
- Letisztult, modern, eltérő telefonokon is használható felület.
- Kezdetben ingyenes működésre törekvés, projektinfrastruktúra és AI-memória kérése.
- Praktikus, korszerű, elfogadott és karbantartott mérnöki keretrendszerek használata.
- A vizuális arculat legyen karakteres, kreatív; a korábbi pasztell, kártyás
  megjelenést a felhasználó AI-generált hatásúnak találta. A borklub-plakátos
  változat sárga színét 2026-09-24-én elutasította. Új, boros designrendszer
  keresését kérte, bemutatással a skillbe építés előtt. A bordó–törtfehér
  Halves-adaptációt ugyanazon a napon jóváhagyta; a skill boros profiljába bekerült.
- Későbbi, 2026-09-24-i visszajelzés: a megvalósított Halves-adaptáció túl
  jellegtelen. Karakteresebb, izgalmas, ugyanakkor könnyen érthető irány kell;
  inspiráció a Siteinspire Winery & Vineyard válogatása. A számozott, letakart
  címkére épülő új tanulmányt a felhasználó ezt követően elfogadta.
  Borfotókat és stílushoz illő háttérmozgást is kért: a fotó a hostnál és
  felfedéskor látható; kezdőlapi háttérmozgás megállítható, reduced-motion
  esetén statikus. A személyes skill projektprofilja már ezt rögzíti.
- A számozott címkés arculat az alkalmazásban is megvalósult 2026-09-24-én.
  Közös CSS-tokenek: `src/styles.css`; Bricolage címek és számok, Arial UI,
  visszafogott Georgia hangsúly. A helyi latin/latin-ext WOFF2 és OFL licence
  a `src/ui/fonts/` alatt van; nincs külső fontszolgáltatás. Új online felület
  ezeket a tokeneket és a `docs/design.md` útmutatását kövesse.
  A játékosnézetben az értékelés az elsődleges, dekoratív nyitóblokk nélkül.
  Indok: mobilon a kóstolás közbeni bevitel kapjon helyet.
- A demó borfotói kitalált AI-minták, helyi képcserével; nem online tárolás.
  Frissítéskor a saját kép elvész. Felfedésig a játékosnézet nem szerel fel
  borfotót, a host csak a képszerkesztő megnyitásakor látja. Éles képekhez
  privát tárhely és szerveroldali hozzáférés kell; a publikus minták nem
  jogosultsági referencia. Kezdőlapon megállítható absztrakt háttérmozgás,
  reduced-motion esetén statikus; az értékelés mozgásmentes.
- A kezdőlaphoz a felhasználó szőlős/szüreti rajzokat és könnyű animációt kért.
  Saját SVG-csendélet készült a márkapalettával, számozott palackkal. Indok:
  kis méret, skálázhatóság, külső képletöltés nélkül. Két transform-réteg
  mozog; pause, reduced-motion, IntersectionObserver és Page Visibility
  szabályozza. A részleteket a `docs/design.md` rögzíti; a játékfelület statikus.
- A felhasználó külön kérte a teljes kezdőlap egyszínű hátterének megtörését.
  Két halvány, mozgó levélárnyék és egy JPEG szőlőfürtös hangulatkép került be.
  A rajz és háttér egy közös fejlécbeli kapcsolóról állítható; a játékoldalak
  nem kapják meg a dekorációt. Indok: a kezdőlapon lehet hangulat, adatbevitel
  közben a stabil felület fontosabb. A JPEG AI-illusztráció, nem konkrét
  borászat dokumentációja; az eredet/prompt a public/images/IMAGE-SOURCES.md-ben.
- A termék neve 2026-09-24-től **Vakkóstoló**, minden felületen azonos írásmóddal,
  dekoratív pont nélkül. A technikai projektazonosító `vakkostolo`.

## Tervezési döntések — 2026-09-23

- React/TypeScript/Vite + Supabase, statikus hosting: kevesebb üzemeltetés.
- Magyar UI, HUF; 2–30 fő / 1–12 bor induló feltételezés, nem felhasználói korlát.
- Vendég = anonim Auth-felhasználó. A host tartós bejelentkezést kap.
- Valós boradat külön titkos táblában, felfedéshez külön pillanatkép.
- Szerveridő és sorzár védi a beküldést; egy játékos/kör egy válasz.
- Pontozás v1: 50 ár + 50 alkohol; tetszés nem versenypont. Javasolt szabály.
- AI a fejlesztéshez fájlalapú emlékezettel; termék-AI opcionális, kikapcsolva.
- A kész alap demo, nem éles többjátékos alkalmazás. A hiányzó funkciók a roadmapben.

Indokok: `docs/decisions/001-foundation.md`. Változáskor ezt a lapot javítsd,
ne tarts meg egymásnak ellentmondó döntéseket aktív szabályként.

## Fejlesztési munkamenet — 2026-09-24

- Felhasználói kérés: Git és logikus fejlesztési egységek, elsőként scaffolding.
  A meglévő projektalap külön induló commitban megőrizve; minden további
  egység konkrét viselkedést, ellenőrzést és dokumentációt fogjon össze.
- A kezdőlap és a helyi demo külön útvonal (`/`, `/demo`). A demo csak
  megnyitáskor töltődik be, így az alkalmazásbelépési pont külön bővíthető
  Auth és valódi játék felé. A külön csomag nem jogosultsági határ.
- Helyi repository `main` ágon; távoli szolgáltató még nincs beállítva.

## Host Auth — 2026-09-24

- React Router kezeli az alkalmazásútvonalakat, a Supabase SDK PKCE-folyamattal
  a Google-belépést. Indok: központi útvonalak a következő játékfunkciókhoz,
  bevett Auth-kliens saját tokenkezelés helyett.
- A callback explicit, egyszeri kódbeváltás; a cél a saját `/host`, nincs szabad
  átirányítás. A felület szerverrel ellenőrzött usert használ, az anonimitást
  megkülönbözteti. A játékjogosultság továbbra is DB/RPC-felelősség.
- A host Auth klienskódja kész; a valódi Google/Supabase integráció külön kapu.
  A tesztek szintetikus Auth HTTP-válaszokat használnak, nem külső fiókot.

## Játék létrehozása — 2026-09-24

- A szerver a kanonikus `auth.users.is_anonymous` mezőt ellenőrzi a host-RPC-ben;
  a kliens szerepjelzése nem jogosultság. A részletes boradat külön host-DTO-ban
  marad; a következő játékossnapshot ezt nem használhatja.
- A létrehozási kérés hosthoz kötött UUID-val és normalizált payloadhash-sel
  idempotens. Indok: elveszett HTTP-válasz utáni ismétlés ne duplikáljon játékot.
  A nyitott űrlap őrzi az UUID-t, újratöltésen át nem; ilyenkor a saját lista
  ellenőrzése szükséges új mentés előtt. A meghívó külön következő művelet.
- A DB-típusok a ténylegesen végrehajtott migrációk PGlite-katalógusából készülnek,
  eltérésük a `check` része. Indok: Docker nélkül is reprodukálható helyi ellenőrzés.
  Ez korlátozott generátor, nem teljes Supabase CLI-helyettesítő: nested select
  metaadatot nem készít, valódi Auth/gateway és versengés próbája továbbra is kell.
- Párhuzamos agentmunka külön ágon, worktree-ben, saját függőségtelepítéssel és
  tesztportokon történik. Átadás konkrét commit és API-szerződés alapján; a közös
  munkapéldány más agenthez tartozó módosításait nem szabad sajátként commitolni.
