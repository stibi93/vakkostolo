# Borfotók és kóstolómenet

A játékmester a létrehozáskor vagy a mentett borlistában választhat képet.
Meglévő kóstoló másolásakor a borfotók is átkerülnek: a privát tárolóban
új körútvonalra másolódnak, és mentés előtt lecserélhetők vagy elhagyhatók.
A böngésző JPEG-re alakítja, legfeljebb 1600 px hosszabb élre méretezi és
2 MB alá tömöríti; az újrakódolás elhagyja az EXIF-metaadatokat.
Hibás vagy sikertelen csere esetén a korábbi fotó megmarad.
A létrehozott játék akkor is megmarad, ha valamelyik fotó feltöltése nem sikerült;
az érintett bornál újrapróbálható a feltöltés.

A `wine-photos` Storage-bucket privát. A fájl útvonala `<game_id>/<round_id>.jpg`,
így a menet átrendezése nem cseréli fel a fotókat. A felületi borlista is a
körazonosítót használja kulcsként. Új bor mentése után a host borlistájában
adható hozzá a képe.

Felfedés előtt csak a saját superadmin host aal2 munkamenete láthatja és
kezelheti a fotót. A játékos a szerver `revealed` listájában szereplő borhoz
kér aláírt URL-t; a Storage külön ellenőrzi a tagságot és a felfedést.
A felfedett bor fotója már nem módosítható. Fotó nélkül, illetve képhibánál
is megtekinthetők a felfedett boradatok. A közös élő panel miatt a kivetítőn
is megjelenhet a felfedett kép.

A törlés csak akkor kap sikeres visszajelzést, ha a Storage-válasz tartalmazza
a törölt fájlt. A jogosultság miatt üres törlési válasz nem sikerjelzés.
A körvezérlés státuszváltásakor a host boradatai frissülnek, így megjelenik
a felfedés miatti fotózárolás.

## Ellenőrzés és üzemeltetés

- `npm run test:photos:local`: valódi helyi Storage feltöltés/csere/törlés,
  rejtett hozzáférés tiltása és valódi körvezérléssel felfedett kép olvasása.
  Kizárólag saját szintetikus fotókat és tesztfiókokat hoz létre, majd töröl.
- `tests/schedule-photos-db.test.ts`: sorrendváltoztatás, tartós fotókapcsolat,
  titkos snapshot és valódi felfedési művelettel nyíló hozzáférés.
- `tests/e2e/photos.spec.ts`: mobil/asztali feltöltés, hibák, újratöltés,
  átrendezés, törlés, valamint felfedés előtti képkérés hiánya.
- 0010 és 0011 migráció együtt szükséges. Ha a helyi DB-n 0011 már alkalmazva
  van, a 0010 pótlása `supabase migration up --local --include-all` útján történt.
- Egy eltávolított, még meg nem kezdett bor képe elérhetetlenné válik, de a
  Storage-fájl fizikai takarítása külön üzemeltetési feladat; a menet RPC
  nem töröl közvetlenül Storage-metaadatot.

A szerveroldali pontozás és eredménylista külön következő fejlesztés.
