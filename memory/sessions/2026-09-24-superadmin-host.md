# 2026-09-24 – Superadmin játékmester, játékosi Google-belépés

## Kész
- DB 0006: `private.require_permanent_user()` = nem anonim + `app_metadata.vakkostolo_role =
  'superadmin'` + `aal2` (minden host-RPC kapuja). 0007: `before_user_created` hook tiltja a
  nyilvános e-mail-regisztrációt. Harness: `auth.jwt()` (`request.jwt.claim.aal`),
  `raw_app_meta_data`, `supabase_auth_admin` szerep.
- `/host`: felhasználónév + jelszó → TOTP beállítás (QR/kulcs) vagy kód → munkafelület.
  Google/anonim fiók: tájékoztatás + kijelentkezés. `src/auth/superadmin-account.ts` (TS,
  függőség nélkül, a CLI is importálja), `mfa.ts`, `MfaGate.tsx`, `return-path.ts`.
- `/join`: opcionális Google-gomb; callback után vissza a meghívóra, becenév előtöltve.
- `npm run superadmin -- create|reset-password|reset-mfa|revoke|list` (titkos kulcs csak CLI-ben).

## Döntés
- `[auth.email] enable_signup = false` az egész e-mail-szolgáltatót letiltja (a superadmin
  sem lép be) → helyette Auth hook. Valódi Supabase-próbán derült ki, mock-teszten nem.

## Ellenőrzés
- `npm run check` zöld, teljes e2e zöld; valódi helyi Supabase: 19 ellenőrzés (regisztráció
  tiltva, anonim ok, aal1 → MFA_REQUIRED, TOTP → aal2 → create_game, CLI parancsok);
  valódi böngészőben jelszó → QR-os TOTP → kóstoló létrehozás.

## Hiányzik
- Valódi Google-fiókos játékosbelépés kézi próbája; hosztolt projektben hook + MFA beállítása.
- Eredmény e-mailben (roadmap 6.).
