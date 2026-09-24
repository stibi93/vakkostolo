# Közös váró

A host saját játékoldalán, a `/present/:gameId` kivetítőn és a vendég
`/play/:gameId` oldalán ugyanaz a friss résztvevőlista látszik. A `/join/:token` sikeres belépés után erre a játékútvonalra
irányít. Az újratöltéshez így már nem kell érvényes meghívó: a meglévő Auth és
tagság elég. Elveszett anonim munkamenet továbbra is új résztvevőt jelent.

## Adathatár

A `202609240003_shared_lobby.sql` migráció `get_lobby_snapshot(p_game_id uuid)`
RPC-je egy lekérdezés pillanatképét adja. Csak saját host vagy játékhoz tartozó
résztvevő hívhatja. Hiányzó UID: `AUTH_REQUIRED`; idegen/hiányzó játék: egyaránt
`GAME_NOT_FOUND`; signed-out `anon` szerepnek nincs EXECUTE-joga.

A válasz mezői:

- `game`: `id`, `title`, `status`, `version`.
- `role`: `host` vagy `player`; `self_participant_id`: saját résztvevő vagy null.
- `server_now`: szerveridő.
- `participants`: `id`, `nickname`, `joined_at`, `seat`.

A sorszám a `joined_at, id` szerinti jelenlegi sorrend; azonos nevek mellett is
különbözik. Résztvevő törlése után változhat, nem tartós játékosazonosító és nem
online jelenlétjelzés. Nincs boradat, kép, tipp, pontszám vagy meghívó a DTO-ban,
még hostnak sem. A kliens futásidőben validál és eldobja a többletmezőket.

## Frissítés és visszatérés

A Realtime `games` UPDATE és `participants` INSERT/UPDATE eseményeire feliratkozik,
játékazonosító szerinti szűrővel. Az esemény csak új snapshotot kér, adata nem kerül
közvetlenül a felületre. A csatorna a Postgres-előfizetés visszaigazolását is várja
(`postgres_changes_options.wait`), nem csak a websocket-csatlakozást.

A publication kizárólag a `games` és `participants` táblával bővül, meglévő RLS-sel.
Ezek jelenlegi soradatai (köztük belső user/host UUID-k) megjelenhetnek a jogosult
Realtime kliens hálózati válaszában; titkos bor, rating, meghívó és audit nem
publikálható. Nincs szobába küldött saját broadcast vagy anonim publikus csatorna.
DELETE-feliratkozás nincs: a törlés és az elveszett esemény 15 másodperces teljes
újraolvasással láthatóvá válik.

Fókusz, láthatóvá válás, `pageshow`, hálózati visszatérés, Auth-frissítés és
Realtime-újracsatlakozás is lekérdez. Párhuzamos események egy újabb kérésbe
összevonódnak. Kijelentkezés/fiókváltás és lecsatolás után késői válasz nem térhet
vissza. Hálózati hibánál a régi lista elavultként jelölt; jogosultságvesztéskor
eltűnik. Kézi frissítőgomb nincs; hibánál „Újrapróbálás” jelenik meg. Offline játék nincs.

## Élő jelenlét (ki van bent most)

Privát Realtime Presence csatorna: `game:<játék-uuid>:presence` (`202609240008_lobby_presence.sql`).
A `realtime.messages` RLS-szabályai szerint csak a kóstoló tagja jelezheti magát (INSERT),
és csak a játékmester és a tagok láthatják (SELECT); kívülálló, idegen játék, más
csatornanév és broadcast tiltott. A játékos csak a saját résztvevő-azonosítóját küldi
(`{ participant_id }`); becenév a jelenlétben nem utazik, a felület a snapshotból párosít.
A játékmesteri oldal és a kivetítő csak figyel. Oldalbezáráskor, navigáláskor vagy
kapcsolatvesztéskor a szerver eltávolítja a jelenlétet; újracsatlakozáskor a kliens újra jelez.

A jelenlét csak kijelzés: tagságot, pontozást, határidőt nem befolyásol. Egy tag elvileg
más tag azonosítójával is jelezhet (a tartalmat a Realtime nem ellenőrzi); ez csak a
„bent van” jelzést téveszthetné meg. Ha a csatorna nem érhető el, a lista a belépett
résztvevőket mutatja jelenlét nélkül. `src/lobby/presence.ts` egy csatornát tart
játékonként és fülenként (StrictMode-újracsatolás, bontás közbeni visszatérés).

## Megjelenés

A kivetítő és a játékos várója a kezdőlap háttérmozgását (`HomeAtmosphere`) használja,
szüneteltető gombbal és `prefers-reduced-motion` esetén állóképpel. A QR átlátszatlan fehér
kártyán, csendes zónával áll, a háttér nem fut át rajta. A játékosnál kör közben a háttér áll.
A résztvevők számozott címkecsempék: bent lévő tömör, távollévő szaggatott keretű, szöveges
állapotjelzéssel (nem csak színnel).

## Ellenőrzés

- `npm run check`: DB-jogosultságok, DTO, kliensversengések és hibák.
- Playwright: host + két külön böngészőkörnyezetű vendég, azonos becenevek,
  websocket esemény, újratöltés, offline/HTTP-hiba, visszatérés, polling,
  idegen játék és hozzáférésvesztés. Valódi SDK, szintetikus HTTP/websocket.
- `npm run test:presence:local`: valódi helyi Realtime Presence: kívülálló elutasítva,
  host nem jelezhet játékosként, belépés/kilépés/kapcsolatbontás/visszatérés élőben; saját
  szintetikus adatait törli.
- `npm run test:lobby:local`: opt-in valódi helyi Supabase Auth/REST/RLS/Realtime
  próba. Futó helyi stack, alkalmazott migrációk és Supabase CLI kell hozzá.
  Négy saját szintetikus fiókot hoz létre; a végén csak ezeket és a kapcsolódó
  játékadatokat törli. Csak localhost célt enged, titkot nem ír ki. A szerveroldali
  tesztfolyamat helyi admin-kulcsot használ a fiókok létrehozásához/takarításához;
  ez soha nem kerül a frontendbe vagy VITE-változóba.

2026-09-24: a migráció a helyi stackre alkalmazva; a valódi próba sikeres, beleértve
az idegen Realtime-előfizető kizárását, meghívócserét és új feliratkozást.
Google OAuth, hosztolt környezet, fizikai telefon és Windows LAN-továbbítás
ellenőrzését ez nem helyettesíti. Az első kör és a kóstolólap már elkészült: [élő kör](live-round.md).
Az alkalmazás most a bővített `get_game_snapshot` végpontot használja; az eredeti
váró-RPC szerződése változatlan. A Realtime a `rounds` UPDATE eseményére is figyel.
A további körvezérlés és eredmények a következő egységek.

Forrás: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
és a rögzített `@supabase/realtime-js` csomag `RealtimeChannel.ts` előfizetési szerződése.
