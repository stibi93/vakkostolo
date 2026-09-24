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

Közvetlen, társasági nyelv: „Na, ez melyik?”, „Mindenki kapott poharat?”.
A mezőnevek és műveleti gombok konkrétak maradnak. A marketingmondatok nem
helyettesíthetik az állapotot, a határidőt vagy a sikeres beküldés visszajelzését.

## Mobil

A játékos- és prezentációnézetben mobilon elmarad a nagy plakát. A játékos
borsor-oldalsávja szintén rejtett, hogy az értékelő kerüljön előre. A látható
beküldési állapot és fókuszjelölés megmarad, a beviteli mezők jól olvashatók.
A legkeskenyebb hostnézetben a plakát csak tipográfiát használ; az illusztráció
nem szoríthatja össze vagy takarhatja a címsort.
A tisztán dekoratív rajzok nem kerülnek a képernyőolvasó tartalmába.

A jelen változás vizuális: a pontozási, időzítési és adatbiztonsági szabályok
ugyanazok. A demó továbbra sem többeszközös játék.
