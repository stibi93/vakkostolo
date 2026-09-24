# Adatmodell és API-szerződés

## Első migráció

| Tábla | Tartalom | Olvasás |
| --- | --- | --- |
| games | cím, host, állapot, felfedési gyakoriság, pontozási verzió | saját host / tag |
| participants | játék, auth user, becenév | saját host / tag |
| rounds | sorszám, állapot, nyitás/zárás | saját host / tag |
| wine_secrets | név, valós ár, alkohol | csak saját host |
| revealed_wines | felfedett boradat-pillanatkép | saját host / tag |
| ratings | résztvevő, kör, három érték | saját válasz vagy felfedett kör tagjai |
| game_invites | meghívóhash, lejárat | csak saját host |
| game_events | állapotváltás auditja | csak saját host |

A táblákon RLS aktív; a signed-out `anon` szerep nem kap jogot. Az anonim Auth
felhasználó `authenticated` szerepű. A közvetlen kliens-írás minden táblán tiltott.
A `private.is_host` és `private.is_member` segédek elkerülik az egymást rekurzívan
hívó RLS policyket. A `private` séma ne szerepeljen a Data API exposed schemas listáján.

Az összetett idegen kulcsok garantálják, hogy a válasz résztvevője és köre ugyanahhoz
a játékhoz tartozzon. Egy játékos/kör kombináció egyedi. A valós bor ára integer HUF
(felső határ 1 000 000 Ft), a tipp ára 1–8 árkategória (0009 óta), alkohol
egész tized-százalékpont (0–250), tetszés 1–10.
Boradat nem változhat játékindítás után; ezt a következő host-RPC-k fogják ellenőrizni,
a mostani alap közvetlen felhasználói írást egyáltalán nem enged.

## Elkészült RPC-k

`create_game(p_request_id uuid, p_title text, p_round_seconds integer,
p_reveal_every integer, p_wines jsonb) → uuid`

A `202609240001_create_game.sql` migráció a hívót az `auth.uid()` és a kanonikus
`auth.users.is_anonymous = false` alapján ellenőrzi. Nincs kliens által megadható
host vagy állapot. Egy tranzakcióban hozza létre a draft játékot, a sorrendezett
pending köröket, a titkos boradatokat és a `game_created` auditeseményt.
Meghívó nem keletkezik; az a következő fejlesztési egység külön művelete.

A cím trim után 1–100 karakter, az idő 30–1800 egész másodperc, a felfedési
gyakoriság 1–12. A borlista 1–12 eleme pontosan a `name` (1–200 karakter),
`price_huf` (1–1 000 000 egész Ft) és `alcohol_tenths` (0–250 egész) mezőket kapja.
A lista sorrendje adja a körök sorszámát. Hibás elemnél semmi nem marad mentve.

Hostonként egy kérésazonosító egy normalizált payloadhoz tartozik. Az ismételt
azonos kérés ugyanazt a játékazonosítót adja; eltérő adat `REQUEST_ID_CONFLICT`.
A tranzakciós advisory lock az egyidejű ismétlést is sorosítja; a privát
`game_creation_requests` csak hash-t tárol, boradatot nem másol. Hibakódok:
`AUTH_REQUIRED`, `PERMANENT_AUTH_REQUIRED`, `INVALID_REQUEST_ID`, `INVALID_TITLE`,
`INVALID_SETTINGS`, `INVALID_WINES`, `INVALID_WINE`, `REQUEST_ID_CONFLICT`.

`list_host_games() → jsonb`: a tartós fiók legutóbbi legfeljebb 100 saját játéka,
`id`, `title`, `status`, `round_seconds`, `reveal_every`, `created_at` mezőkkel.
`get_host_game(p_game_id uuid) → jsonb`: ugyanez a saját játékhoz, plusz a
sorrendezett `wines` lista (`position`, `name`, `price_huf`, `alcohol_tenths`).
Idegen és nem létező ID egyaránt `GAME_NOT_FOUND`. Ez host-DTO, játékosnak nem
adható. Mindhárom RPC csak `authenticated` szereppel hívható, rögzített üres
`search_path` mellett. Az anonim Auth-fiókot a belső ellenőrzés utasítja el.

`submit_rating(p_round_id uuid, p_price_bucket integer, p_alcohol_tenths integer,
p_liking integer) → ratings` (a 0009 migráció óta; előtte `p_price_huf`)

