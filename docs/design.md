# Arculat — Vakkóstoló

A felhasználó 2026-09-24-én jóváhagyta a Halves alapján készült, saját
bordó–törtfehér irányt. Az alkalmazás neve **Vakkóstoló**, dekoratív pont nélkül.
A korábbi sárga arculatot elutasította.

## Jóváhagyott irány

Vizuális referencia: [Halves Design System](https://www.halves.wine/system).
Saját, jóváhagyott előnézet: [kóstolólap](design-proposals/halves/index.html).
A Halves márkáját és komponenskódját nem vesszük át; a rendszer szerkesztési
elvei szolgálnak alapul. Új frontendfüggőség nem szükséges.

- Törtfehér háttér (`#F7F5F2`), fehér űrlapfelület.
- Mély bordó főművelet (`#713336`), sötétebb hover (`#58262A`).
- Tintaszínű szöveg (`#24211F`), másodlagos szöveg (`#6A635F`),
  halvány kőszürke elválasztók (`#DDD7D1`).
- Georgia címek és márkafelirat, Arial mezők és súgók. Rendszerbetűk,
  magyar ékezetekkel, külön fontletöltés nélkül.
- Vékony elválasztók, enyhe lekerekítés, egyértelmű főgomb és tömör kóstolólap.
- A felületi szín és illusztráció felfedésig nem utalhat a rejtett borra.
  Minden tétel azonos vizuális kezelést kap, csak a tételszám különbözik.

A személyes `frontend-design` skill `references/wine-tasting.md` profilja
rögzíti az alkalmazandó elveket. A profil ehhez a termékhez jóváhagyott;
más projektre nem jelent automatikus szín- vagy stíluselőírást.

## Megvalósítás állapota

A jóváhagyott arculat az alkalmazásban is megvalósult: kezdőlap, belépési és
hibaállapotok, demó játékmesteri, játékos- és kivetítőnézet, értékelés és eredmények.
A kezdőlapon egyértelműen jelölt kóstolólap-minta mutatja a becsléseket.
A játékosnézetben a feladat kerül előre; a dekoratív nyitóblokk rejtett.

A közös tokenek a `src/styles.css` elején találhatók. A vezérlők körvonala
`--control-border` (`#968B84`), a hibajelzés `--error` (`#9F2727`), a fókusz
bordó körvonal. Az új online játékfelületek ugyanezeket a tokeneket használják.
Az oldalspecifikus kezdőlap- és belépési stílusok a `src/app/app.css`-ben vannak.

## Felületi hang

Természetes, tárgyilagos magyar szövegek, tegezéssel. A cím a funkciót vagy az
állapotot nevezi meg, a gomb a műveletet, a súgó a következő lépést. Erőltetett
szlogenek és szóviccek helyett konkrét feliratok szerepelnek. Ez a 2026-09-24-i
felhasználói kérés felülírja a korábbi társasági szlogeneket.
Az állapot, határidő és visszaigazolt beküldés jelentése maradjon pontos.

## Mobil és ellenőrzés

360 px szélességtől ne legyen vízszintes túlcsordulás. A márkafelirat és az
állapotjelző rendezett tördelést kapjon. Legalább 44 px-es érintési célok,
olvasható mezők és látható billentyűzetfókusz szükséges. Az értékelés maradjon
elöl a játékosnézetben; dekoráció ne szorítsa ki a feladatot.

A jóváhagyott előnézet nem helyettesíti az átvezetett alkalmazás asztali és
mobilos vizuális ellenőrzését. A demó jelölése, a pontozás, az időzítés és az
adatbiztonsági szabályok a designváltás során is megmaradnak.
