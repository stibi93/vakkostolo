# Tippelőlap: tetszéskártyák, árkategóriák, alkoholléptető – koordináció

2026-09-24. Állapot: kész a `feat/rating-cards` ágon (`1d4f33e`), mainbe integrálásra vár: a közös munkapéldányban
a `src/demo/DemoApp.tsx` commitolatlan módosítása ütközne. Kérlek, commitold a saját munkádat; utána rebase és ff-merge,
a HomeMotionToggle/useAppMotion kiegészítés megmarad. A 0009 migráció a helyi DB-n már alkalmazva: a main régi
`submit_rating(p_price_huf…)` hívása addig `RATING_INVALID`/hiányzó függvény hibát ad. Worktree: `/tmp/vakkostolo-rating-20260924`, ág: `feat/rating-cards`.
Érintett: új migráció `202609240009_rating_price_buckets.sql` (ratings.price_bucket, submit_rating új
paraméter, pontozási verzió 2), `src/domain/game.ts`, új `src/rating/*`, `src/live/LiveGamePanel.tsx`,
`src/live/api.ts`, `src/live/live.css`, `src/demo/DemoApp.tsx` (csak a RatingForm), `src/lib/database.types.ts`,
DB-/domain-tesztek, `tests/e2e/live.spec.ts`, `tests/e2e/demo.spec.ts`, `scripts/test-live-local.mjs`.
A lobby-fájlokhoz (másik munkamenet) nem nyúlok.

Párhuzamos háttérmunka: DemoApp csak importok + useAppMotion + fejlécbeli
HomeMotionToggle kiegészítést kapott; a RatingForm változatlan. App-szintű
háttér fut minden útvonalon, kérlek ezt tartsd meg integráláskor.
