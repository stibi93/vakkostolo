# Rövid távú állapot

## Kész
- Lejárt, még nyitott körnél a játékmester `allow_late_edits` RPC-vel újraengedheti a tippek módosítását. A kör nem indul újra; a következő lépés lezárja.
- Pontozás v4: alkoholfok 1 pont, ha a tipp legfeljebb 0,5 százalékponttal (±5 tized) tér el. Új és befejezetlen játékok v4-et kapnak. Migráció: `202610060001_late_edits_and_alcohol_band.sql`.

## Ellenőrzés
- `tests/live-round-db.test.ts`, `tests/results-db.test.ts`, `tests/questions-db.test.ts` lefutott.

## Következő
- A két változás hosztolt Supabase-en csak új migrációként (`supabase db push`) érvényesül. Fizikai pilot továbbra is hátravan.
