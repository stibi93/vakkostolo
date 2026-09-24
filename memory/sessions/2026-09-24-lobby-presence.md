# 2026-09-24 – Váró: élő jelenlét, kezdőlapi háttér

## Kész
- 0008 migráció: privát Realtime Presence `game:<uuid>:presence`; tag jelezhet, host és tag lát.
- `src/lobby/presence.ts` (csatornánként/fülenként egy, StrictMode- és bontásbiztos),
  `usePresence`; a játékos `{ participant_id }`-t küld, host/kivetítő csak figyel.
- Váró: számozott címkecsempék, „N bent van most”, „bent van / nincs bent”; kézi
  frissítőgomb helyett csak hibánál „Újrapróbálás”.
- Kivetítő és játékosváró: `HomeAtmosphere` háttér + szüneteltetés; QR fehér kártyán.
  Játékosnál kör közben a háttér áll.

## Ellenőrzés
- check 239/239, e2e 72/72 (szintetikus presence-szerverrel), `npm run test:presence:local`
  8/8 valódi helyi Realtime-mal. Képernyőképek 360/1024 px-en átnézve.

## Korlát
- A jelenlét tartalmát a Realtime nem ellenőrzi: tag más tag azonosítóját is jelezheti (csak kijelzés).
- Fizikai telefonos próba (képernyőzár, háttérbe tett böngésző) még nincs.
