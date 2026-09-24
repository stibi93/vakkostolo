# Vakkóstoló

Mobilra tervezett vakborkóstoló: vendégbelépés, közös kóstolás, tippek és
közösen felfedett eredmények. Munkanév, szabadon változtatható.

## Mi készült el?

Alkalmazásváz kezdőlappal (`/`) és külön megnyitható, egy böngészőlapon működő
UX-demóval (`/demo`). Ismeretlen útvonalon visszalépési lehetőség jelenik meg.
A demo a játékmester, játékos és prezentáció nézetét mutatja. Nem többeszközös
játék, a tippeket nem menti szerverre. A külön `/host` oldalon Supabase Google
belépés, munkamenet-visszaállítás és kijelentkezés készült; a használatához
tesztprojekt-konfiguráció szükséges. Az éles backendhez adatmodell,
SQL-migráció, hozzáférési szabályok, válaszbeküldő függvény és tesztek készültek.
A bejelentkezett host létrehozhat 1–12 boros kóstolót, megnézheti saját mentett
játékait és azok boradatait. A szerver ellenőrzi a hostot, az adatokat és az
ismételt mentést. Meghívó, QR, anonim belépés és élő közös váró is elérhető; a kör indítása még nincs.
A váró és a valódi helyi Supabase-próba leírása: [közös váró](docs/lobby.md).
A hiányzó éles funkciókat a [megvalósítási terv](docs/roadmap.md) sorolja fel.

## Indítás

Node.js 22.22 vagy újabb, npm:

```sh
npm ci
npm run dev
```

A terminálban kiírt helyi címet nyisd meg, majd válaszd a „Próbakóstoló megnyitása”
linket. A `/demo` közvetlenül is megnyitható. A demo nem kér kulcsot.
Telefonos próbához ugyanazon a hálózaton: `npm run dev:lan` (helyi Supabase-szel).
A meghívó link és QR-kód ekkor a gép hálózati címére mutat, a Supabase-kérések a
Vite-on keresztül mennek; WSL alatt egyszeri porttovábbítás kell (részletek: `docs/auth.md`).
Ez még nem szinkronizálja a kóstolás menetét. A fejlesztői szervert ne tedd ki az internetre.

```sh
npm run check
npm run test:db
npm run db:types
npm run build
npm run preview
```

Böngészős próba: egyszer `npx playwright install chromium`, utána
`npm run test:e2e`. A teszt két helyi szervert indít (4173 és 4174), asztali és
360 px széles Chromiumban ellenőrzi a demót és az Auth-folyamatot. Az Auth-próbák
szintetikus HTTP-válaszokat használnak, nem a fejlesztő valódi projektjét.
Ugyanez vonatkozik az új játék létrehozási/lista/részlet RPC-próbákra is.
Párhuzamos munkánál saját worktree és függőségtelepítés mellett például
`PLAYWRIGHT_BASE_PORT=4195 npm run test:e2e -- --workers=2` használható;
ilyenkor a tesztszerverek a 4195 és 4196 portot foglalják.
A képernyőképek a Gitből kizárt
`test-results/` mappába kerülnek. Ez emulált mobilméret, nem valódi iOS/Android-eszközteszt.

`dist/` a publikálható statikus build. A `.env.example` alapján létrehozott
`.env.local` publikus Supabase-beállításait a `/host` használja. A Google providert
és a callbackcímeket is be kell állítani: [belépési útmutató](docs/auth.md).
A demo ettől független, helyi próba marad. Valódi Google/Supabase-integrációs
teszt és többeszközös játékpróba még nem történt.

## Fejlesztési egységek és Git

A helyi repository `main` ágon indul. Az első commit a korábbi projektalapot
őrzi, a következő az alkalmazásvázat adja hozzá. Minden új egység egy konkrét,
ellenőrizhető viselkedést szállítson, a hozzá tartozó tesztekkel és dokumentációval.
Commitnév: például `feat(auth): add host sign-in` vagy `fix(lobby): restore membership`.
Commit előtt `npm run check`, felületi változásnál `npm run test:e2e` is szükséges.
A függőségi lockfile verziózott; környezeti titkok és generált fájlok kizárva.

A következő egységek sorrendjét és készültségi feltételeit a
[fejlesztési terv](docs/roadmap.md#önálló-fejlesztési-egységek) tartalmazza.

## Terv és projektmemória

- [Termék, adminfelület, pontozás](docs/product.md)
- [Architektúra](docs/architecture.md) és [adatbázis](docs/database.md)
- [Ütemezés és becsült ráfordítás](docs/roadmap.md)
- [Telepítés, költség és üzemeltetés](docs/operations.md)
- [AI és memóriakezelés](docs/ai.md)
- [Arculat és mobilfelület](docs/design.md)
- [Agentutasítások](AGENTS.md), [skillek](skills.md)
- [Aktuális állapot](memory/short-term.md), [tartós döntések](memory/long-term.md)

Helyi Git-repository létrejött; távoli repository nincs beállítva.
Külső fiók, felhőprojekt, domain vagy telepítés nem jött létre.
A meglévő GitHub Actions ellenőrzések GitHubra feltöltés után futnak távol is.

Az első online kör indítása és a játékos tippek mentése elkészült;
[API, működés és helyi integrációs próba](docs/live-round.md).
