# Vakkóstoló

Magyar nyelvű, mobilra tervezett vakborkóstoló. A játékmester előkészíti a
borokat, a vendégek QR-rel vagy meghívólinkkel belépnek, tippelnek, majd
közösen felfeditek az eredményeket.

Az első kiadás kis, személyes kóstolókat céloz: nincs kötelező fizetés, és a
játékhoz nem kell futásidejű AI. A kóstoló Supabase-t használ (`/host`, `/join`, `/play`).

## Mit csinál az alkalmazás?

| Szerep | Hol | Feladat |
| --- | --- | --- |
| Játékos | `/join`, `/play/:gameId` | Meghívó, becenév, váró, tipp, saját eredmény |
| Játékmester | `/host`, `/host/:gameId` | Borok, fotó, kérdések, meghívó, időzítés, felfedés |
| Kivetítő | `/present/:gameId` | QR, váró, felfedett borok, ranglista |

A játékos a kóstolás alatt csak a tételszámot látja. A bor neve, ára, alkoholfoka
és fotója a felfedésig rejtve marad. A határidőt, a pontozást és az állapotváltást
a szerver dönti el.

Játékos tippje: árkategória, alkoholfok, tetszés (1–10, nem ad versenypontot),
és opcionális egyedi kérdések. Új játékok pontozása: pontos árkategória 50 pont,
szomszédos 25, plusz alkoholpont.

**Még nincs kész:** hosztolt élesítés, telefonos pilot, eredmény e-mailben,
megosztható kivetítő-link idegen böngészőnek, rövid belépőkód.

Részletes szabályok: [termékterv](docs/product.md). Hiányzó kiadási lépések:
[ütemezés](docs/roadmap.md).

## Előfeltételek

- Node.js 22.22 vagy újabb, npm
- [Docker](https://docs.docker.com/engine/install/) és
  [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
  (`supabase` a `PATH`-on, vagy `npx supabase`)

A fejlesztői szervert ne tedd ki az internetre.

## Helyi kóstoló

### 1. Függőségek

```sh
npm ci
```

### 2. Helyi Supabase

```sh
supabase start
supabase migration up --local
```

Az első `start` általában felhúzza a migrációkat. Új migráció után mindig
`migration up --local`. Ne futtass `supabase db reset`-et mentendő adatokon.

A Google OAuth titkai a Gitből kizárt `supabase/.env` fájlba kerülnek. Enélkül
a játékosok anonim meghívóval is beléphetnek; a Google-gomb csak a provider
beállítása után működik. Részletek: [belépés](docs/auth.md).

### 3. Publikus böngészőkulcsok

Másold a `.env.example` fájlt `.env.local` névre. A `supabase status` kiírja
a helyi API címet és a publishable (anon) kulcsot:

```sh
cp .env.example .env.local
supabase status
```

Példa:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Csak ezek a `VITE_` változók mennek a böngészőbe. Service-role / titkos kulcsot
soha ne tegyél `VITE_` változóba.

### 4. Superadmin (játékmester)

Játékmester csak parancssorból létrehozott superadmin lehet. Nyilvános
jelszavas regisztráció nincs. A CLI a titkos kulcsot a futó helyi stackből olvassa.

```sh
npm run superadmin -- create admin
```

Jelszó: legalább 14 karakter, kis- és nagybetű és szám. A `--generate` erős
jelszót ad, és egyszer kiírja. Első belépéskor a `/host` végigvezet a
hitelesítő app (TOTP) beállításán.

További parancsok: `reset-password`, `reset-mfa`, `revoke`, `list`.
Érdemes egy tartalék superadmint is létrehozni.

### 5. Alkalmazás indítása

```sh
npm run dev
```

1. Nyisd meg a `/host` oldalt, lépj be a superadminnal és a hitelesítő kóddal.
2. Hozz létre kóstolót (borok, opcionális fotó és egyedi kérdések).
3. Nyisd meg a várót: a QR és a meghívólink a vendégeké.
4. A kivetítő: ugyanannak a bejelentkezett böngészőnek egy másik lapja,
   `/present/:gameId` (húzd a projektorra).
5. Vendég: `/join` + teljes meghívólink, vagy a QR. Becenév után a váróba kerül.

## Telefon ugyanazon a Wi-Fi-n

```sh
npm run dev:lan
```

A szkript a gép hálózati címére állítja a meghívót, és a Supabase-kéréseket a
Vite-on keresztül továbbítja. A játékmester jelszóval bármelyik címről beléphet.
A játékos Google-belépése helyi stacken csak `127.0.0.1`-ről működik; telefonon
az anonim meghívó a járható út.

WSL 2 alatt a Windows nem adja tovább a portot NAT módban. A szkript kiír egy
PowerShell-parancsot (`scripts/wsl-lan-forward.ps1`); ezt rendszergazdaként,
WSL vagy Windows újraindítás után egyszer futtasd. Nyilvános profilú Wi-Fi-n
a telefon nem éri el a gépet.

## Ellenőrzés

```sh
npm run check          # típusok, lint, tesztek, build
npm run test:e2e       # böngészős próba (egyszer: npx playwright install chromium)
npm run build
npm run preview
```

A `check` a PGlite-ban futtatott SQL-teszteket is tartalmazza. Ez nem helyettesíti
a valódi helyi Auth/Realtime próbát.

Helyi Supabase mellett, opcionálisan:

```sh
npm run test:lobby:local
npm run test:presence:local
npm run test:live:local
npm run test:schedule:local
npm run test:photos:local
npm run test:results:local
```

Ezek ideiglenes fiókokat hoznak létre, majd törlik őket. Párhuzamos munkánál
saját port: `PLAYWRIGHT_BASE_PORT=4195 npm run test:e2e -- --workers=2`.

## Hosztolt projekt

Még nincs éles deploy a repositoryból. A recept:

1. Supabase-projekt (EU), migrációk: `supabase db push`.
2. Auth: e-mail (superadminnak), anonim vendég, TOTP MFA, opcionális Google a
   játékosoknak. „Before User Created” hook: `private.before_user_created`.
3. `.env.local` / buildkörnyezet: HTTPS URL + publishable kulcs.
4. Superadmin: `SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run superadmin -- create <név>`.
5. Statikus frontend: `npm run build`, kimenet `dist`, Node 22.22+.
   A `public/_redirects` az SPA-útvonalakat és az Auth callbacket kezeli.

Pontos callbackcímek és MFA: [belépés](docs/auth.md). Költség és esemény előtti
teendők: [üzemeltetés](docs/operations.md).

## Fejlesztés

- Új adatbázis-változás új migráció; alkalmazott migrációt ne írj át.
- A felület magyar, a kódbeli azonosítók angolok.
- A böngészőbe csak publikus kulcs kerülhet.
- Commit előtt `npm run check`; felületi változásnál `npm run test:e2e` is.

## Dokumentáció

- [Termék és pontozás](docs/product.md)
- [Architektúra](docs/architecture.md) · [adatbázis](docs/database.md)
- [Belépés](docs/auth.md) · [váró](docs/lobby.md) · [élő kör](docs/live-round.md)
- [Kóstolómenet](docs/tasting-schedule.md) · [borfotók](docs/wine-photos.md) · [eredmények](docs/results.md)
- [Üzemeltetés](docs/operations.md) · [ütemezés](docs/roadmap.md)
- [Arculat](docs/design.md) · [AI és memória](docs/ai.md)
- [Agentutasítások](AGENTS.md)
