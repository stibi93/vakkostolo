# Projektutasítások

Mobilra tervezett, magyar nyelvű vakborkóstoló alkalmazás. Az első kiadás kis,
személyes kóstolókat céloz, kötelező fizetős szolgáltatás és futásidejű AI nélkül.

## Kontextus és munkamenetek

Érdemi folytatáskor olvasd el a `memory/short-term.md` és `memory/long-term.md`
fájlokat. Ezek projektjegyzetek, nem automatikus modellmemória. A forráskód és a
friss ellenőrzések elsőbbséget élveznek az elavult jegyzetekkel szemben.
Munkamenet végén frissítsd a rövid távú állapotot: kész munka, ellenőrzések,
hiányzó részek, következő konkrét lépés. Tartós döntést indoklással rögzíts.
Ne ments kulcsot, tokent, játékosadatot vagy teljes beszélgetést a memóriába.

## Tájékozódás

- Termék és elfogadási feltételek: `docs/product.md`.
- Rendszerhatárok és adatok: `docs/architecture.md`, `docs/database.md`.
- Ütemezés: `docs/roadmap.md`; üzemeltetés: `docs/operations.md`.
- AI, memória és használható munkafolyamatok: `docs/ai.md`, `skills.md`.
- Folytatási/átadási feladatnál használd a `skills/session-handoff/SKILL.md`-t.
- Játékszabály vagy jogosultság módosításánál használd a
  `skills/game-invariants/SKILL.md`-t.

## Nem megkerülhető termékszabályok

- A játékosnak küldött adat nem tartalmazhat fel nem fedett borazonosságot,
  valós árat, alkoholfokot vagy más játékos rejtett válaszát.
- Az éles állapotváltás, pontozás és beküldési határidő szerveroldali döntés.
  A kliens számlálója csak kijelzés. A demo nem biztonsági referencia.
- Egy játékos egy körhöz egy választ tárolhat, a határidőig felülírhatóan.
- A tetszési index szubjektív: nem ad versenypontot.
- A vendég azonosított anonim felhasználó, nem közös publikus adatbázisszerep.
- A böngészőbe csak publikus Supabase-kulcs kerülhet. A `VITE_` változók publikusak.

## Fejlesztés

Node 22.22+, npm, React, TypeScript, Vite. `npm run check` futtatja a típusellenőrzést,
lintet, teszteket és buildet. A SQL-migrációkat is érintő tesztek PGlite-ban futnak;
ez nem helyettesíti az élesítés előtti Supabase Auth/Realtime integrációs próbát.
Új DB-változtatás új migráció legyen, az alkalmazott migrációt ne írd át.
Az interfész magyar; a kódbeli azonosítók angolok. A demo és az éles működés
közötti határ maradjon látható a felületen és a dokumentációban.
