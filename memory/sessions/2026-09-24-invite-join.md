# Munkamenet: 2026-09-24 / meghívó, QR és anonim vendégbelépés

## Elkészült

- `supabase/migrations/202609240002_invites_join.sql`: `issue_invite` (draft → lobby,
  később linkcsere) és `join_game` (anonim/tartós vendég, visszatérés becenév nélkül).
  Részletek és hibakódok: `docs/database.md`.
- `src/invites/`: modell és futásidőben validáló adapter, `QrCode` (qrcode-generator
  2.0.4, saját SVG-path, innerHTML nélkül), host `InvitePanel`, vendég `JoinPage`.
- Bekötés: `/join/:token` útvonal, `authRuntime.invites`, `HostWorkspace` részletnézet.
- Tesztek: `tests/invite-join-db.test.ts` (16), `tests/invites.test.ts` (12),
  `tests/e2e/invite.spec.ts` (3 × asztali/mobil).

## Ellenőrzés

`npm run check` zöld (138 teszt, típusgenerálás-ellenőrzés, build). Teljes Playwright
28/28, saját portokon (`PLAYWRIGHT_BASE_PORT=4193`). A kirajzolt QR-t független
dekóder (jsQR) asztali és 360 px nézetben is a helyes `/join/<token>` URL-re olvasta.
Nem volt: valódi Supabase anonim Auth, hosztolt RLS, valódi telefonos kamera, több eszköz.

## Döntések

- A host nem léphet be a saját játékába játékosként (ismeri a borokat).
- Csak hash tárolódik: a link nem kérhető le újra; a host böngészője őrzi, elvesztéskor
  új meghívó kell, ami a régit érvényteleníti. 12 órás lejárat, 50 fős visszaélési korlát.
- Anonim felhasználó csak beküldéskor jön létre, oldalbetöltéskor nem (IP-limit, szemét).

## Folytatás

Közös váró: validált snapshot RPC, Realtime a `participants`-ra, vendégoldali lista,
azonos becenevek megkülönböztetése. Élesítés előtt anonim Auth + CAPTCHA döntés és
valódi kétkészülékes QR-próba a hosztolt tesztprojekten.