Csak bejelentkezett játékost fogad. A tagságot az Auth UID-ből határozza meg,
nem fogad másik játékos ID-t. Ellenőrzi az aktív játékot és nyitott kört,
sorzár után a szerveridőt. Beszúr vagy felülír, a korlátokat a DB is ellenőrzi.
Hibakódok: `AUTH_REQUIRED`, `ROUND_NOT_FOUND`, `ROUND_NOT_OPEN`,
`DEADLINE_PASSED`, `NOT_A_PARTICIPANT`, `ROUND_NOT_ELIGIBLE`, `RATING_INVALID`
(hiányzó vagy tartományon kívüli árkategória, alkohol vagy tetszés).
A kör megnyitása után csatlakozott résztvevő csak a következő körben értékelhet.
A körzár megakadályozza, hogy host-zárással egyszerre kicsússzon egy beküldés.

## Meghívó és vendégbelépés — `202609240002_invites_join.sql`

`issue_invite(p_game_id uuid) → { token, expires_at, status }`: csak a játék tartós
fiókú hostja hívhatja. Draft játéknál ellenőrzi, hogy minden körnek van titkos
boradata, majd `lobby` állapotba teszi (`version + 1`, `lobby_opened` esemény).
Később új linket ad és a régit érvényteleníti (`invite_rotated`). A token 43
karakteres base64url (244 véletlen bit), 12 óráig érvényes; a DB csak SHA-256
hash-t tárol, ezért a link nem kérhető le újra. A host böngészője `localStorage`-ban
őrzi a megjelenítéshez; elvesztésekor új meghívó kell. Befejezett játékhoz nem ad ki.

`join_game(p_token text, p_nickname text default null) → { game_id, participant_id,
nickname, title, status }`: bármely bejelentkezett (anonim vagy tartós) felhasználó.
A tagságot az Auth UID-ből képzi. Ismeretlen, lecserélt és lejárt link egyformán
`INVITE_INVALID`. A host a saját játékába nem léphet (`HOST_CANNOT_JOIN`), mert ismeri
a borokat. Új tag `lobby`, `tasting`, `intermission` vagy `reveal` állapotban léphet be,
különben `GAME_CLOSED`; meglévő tag mindig visszatérhet. Becenév nélkül csak visszatérés
(`NICKNAME_REQUIRED`), 1–30 karakter vezérlőkarakter nélkül (`INVALID_NICKNAME`).
Legfeljebb 50 résztvevő (`GAME_FULL`): visszaélés elleni korlát, nem termékígéret.
Ismételt belépés nem hoz létre új résztvevőt és nem írja át a becenevet. A játék sorát
zárolja, így a létszámkorlát párhuzamos belépésnél is tart.

`preview_invite(p_token text) → { title, joinable }` (`202609240004_invite_preview.sql`):
bejelentkezés nélkül (`anon`) is hívható, hogy a vendég a becenév megadása és az anonim
felhasználó létrehozása előtt lássa, melyik kóstolóba hívták. Ugyanúgy `INVITE_INVALID`
az ismeretlen, lecserélt és lejárt linkre; játékazonosítót, hostadatot, állapotot vagy
boradatot nem ad ki, csak azt, hogy új játékos még beléphet-e.

A 244 bites token mellett a találgatás nem reális, ezért külön DB-rate limit nincs;
rövid kód bevezetésekor kötelező. Az anonim Auth IP-alapú limitje (közös Wi-Fi!)
továbbra is az üzemeltetési ellenőrzés része. Nem tesztelt élesben: valódi Supabase
Auth/JWT, anonim belépés engedélyezése a hosztolt projektben, több eszköz.

## Közös váró RPC

`get_lobby_snapshot(p_game_id uuid) → jsonb`: jogosult host vagy tag, szerveridő,
játékállapot és résztvevőlista, titkos adat nélkül. A `202609240003` migráció
a `games` és `participants` Realtime-publicationjét is bekapcsolja.
Szerződés, eseménykezelés és próbák: [közös váró](lobby.md).

## Első élő kör — `202609240005_live_round.sql`

Elkészült a `start_round(game_id, expected_version, request_id)` és a
`get_game_snapshot(game_id)`: idempotens első indítás, sorzár, szerverhatáridő,
saját mentett tipp és későn belépők védelme. Részletes paraméternevek, hibák
és ellenőrzések: [első élő kör](live-round.md).

## Következő RPC-k terve

