# Kezdőlapi játékosbelépés – koordináció

2026-09-24. A közös munkapéldányban a felhasználó kérésére a demó főgombja
valódi játékosbelépésre változott. Új /join route: src/invites/PlayerEntryPage.tsx,
linkbeillesztés és ellenőrzés: entry-link.ts, meghívó → becenév → /play/:gameId.
A HomePage főgombja és képes útmutatójának harmadik eleme ide vezet.
A meglévő JoinPage, Auth és szerverjogosultságok nem változtak.

A közben megjelent superadmin-auth-handoff új Google-játékosbelépést tervez.
Integrálásakor NE írjátok felül egészben App.tsx-et/HomePage-et vagy az E2E-ket.
A Google-opció a /join oldalba beilleszthető a meghívó útvonal megtartásával;
a callbacknek a kiválasztott meghívóhoz kell visszatérnie. A /join/:token
meghívó előnézete és a már belépett játékos tagságának visszatérése megmaradjon.
Ez a munkamenet a jelenlegi anonim/beceneves vendégfolyamatot köti össze a
kezdőlappal; nem módosítja a párhuzamos Auth-feladatot.

Saját tesztportok: 4275 dev, 4277/4278 E2E. E2E-k: app.spec.ts navigáció,
invite.spec.ts meglévő beceneves belépés kiterjesztve kezdőlapról indításra,
hibás/idegen link és billentyűzetes beküldés; új entry-link.test.ts.

Kész és ellenőrizve: check 210/210, app/invite/live E2E 34/34. Mobil és
asztali belépés/váró/kezdőlap renderelt állapotai átnézve. Szintetikus
Auth/RPC/Realtime tesztek; új éles integrációs próba e körben nem történt.
A saját 4275 dev és 4277/4278 E2E szerverek leálltak.
