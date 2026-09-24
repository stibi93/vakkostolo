# Belépés: superadmin játékmester és játékosok

## Szerepek

| Ki | Belépés | Mit ér el |
| --- | --- | --- |
| Játékmester (superadmin) | `/host`: felhasználónév + jelszó, majd hitelesítő app 6 jegyű kódja (TOTP) | saját kóstolók, borok, meghívó, körvezérlés |
| Játékos | meghívó link/QR + becenév (anonim), vagy opcionálisan Google-fiókkal | csak a saját tagsága és a nyilvános játékadatok |

Jelszavas nyilvános regisztráció nincs. Google- vagy anonim fiókkal nem lehet játékmester lenni.

## Hol dől el a jogosultság

- Minden host-RPC a `private.require_permanent_user()` ellenőrzésen megy át
  (`202609240006_superadmin_host.sql`): nem anonim Auth-sor, `app_metadata.vakkostolo_role =
  'superadmin'` és `aal2` munkamenet kell, különben `PERMANENT_AUTH_REQUIRED`,
  `HOST_ROLE_REQUIRED` vagy `MFA_REQUIRED`. Az `app_metadata`-t csak a titkos (service role)
  kulcs írhatja; a felhasználó által módosítható `user_metadata` nem számít.
- A `before_user_created` Auth hook (`202609240007_block_public_password_signup.sql`)
  elutasít minden e-mail/jelszavas regisztrációt, amely nem a superadmin szereppel jön létre.
  Google és anonim játékos nem érintett.
- A felület (`isSuperadmin`, `aal` a tokenből) csak megjelenítés; a döntést a szerver hozza.
- A felhasználónév a háttérben `<név>@superadmin.vakkostolo.invalid` címre képződik.
  A `.invalid` foglalt TLD (RFC 2606): valódi postafiók vagy Google-fiók nem tartozhat hozzá,
  így fiókösszekapcsolással sem vehető át.
- Jelszó: legalább 14 karakter, kis- és nagybetű, szám (`config.toml` és a CLI is ellenőrzi).
  Belépési és kódpróbálkozás IP-nként korlátozott (`[auth.rate_limit]`).

## Superadmin kezelése (`npm run superadmin`)

Csak olyan gépen fut, ahol a Supabase titkos kulcsa elérhető; a böngészőbe sosem kerül.
Helyi stacknél a kulcsot a `supabase status`-ból olvassa, hosztolt projektnél
`SUPABASE_URL` és `SUPABASE_SECRET_KEY` környezeti változóból. A kulcsot nem írja ki,
a jelszót rejtett beviteli mezőben kéri (vagy `--generate` erős jelszót generál és egyszer mutat).

```sh
npm run superadmin -- create <név>          # új superadmin
npm run superadmin -- reset-password <név>  # elfelejtett jelszó
npm run superadmin -- reset-mfa <név>       # elveszett telefon / hitelesítő app
npm run superadmin -- revoke <név>          # jog visszavonása (kóstolók megmaradnak)
npm run superadmin -- list
```

Tartalék: hozz létre egy második superadmint is (pl. `tartalek`), a jelszavát tartsd
jelszókezelőben, a hitelesítőjét egy másik eszközön. A végső visszaállítási út a titkos
kulcs birtoklása (CLI vagy Supabase Dashboard); ezért a titkos kulcsot is jelszókezelőben tartsd.
Jelszócsere a meglévő bejelentkezett munkameneteket nem zárja ki; gyanús esetben a
Dashboardon a felhasználó munkameneteit is töröld.

Első belépéskor a `/host` a jelszó után végigvezet a hitelesítő app beállításán
(QR-kód vagy kézi kulcs). Utána minden új munkamenet a kódot kéri.

## Játékosok Google-belépése

