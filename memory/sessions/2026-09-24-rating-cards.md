# 2026-09-24 – Tippelőlap: árkategóriák, alkohol-léptető, tetszéskártyák

## Kész
- 0009 migráció: `ratings.price_bucket` (1–8), `price_huf` nullázható; új
  `submit_rating(p_round_id, p_price_bucket, p_alcohol_tenths, p_liking)`,
  `RATING_INVALID`; `private.price_bucket(integer)`; `scoring_version` 1|2, alap 2.
- Pontozás v2 (`src/domain/game.ts`): egyező kategória 50, szomszédos 25, alkohol v1 szerint.
  Döntés: a tipp kategória, nem forintösszeg, ezért új verzió kellett (v1 régi játékokhoz).
- `src/rating/RatingFields.tsx` + `draft.ts` + `rating.css`: 8 árkategória-kártya,
  −/+ fél fokos léptető (0–25%, üresből 12,0), `12,0` helyőrző fókuszkor kitöltve és
  kijelölve (`flushSync` + `select()`), 01–10 tetszéskártyák. Élő kör és demo is ezt használja.
- `scripts/local-superadmin.mjs`: szintetikus superadmin TOTP-vel (aal2); a
  `test:live:local` és `test:lobby:local` a superadmin-váltás óta ezért bukott.

## Ellenőrzés
- check 247/247, e2e 74/74; képernyőképek mobil/asztali nézetben átnézve.
- 0009 alkalmazva a helyi DB-re; `test:live:local`, `test:lobby:local`, `test:presence:local` sikeres.

## Korlát
- Fizikai telefonos próba (érintéses léptetés, numerikus billentyűzet) még nincs.
