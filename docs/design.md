# Arculat — borklub és kóstolólap

A felhasználó a korábbi arculatot túlságosan AI-generált hatásúnak találta.
Az új irány egy kis borklub nyomtatott plakátjának és a kézbe adott kóstolólapnak
a világából indul ki. Munkaverzió, a felhasználói visszajelzés alapján finomítható.

## Vizuális alap

- Tintafekete: `#25291f`; papír: `#f4f1e8`; lap: `#fffcf5`.
- Plakátsárga: `#f3cf54`; piros jelölés: `#b53e26`.
- Bricolage Grotesque a címsorokhoz és felülethez; IBM Plex Mono a számozáshoz,
  időhöz és rövid feliratokhoz. A fontok helyben kiszolgált, rögzített npm-csomagok.
- Egyenes vonalak, lapkeretek, aláhúzott mezők, perforált borsorjegy.
- A palackok illusztrációja saját SVG-komponens: `src/demo/TastingArtwork.tsx`.
  Nem ábrázol valódi borazonosságot; a számozás a vakjáték része.

## Felületi hang

Természetes, tárgyilagos magyar szövegek, tegezéssel. A cím a funkciót vagy az
állapotot nevezi meg, a gomb a műveletet, a súgó a következő lépést. Erőltetett
szlogenek és szóviccek helyett konkrét feliratok szerepelnek. Ez a 2026-09-24-i
felhasználói kérés felülírja a korábbi társasági szlogeneket.
Az állapot, határidő és visszaigazolt beküldés jelentése maradjon pontos.

## Játékmesteri belépés

A `/host` a meglévő papírszínt, betűket, szögletes gombokat és sárga jelölést
használja. Egyetlen feladatpanel mutatja a belépést vagy a fiók állapotát.
A hibánál a szöveges indok mellett újrapróbálás látható; betöltés közben nem
jelenik meg korábbról megmaradt hosttartalom. A mintademó külön linkkel érhető el.
Az állapotokat 360 px és asztali szélességen is vizuálisan ellenőrizzük.

## Mobil

A játékos- és prezentációnézetben mobilon elmarad a nagy plakát. A játékos
borsor-oldalsávja szintén rejtett, hogy az értékelő kerüljön előre. A látható
beküldési állapot és fókuszjelölés megmarad, a beviteli mezők jól olvashatók.
A legkeskenyebb hostnézetben a plakát csak tipográfiát használ; az illusztráció
nem szoríthatja össze vagy takarhatja a címsort.
A tisztán dekoratív rajzok nem kerülnek a képernyőolvasó tartalmába.

A jelen változás vizuális: a pontozási, időzítési és adatbiztonsági szabályok
ugyanazok. A demó továbbra sem többeszközös játék.
