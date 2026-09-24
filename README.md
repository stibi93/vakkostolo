# Vakpohár

Mobilra tervezett vakborkóstoló: vendégbelépés, közös kóstolás, tippek és
közösen felfedett eredmények. Munkanév, szabadon változtatható.

## Mi készült el?

Projektalap és kipróbálható, egy böngészőlapon működő UX-demo. A demo a
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

A terminálban kiírt helyi címet nyisd meg. A demo nem kér kulcsot.
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

## Terv és projektmemória

- [Termék, adminfelület, pontozás](docs/product.md)
- [Architektúra](docs/architecture.md) és [adatbázis](docs/database.md)
- [Ütemezés és becsült ráfordítás](docs/roadmap.md)
- [Telepítés, költség és üzemeltetés](docs/operations.md)
- [AI és memóriakezelés](docs/ai.md)
- [Arculat és mobilfelület](docs/design.md)
- [Agentutasítások](AGENTS.md), [skillek](skills.md)
- [Aktuális állapot](memory/short-term.md), [tartós döntések](memory/long-term.md)

Külső fiók, felhőprojekt, domain vagy telepítés nem jött létre. A munkakönyvtár
védett `.git/` helyőrzője nem inicializált Git-repository; a CI-fájlok GitHubra
feltöltött, valódi checkoutban aktiválódnak. A `.agents/` és `.codex/` mappákat
az induló alap nem módosítja.
