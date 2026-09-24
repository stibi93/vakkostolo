# 2026-09-24 – Kóstoló azonosítása belépés előtt

## Kész
- `202609240004_invite_preview.sql`: `preview_invite(p_token)` → `{ title, joinable }`,
  `anon` és `authenticated` hívhatja; ugyanaz a tokenellenőrzés, mint a `join_game`-ben.
- `/join/:token`: előbb `resume` (meglévő tagság → `/play`), különben `preview`;
  a becenév-mező fölött „Erre a kóstolóra hívtak meg:” + cím. Érvénytelen link a
  becenév előtt kiderül; lezárt kóstolónál nincs űrlap.

## Ellenőrzés
- DB-tesztek (anon hívás, lecserélt/lejárt link, befejezett játék), adapter-egységteszt,
  invite e2e 8/8. Helyi Supabase-en alkalmazva; valódi böngészőben a megtekintés nem
  hozott létre anonim felhasználót.

## Döntés
- A rövid, kézzel beírható szobakód szándékosan kimaradt: bevezetésekor DB-rate limit
  kötelező (`docs/database.md`).

## Következő
- Első élő kör: szerveroldali körindítás és játékos kóstolólap.
