# Rövid távú állapot

## Kész
- Lejárt, még nyitott körnél a játékmester `allow_late_edits` RPC-vel újraengedheti a tippek módosítását. A kör nem indul újra; a következő lépés lezárja.
- Pontozás v4: alkoholfok 1 pont, ha a tipp legfeljebb 0,5 százalékponttal (±5 tized) tér el. Új és befejezetlen játékok v4-et kapnak. Migráció: `202610060001_late_edits_and_alcohol_band.sql`.
- Eredmény/kivetítő: a tetszés külön blokk (átlag, szélsők nélküli átlag, medián, szórás, saját értékelés). `src/results/likingStats.ts`.
- Borfotó: a perembe érő világos, egyszínű háttér és árnyéka megjelenítéskor átlátszó lesz (`src/results/bottleCutout.ts`); a kivetítő fotókerete már nem világos doboz.
- Pontszöveg: kérdéseknél „1 pont” a „nem ad versenypontot” helyett; saját összpont v3+ esetén „X / (2 + kérdések) pont”.

## Ellenőrzés
- `tests/live-round-db.test.ts`, `tests/results-db.test.ts`, `tests/questions-db.test.ts` lefutott.
- `npm run check` zöld (330 teszt). E2E: results/live/photos zöld. Előre meglévő, alapon is bukó e2e: `games.spec.ts:169` (törlés), flaky `auth.spec.ts:201`, `lobby.spec.ts:69`.
- E2E helyben: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome` (a Playwright 1.63 böngészője nincs letöltve).

## Következő
- Valódi, fehér hátterű borfotókkal ellenőrizni a kivágást (átlátszó/tiszta üvegnél kockázat).
- A két változás hosztolt Supabase-en csak új migrációként (`supabase db push`) érvényesül. Fizikai pilot továbbra is hátravan.
