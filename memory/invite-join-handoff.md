# Meghívó/QR és anonim vendégbelépés — párhuzamos munkamenet

Dátum: 2026-09-24. Állapot: beolvasztva a `main`-be, a worktree és az ág törölve.

- `860ae12` feat(invites): meghívó, váró megnyitása, anonim vendégbelépés.
- `ef15b1f` chore(supabase): helyi Google provider a Gitből kizárt `supabase/.env`-ből.
- Helyi stack: `supabase start` (Supabase CLI 2.117.0, `~/.local/bin`), mindhárom migráció
  lefutott. `.env.local` a helyi URL-t és publishable kulcsot tartalmazza (Gitből kizárva).
- Valódi helyi Supabase-integrációs próba (valódi JWT, PostgREST, RLS): 15/15 sikeres,
  a tesztfelhasználók és a tesztjáték törölve. Google-belépés és valódi telefon nem volt.
- Részletek: `memory/sessions/2026-09-24-invite-join.md`, `docs/database.md`.