A `/join/:token` oldalon opcionális „Belépés Google-fiókkal” gomb. A visszatérési cél
csak meghívóoldal lehet (`src/auth/return-path.ts`), tetszőleges `next` átirányítás nincs.
A `/auth/callback` egyszer váltja be a PKCE-kódot, a kód és a szolgáltatói hibarészlet
kikerül az URL-ből, majd a játékos visszakerül a meghívóra (becenév a Google-névből előtöltve).
Előny: másik eszközön ugyanazzal a fiókkal visszatérhet. Tervezett: a kóstoló végén
e-mailben kérhető eredmény (külön hozzájárulással; még nincs kész).

## Helyi Supabase

A `supabase/config.toml` tartalmazza a jelszószabályt, a TOTP MFA-t, a hookot és a Google
providert. A Google OAuth-kliens azonosítóját és titkát a Gitből kizárt `supabase/.env` adja
(`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`).
Config-változás után `supabase stop && supabase start`, új migrációhoz `supabase migration up --local`.

A Google felé engedélyezett Supabase callback: `http://127.0.0.1:54321/auth/v1/callback`.
Ez a Google visszatérési címe, nem böngészőben megnyitandó oldal; közvetlenül megnyitva
„OAuth state parameter missing” hibát ad.

## Hosztolt tesztprojekt

1. `.env.local`: a projekt HTTPS URL-je és publishable kulcsa (`VITE_` érték mindig publikus;
   privilegizált kulcsot a konfiguráció elutasít).
2. Migrációk alkalmazása (`supabase db push`), köztük a 0006 és 0007.
3. Auth → Hooks: „Before User Created” → Postgres függvény `private.before_user_created`.
4. Auth → Providers: Email bekapcsolva (a superadminnak kell), Anonymous bekapcsolva,
   Google a játékosoknak. Auth → MFA: TOTP bekapcsolva. Jelszószabály: min. 14, kis/nagybetű+szám.
5. Google OAuth kliens visszatérési URL: `https://<projekt>.supabase.co/auth/v1/callback`;
   Supabase Redirect URL-ek: az éles eredet `/auth/callback` címe.
6. Superadmin: `SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run superadmin -- create <név>`
   (a kulcsot ne mentsd fájlba a repóban).

Ne válts a `localhost` és `127.0.0.1` eredet között Google-belépés közben:
a PKCE-ellenőrző és a munkamenet ugyanahhoz a böngészőeredethez tartozik.

## Próba telefonokkal ugyanazon a hálózaton (hosztolás előtt)

`npm run dev:lan` a helyi Supabase-szel:

- a Vite a `0.0.0.0` címen figyel, és a `/auth/v1`, `/rest/v1`, `/realtime/v1`,
  `/storage/v1`, `/functions/v1` kéréseket a `127.0.0.1:54321` stackre továbbítja
  (`VITE_SUPABASE_URL=/`), így a telefonnak csak az alkalmazás portja kell;
- a meghívó link és QR-kód a gép hálózati címére mutat (`VITE_PUBLIC_APP_URL`,
  a szkript kiírja; felülírás: `LAN_HOST=192.168.x.y npm run dev:lan`);
- titkosítatlan HTTP csak loopback és privát IPv4 címre, csak fejlesztői módban
  elfogadott; buildben továbbra is HTTPS kell.

A játékmester jelszóval bármelyik címről beléphet. A játékosok Google-belépése
viszont csak a `127.0.0.1` eredetről működik (a Supabase-ben engedélyezett visszatérési cím). A kivetítő (`/present/:gameId`)
ugyanennek a böngészőnek egy másik lapja, amely a projektor képernyőjére húzható.

WSL 2 NAT módban a Windows nem adja tovább a portot. Egyszer, illetve a WSL vagy a
Windows újraindítása után rendszergazdai PowerShellben futtasd a szkript által
kiírt parancsot (`scripts/wsl-lan-forward.ps1`). Ez a Windows hálózati címén
továbbítja a portot a WSL felé, és csak privát hálózati profilra nyit tűzfalszabályt.
Nyilvános profilú Wi-Fi-n a telefon nem éri el a gépet.

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