| Művelet | Ellenőrzés / tranzakció |
| --- | --- |
| next_round | host; verzió és sorzár; lezárt előző kör; felfedési blokk szabálya |
| extend_round | host; még nem járt le; +30 s, felső korlát |
| close_round | host; idempotens lezárás; audit |
| reveal_block | host; összes érintett kör closed; rögzített pillanatképek egy tranzakcióban |
| get_submission_progress | host; csak szám és beküldési állapot, titkos tippek nélkül |
| get_results | tagság; kizárólag felfedett körök; szerveroldali v1 pontozás |
| finish_game | host; nincs pending/open kör, minden tétel felfedett |

A felfedés a `revealed_wines`-ba másol és `rounds.status`-t állít, ugyanabban a
tranzakcióban. Nem olvassuk át közvetlenül a titkos táblát publikus view-n keresztül.
Realtime-publicationbe csak `games`, `rounds`, `participants` kerülhet induláskor.
Beküldési állapot hostoldalon külön lekérdezés; sem titkos bor, sem rating payload
nem broadcastolható a szobának. A váró migrációja a `games` és `participants` publicationjét már bekapcsolja;
a `rounds` táblát a 005 élőkör-migráció kapcsolja be.

## Tesztelés és migráció

`npm run test:db` valódi PostgreSQL-motort (PGlite) használ memóriában,
Supabase Auth UID tesztadapterrel. A migráció SQL-je változtatás nélkül fut.
Ellenőrizzük a rejtett és felfedett olvasást, másik játék elkülönítését,
a határidőt, validációt, újrabeküldést és a közvetlen írás tilalmát.
Az új létrehozási tesztek az atomikusságot, idempotenciát, tartós Auth-ot és
host-adatelkülönítést is ellenőrzik. A PGlite egy kapcsolaton fut: a valódi
többkapcsolatos versengést, Supabase gatewayt, JWT-ket, OAuth-t és WebSocketet
ez nem teszteli.

`npm run db:types` az összes migráció végrehajtása utáni PostgreSQL-katalógusból
generálja a `src/lib/database.types.ts` fájlt. A `npm run db:types:check` (a teljes
check része) észleli az elavult típust. A helyi generátor a jelenlegi tábla- és
RPC-típusokra korlátozott; ismeretlen adattípusnál megáll, kapcsolati/nested select
metaadatot nem generál. Az adapter explicit RPC-ket használ. Docker nélkül is
futtatható, de kiadás előtt valódi Supabase-séma és Auth-integráció ellenőrzése kell.

Supabase-projektben a CLI migrációs folyamata alkalmazható a `supabase/migrations/`
könyvtárra. Távoli push előtt tesztprojekt és mentés; éles migrációhoz külön
üzemeltetési lépés kell. A teljes helyi Supabase stackhez Docker szükséges,
az alap domain/DB tesztekhez nem.

## Játékmesteri jog — `202609240006_superadmin_host.sql`, `202609240007_block_public_password_signup.sql`

A `private.require_permanent_user()` (minden host-RPC közös kapuja) a nem anonim Auth-sor
mellett `raw_app_meta_data->>'vakkostolo_role' = 'superadmin'`-t és `auth.jwt()->>'aal' = 'aal2'`-t
kér (`HOST_ROLE_REQUIRED`, `MFA_REQUIRED`). A szerepet csak a titkos kulcs (Admin API) állíthatja;
a `user_metadata` nem számít. Játékos (Google vagy anonim) továbbra is beléphet bármely kóstolóba.
A `private.before_user_created(event jsonb)` Auth hook elutasítja a nyilvános e-mail/jelszavas
regisztrációt; csak a `supabase_auth_admin` futtathatja. Részletek: [belépés](auth.md).

## Váró jelenlét — `202609240008_lobby_presence.sql`

`private.presence_game_id(topic)` csak a pontos `game:<uuid>:presence` csatornanévből ad
játékazonosítót. `realtime.messages` szabályok: `lobby_presence_read` (host vagy tag, csak
`presence`), `lobby_presence_track` (csak tag). Részletek: [közös váró](lobby.md).

## Árkategóriás tipp — `202609240009_rating_price_buckets.sql`

A `ratings.price_bucket` (1–8) tárolja a tippet; a régi `price_huf` nullázható, és a
`ratings_price_guess_present` korlát szerint legalább az egyik kitöltött. Az új
`submit_rating` csak `price_bucket`-et ír (`price_huf = null`). A
`private.price_bucket(integer)` a valós árat sorolja kategóriába (felső határ
inkluzív: 1000, 2000, 3000, 4000, 6000, 8000, 10 000 Ft, fölötte 8); kliens nem
hívhatja. A `games.scoring_version` 1 vagy 2 lehet, alapértéke 2. A
`get_game_snapshot` `own_rating` mezője `price_bucket`-et ad `price_huf` helyett.
