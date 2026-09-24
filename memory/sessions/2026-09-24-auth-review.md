# Munkamenet: 2026-09-24 / host Auth átnézés utáni javítások

## Elkészült

- `src/auth/store.ts`: új `revalidate()` háttérellenőrzés. Fókusz, `pageshow`,
  `online`, `visibilitychange` és Auth-esemény (pl. `TOKEN_REFRESHED`) már nem
  vált `loading` állapotba, így a hostfelület és a nem mentett bevitel megmarad.
  30 másodperces korlát; hálózati hiba megtartja az igazolt felhasználót,
  401/403 `AuthApiError` vagy eltűnt munkamenet kiléptet és új belépést kér.
  Hibaállapotból a háttéresemény teljes újrapróbálást indít.
- `src/auth/HostArea.tsx`: az eseményfigyelők `store.revalidate()`-et hívnak;
  a gomb továbbra is a teljes `refresh()`.
- `src/lib/fetch.ts`: `createTimeoutFetch`, `AbortSignal.any` nélkül (iOS
  Safari 17.4 előtt hiányzik). `src/lib/supabase.ts` ezt használja, 10 s.
- Tesztek: `tests/auth-revalidate.test.ts`, `tests/fetch.test.ts`.
- Külön ágon és worktree-ben készült (`fix/auth-review`), a párhuzamos
  munkamenetek fájljai nélkül.

## Ellenőrzés

`npm run check` zöld (58 teszt, build). Playwright 22/22 zöld asztali és 360 px
mobil nézetben, átmenetileg 4183/4184 porton a párhuzamos futások miatt.
Valódi Supabase-tokenfrissítés és régi iOS-eszköz nem volt kipróbálva.

## Döntések

A háttérellenőrzés nem minősül új belépési folyamatnak: csak igazolt
munkamenet-vég (401/403, hiányzó session, `SIGNED_OUT`) veszi el a hostfelületet.

## Folytatás

A `create_game` RPC-nek DB-ben kell tiltania az anonim hostot
(`auth.jwt()->>'is_anonymous'`), és a lejárt, még `open` kört a `start_round`
tranzakciójában kell lezárni. Párhuzamos munkához ág/worktree munkamenetenként.
