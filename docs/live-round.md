# Első élő kör

A játékmester a megnyitott váróból indíthatja az első tételt. A `/play/:gameId`
automatikusan megmutatja a kör időzítőjét és a játékos saját kóstolólapját.
A kivetítő is látja az aktuális tételszámot és a hátralévő időt, tippet nem kér le.
Az első kör indítása és a válaszadás kész; a korai zárás, hosszabbítás,
következő kör, felfedés és eredmények a következő egységek.

## Szerveroldali szerződés — 005 migráció

`start_round(p_game_id uuid, p_expected_version integer, p_request_id uuid) → uuid`

- A saját, kanonikusan tartós Auth-fiókú host hívhatja. A játék sorzára után
  ellenőrzi a verziót és a `lobby` állapotot; minden körnek pendingnek és
  boradattal ellátottnak kell lennie. A legelső sorszámú kört nyitja meg.
- A kör sorzárát a játéké után szerzi meg, mint a `submit_rating`.
  `clock_timestamp()` adja a kezdést; a játék `round_seconds` beállítása a végét.
  Egy tranzakcióban környitás, `tasting`, `version + 1`, audit és privát kérésnapló.
- Azonos request ID és verzió ugyanazt a kör-ID-t adja vissza, a határidőt
  változatlanul hagyva. Más payload ugyanazon ID-val `REQUEST_ID_CONFLICT`.
  Másik kérés régi verzióval `VERSION_CONFLICT`; így két hostlap nem indít két kört.
- Ebben a szeletben a művelet kizárólag a legelső körre szolgál. Nem zár le
  automatikusan kört, nem indít következőt és nem kerüli meg a blokkos felfedést.

`get_game_snapshot(p_game_id uuid) → jsonb`

A jogosultsággal védett várósnapshot mezőit bővíti `round` és `own_rating`
mezőkkel. Egy olvasási pillanatképen ellenőriz és ad vissza adatot.

- `round`: az utolsó elindított kör `id`, `position`, `status`, `opened_at`,
  `closes_at`, `eligible`, `can_submit` mezői; indulás előtt null.
- `own_rating`: kizárólag a hívó saját, ehhez a körhöz tartozó `round_id`,
  `price_bucket`, `alcohol_tenths`, `liking`, `submitted_at` értékei, vagy null
  (a 0009 migráció óta árkategória, nem forintösszeg).
  A host/kivetítő mindig null értéket kap. Nincs rejtett boradat, borfotó,
  másik válasz, pontszám vagy beküldési számláló.
- A `server_now` és a kör határideje adja a kliens számlálójának alapját.
  A hálózati kérés teljes idejét konzervatívan levonjuk a hátralévő időből;
  utána `performance.now()` méri az eltelt időt, nem a telefon faliórája.

A `submit_rating` korábbi szerződése megmarad, egy új ellenőrzéssel:
`ROUND_NOT_ELIGIBLE`, ha a résztvevő a kör megnyitása után csatlakozott.
A `joined_at` alapértéke ezért már `clock_timestamp()`: a játék sorzárára váró
belépés nem kaphat a tranzakció kezdete miatt tévesen korai időpontot.
A tagságot a zár megszerzése után is ellenőrizzük. Az egyedi játékos/kör sor
és a szerveridőn alapuló elutasítás változatlan. Lejárt open körhöz sem lehet
beküldeni, akkor sem, ha a host nincs jelen. A tárolt closed állapotot egy későbbi
hostművelet rendezi; ehhez nem kell másodpercenkénti cron.

A Realtime-publication a `rounds` táblával bővül, meglévő RLS mellett.
Rating, boradat és meghívó továbbra sem publikált. Esemény csak teljes újraolvasást
indít; 15 másodperces tartaléklekérés és visszatéréskori frissítés megmarad.

## Felület és hibák

- Kötelező árkategória (8 kártya), alkoholfok és tetszés (1–10 kártya). Az alkohol
  mező `12,0` helyőrzőt mutat; belekattintva kitöltődik és kijelölődik, így gépelés
  felülírja. A −/+ gomb a következő fél fokra lép (0–25%), vesszős tizedes is
  elfogadott. A tetszés nem ad versenypontot. Saját mentett válasz újratöltéskor
  visszatér, és a határidőig bármelyik érték módosítható.
- A piszkozatot a háttérfrissítés nem írja felül. Csak sikeres szerverválasz vagy
  újraolvasott saját rating jelenhet meg mentettként. A piszkozat nem tartós:
  újratöltéskor elvész. Nincs offline beküldés vagy automatikus újraküldés.
- Hálózati hiba után a mezők megmaradnak; offline/elavult állapotban a beküldés
  tiltott. Elveszett sikeres válasz után a snapshot visszahozza a mentést.
- Indításkor a felület ugyanazt a request ID-t használja az ismétléshez.
  Újratöltéskor először új snapshot töltődik be. Kijelentkezés vagy tagságvesztés
  eltávolítja a korábbi játékoslapot; késői HTTP-válasz nem szereli vissza.
- A számláló a kijelzés része; a szerver a határidőnél későn érkező kérést
  akkor is elutasítja, ha a felület a küldés pillanatában még engedte.

## Ellenőrzés

PGlite: indítás, request-idempotencia, verzióütközés, jogosultság, titkos mezők,
saját rating, késői belépés, lejárt felülírás és publication/RLS.
A korábbi DB-fixture résztvevői explicit a kör előtt csatlakoznak.

Playwright: valódi SDK szintetikus HTTP/websocket válaszokkal; host + két külön
vendég, indítás, beküldés, módosítás, újratöltés, offline/503, elveszett válasz,
lejárat, késői belépés és hozzáférésvesztés. A timer és a DTO külön unit tesztet kap.

`npm run test:live:local`: opt-in valódi helyi Supabase Auth/REST/RLS/Realtime.
Két külön hostkliens egyszerre indít, párhuzamos tippek egyetlen sorba kerülnek,
az idegen csatorna és válasz védett; a próba megvárja a valódi 30 másodperces
határidőt és ellenőrzi az elutasítást. Négy saját szintetikus fiókot és azok
adatait használja, majd törli. Admin-kulcs csak a Node-tesztben, soha a frontendben.
2026-09-24: ez a próba sikeresen lefutott, a 005 migráció a helyi stackre alkalmazva.
Google OAuth, hosztolt projekt és fizikai telefonos próba külön ellenőrzési kapu.
