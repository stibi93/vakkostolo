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
a játékhoz tartozzon. Egy játékos/kör kombináció egyedi. Ár integer HUF, alkohol
egész tized-százalékpont (0–250), tetszés 1–10. A beviteli felső árhatár 1 000 000 Ft.
Boradat nem változhat játékindítás után; ezt a következő host-RPC-k fogják ellenőrizni,
a mostani alap közvetlen felhasználói írást egyáltalán nem enged.

## Elkészült RPC

`submit_rating(p_round_id uuid, p_price_huf integer, p_alcohol_tenths integer,
p_liking integer) → ratings`

Csak bejelentkezett játékost fogad. A tagságot az Auth UID-ből határozza meg,
nem fogad másik játékos ID-t. Ellenőrzi az aktív játékot és nyitott kört,
sorzár után a szerveridőt. Beszúr vagy felülír, a korlátokat a DB is ellenőrzi.
Hibakódok: `AUTH_REQUIRED`, `ROUND_NOT_FOUND`, `ROUND_NOT_OPEN`,
`DEADLINE_PASSED`, `NOT_A_PARTICIPANT`; hibás értéknél constraint violation.
A körzár megakadályozza, hogy host-zárással egyszerre kicsússzon egy beküldés.

## Következő RPC-k terve

| Művelet | Ellenőrzés / tranzakció |
| --- | --- |
| create_game | tartós host-auth; játék + borok atomikusan; véletlen meghívó |
| open_lobby | host; legalább 1 teljesen kitöltött bor; draft állapot |
| join_game | tokenhash, lejárat, lobby/engedett késői csatlakozás, létszám, rate limit |
| get_game_snapshot | tagság; server_now; aktív kör; csak jogosult mezők |
| start_round | host; sorzár; expected_version; legközelebbi pending kör |
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
nem broadcastolható a szobának. A publication bekapcsolása a következő fázis feladata.

## Tesztelés és migráció

`npm run test:db` valódi PostgreSQL-motort (PGlite) használ memóriában,
Supabase Auth UID tesztadapterrel. A migráció SQL-je változtatás nélkül fut.
Ellenőrizzük a rejtett és felfedett olvasást, másik játék elkülönítését,
a határidőt, validációt, újrabeküldést és a közvetlen írás tilalmát.
Ez nem teszteli a Supabase gatewayt, valódi JWT-ket, OAuth-t vagy WebSocketet.

Supabase-projektben a CLI migrációs folyamata alkalmazható a `supabase/migrations/`
könyvtárra. Távoli push előtt tesztprojekt és mentés; éles migrációhoz külön
üzemeltetési lépés kell. A teljes helyi Supabase stackhez Docker szükséges,
az alap domain/DB tesztekhez nem.
