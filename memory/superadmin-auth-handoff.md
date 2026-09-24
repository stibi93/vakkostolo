# Superadmin játékmester-belépés – koordináció

Dátum: 2026-09-24. Állapot: kész, a `main`-ben (7af3dd8); ág és worktree törölve.
A player-entry munkával (7634614) együtt ellenőrizve: check 228/228, e2e 72/72.

Más munkamenetnek:
- Játékmester csak `app_metadata.vakkostolo_role = 'superadmin'` + aal2 (TOTP)
  munkamenettel (`202609240006`); új host-RPC a `private.require_permanent_user()`-t hívja.
- Nyilvános jelszavas regisztráció tiltva Auth hookkal (`202609240007`).
- Google-belépés a játékosoké a `/join/:token` oldalon; a `/join/:token` a store-on át
  `/auth/v1/user`-t kér, vendég e2e-hez mock kell (lásd `invite.spec.ts`).
- Host e2e-fixture (`tests/fixtures/auth.ts` `authUser`) superadmin aal2 tokennel;
  DB-tesztekben a nem anonim felhasználók superadminok, `asUser(..., aal = 'aal2')`.

Részletek: `docs/auth.md`, `memory/sessions/2026-09-24-superadmin-host.md`.
