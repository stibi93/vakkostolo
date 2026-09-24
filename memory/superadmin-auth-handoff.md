# Superadmin játékmester-belépés – koordináció

Dátum: 2026-09-24. Állapot: kész, a `main`-be beolvasztva (ág és worktree törölve).

Lényeg: játékmester csak `app_metadata.vakkostolo_role = 'superadmin'` + aal2 (TOTP)
munkamenettel (`202609240006`); nyilvános jelszavas regisztráció tiltva Auth hookkal
(`202609240007`). A Google-belépés a játékosoké a `/join` oldalon.

Más munkamenetnek: host e2e-fixture (`tests/fixtures/auth.ts` `authUser`) superadmin aal2
tokennel; DB-tesztekben a nem anonim felhasználók superadminok, `asUser(..., aal = 'aal2')`.
Új host-RPC a `private.require_permanent_user()`-t hívja, így automatikusan védett.
Részletek: `docs/auth.md`, `memory/sessions/2026-09-24-superadmin-host.md`.
