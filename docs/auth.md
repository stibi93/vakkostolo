# Játékmesteri belépés

A `/host` Google-belépést, kijelentkezést és munkamenet-visszaállítást ad.
A `/auth/callback` egyszer váltja be az OAuth-kódot PKCE-folyamatban, majd
visszavisz a `/host` oldalra. A kód és a szolgáltatói hibarészlet kikerül az URL-ből.
Nincs tetszőleges `next` átirányítás: a visszatérési cél mindig a saját hostoldal.

A helyi munkamenetet a Supabase SDK tárolja és frissíti. A felület a szerver
`getUser` válaszát ellenőrzi; a tárolt userobjektum önmagában nem nyit hostnézetet.
Csak az explicit nem anonim felhasználó kap játékmesteri kezdőnézetet. Ez még
nem jogosít egyetlen játék kezelésére sem: azt a játék hostazonosítója, az RLS
és a host-RPC-k ellenőrzik. A `create_game`, `list_host_games`, `get_host_game`
a kanonikus Auth-sorban is ellenőrzi a nem anonim fiókot; a két olvasó RPC
csak saját játékot enged. A migrációkat a tesztprojektre is alkalmazni kell.

## Helyi frontend és távoli tesztprojekt

1. A `.env.example` alapján készíts Gitből kizárt `.env.local` fájlt.
   Töltsd ki a tesztprojekt HTTPS URL-jét és publikus publishable kulcsát.
   A korábbi `anon` JWT is használható; privilegizált kulcsot a konfiguráció
   elutasít. Ez nem védi meg a buildbe már beleírt titkot: `VITE_` érték mindig publikus.
2. A Supabase Google provider beállításánál add meg a Google OAuth kliensazonosítót
   és titkot. A titok csak a szolgáltatónál legyen, frontendváltozóban soha.
3. A Google OAuth kliens engedélyezett visszatérési URL-je a Supabase által
   megadott `https://<projekt>.supabase.co/auth/v1/callback`. Ez nem az alkalmazás
   saját `/auth/callback` útvonala.
4. A Supabase Auth URL Configuration alatt állítsd be a frontend Site URL-jét,
   és az alábbi pontos Redirect URL-ek közül a használt címet:
   `http://127.0.0.1:5173/auth/callback`, `http://localhost:5173/auth/callback`.
   Telepítéskor az éles HTTPS eredet `/auth/callback` címét is külön engedélyezd.
5. Indítsd újra a Vite-ot: `npm run dev`. Nyisd meg a `/host` oldalt.
   A Google tesztalkalmazás Audience beállításában a próbához használt fióknak
   engedélyezettnek kell lennie.

Ne válts a `localhost` és `127.0.0.1` eredet között a folyamat közben:
a PKCE-ellenőrző és a munkamenet ugyanahhoz a böngészőeredethez tartozik.
A konfiguráció nélküli kezdőlap és demo továbbra is működik; a hostoldal ilyenkor
tájékoztat, nem kínál működőnek látszó belépést.

Helyi Supabase stacknél az alkalmazás callbackjei a `supabase/config.toml`-ban
szerepelnek. A Google provider nincs automatikusan bekapcsolva: a saját klienshez
az alábbi konfiguráció szükséges, környezeti titokhivatkozásokkal:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
```

Ilyenkor a Google felé engedélyezett Supabase callback:
`http://127.0.0.1:54321/auth/v1/callback`.

## Hiba és visszatérés

- Lejárt, hiányzó vagy megszakított callback: új Google-belépés indítható.
- Sikertelen munkamenet-ellenőrzés: nincs hosttartalom; újrapróbálás, új belépés
  vagy kijelentkezés érhető el. A nyers szolgáltatói hibát nem írjuk a felületre.
- Auth-kérésenként 10 másodperces hálózati, a felület műveleteinél 15 másodperces
  várakozási korlát van. A korábbi lekérés késői eredménye nem írja felül
  a kijelentkezést vagy egy újabb ellenőrzést.
- Lapfókusz, visszatérő hálózat és Auth-esemény ismét ellenőrzi a munkamenetet.
  Az SDK a többi lapnak is jelzi a kijelentkezést.
- A kijelentkezés `local` hatókörű: ezt a munkamenetet érinti, nem minden eszközt.
  Hálózati hibánál az SDK helyben már törölheti a belépést; a felület ezt
  megkülönbözteti a szerver által is visszaigazolt kilépéstől.
- Anonim vendég nem kap hostnézetet. Tartós fiókba lépés előtt kijelentkezik;
  a UI jelzi, hogy ezzel a helyben tárolt vendégbelépés megszűnik.

## Ellenőrzés és korlát

`npm run check`: konfiguráció, Auth-állapot, callback, időkorlát és késői
válaszok tesztjei a meglévő domain/DB-próbák mellett.

`npm run test:e2e`: külön, kényszerítetten konfiguráció nélküli (4173) és
szintetikus Auth-konfigurációjú (4174) Vite-szerver. A `PLAYWRIGHT_BASE_PORT`
átállítja az első portot, a második az azt követő port. A böngésző a valódi Supabase
SDK-t használja, de a teszt az Auth HTTP-válaszokat helyettesíti. A fejlesztő
`.env.local` projektjét nem használja. Ez nem valódi Google- vagy Supabase-próba.

Kiadás előtt tesztprojektben kell igazolni: Google → callback → újratöltés,
lejárt munkamenet frissítése, két lap kijelentkezése, megszakított consent,
engedélyezett callbackcímek és valódi mobilos visszatérés. A host-RPC-k
PGlite-tesztjei a tartós Auth és a tulajdonjog ellenőrzését már lefedik;
kiadás előtt a tényleges Auth/JWT és RPC kapcsolatot is próbálni kell.

Hivatkozások: [Supabase Google-belépés](https://supabase.com/docs/guides/auth/social-login/auth-google),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[Auth-események](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[React Router](https://reactrouter.com/start/declarative/installation).
A kód a verziórögzített, helyben telepített SDK szerződéseit is ellenőrzi.
