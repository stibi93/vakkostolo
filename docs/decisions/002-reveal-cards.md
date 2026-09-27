# 002 — A felfedést önálló menetkártya szabályozza

Dátum: 2026-09-24. Állapot: elfogadott felhasználói kérés, implementálva.

A korábbi N boronként kötelező felfedés korlátozta a bemutató menetét.
A bor lezárását ezért elválasztjuk a boradatok nyilvánossá tételétől.

A privát menet wine/break/reveal kártyákból áll. Egy Felfedés kártya 1–40
egyedi, ugyanazon játékban előtte szereplő bort választ ki, címmel és üzenettel.
A sorrendet mentéskor, a lezárt állapotot végrehajtáskor ellenőrzi a szerver.
A kártya indítása és az adatok publikálása atomi, verzióvédett és idempotens.
A bemutató ismételhet már felfedett borokat.

A host mentett áttekintése tartalmazza a szüneteket és kártyákat is.
Játékoshoz csak az aktív kártya szövege és már felfedett borazonosítói jutnak.
A kártya borlapjai a kijelölést követik; a ranglista az eddig felfedett borokat.

A befejezés nem fedi fel a kimaradt borokat. Hátralévő lépés vagy nyitott kör
esetén nem lehet befejezni. A végső pontszám a felfedett borok alapján készül.
Régi kóstolóhoz sem generálunk automatikus kártyát. A megmaradó reveal_every
mező kompatibilitási adat, nem játékszabály.
