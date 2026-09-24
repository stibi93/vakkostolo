# Vakpohár

Mobilra tervezett vakborkóstoló: vendégbelépés, közös kóstolás, tippek és
közösen felfedett eredmények. Munkanév, szabadon változtatható.

## Mi készült el?

Alkalmazásváz kezdőlappal (`/`) és külön megnyitható, egy böngészőlapon működő
UX-demóval (`/demo`). Ismeretlen útvonalon visszalépési lehetőség jelenik meg.
A demo a
játékmester, játékos és prezentáció nézetét mutatja. Nem többeszközös játék,
nincs valódi bejelentkezés vagy szerverre mentés. Az éles backendhez adatmodell,
SQL-migráció, hozzáférési szabályok, válaszbeküldő függvény és tesztek készültek.
A hiányzó éles funkciókat a [megvalósítási terv](docs/roadmap.md) sorolja fel.

## Indítás

Node.js 22.22 vagy újabb, npm:

```sh
npm ci
npm run dev
```

A terminálban kiírt helyi címet nyisd meg, majd válaszd a „Próbakóstoló megnyitása”
linket. A `/demo` közvetlenül is megnyitható. A demo nem kér kulcsot.
Telefonos LAN-próbához: `npm run dev -- --host 0.0.0.0` és a gép helyi IP-címe.
Ez még nem szinkronizálja az eszközök játékát. A fejlesztői szervert ne tedd ki az internetre.

```sh
npm run check
npm run test:db
npm run build
npm run preview
```

Böngészős próba: egyszer `npx playwright install chromium`, utána
`npm run test:e2e`. A teszt elindítja és leállítja a helyi szervert, asztali és
360 px széles Chromiumban végigjátssza a demót. A képernyőképek a Gitből kizárt
`test-results/` mappába kerülnek. Ez emulált mobilméret, nem valódi iOS/Android-eszközteszt.

`dist/` a publikálható statikus build. A `.env.example` csak a későbbi éles
integráció publikus változóit tartalmazza. Kitöltése önmagában nem kapcsolja át
a demót. A Supabase-kliens gyára elő van készítve, de a UI még nem használja.

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
