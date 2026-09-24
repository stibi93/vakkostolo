# Kóstolómenet + borfotó integráció – kész, 2026-09-24

Menet: `0060363`; a borfotók külön integrációs commitban a main ágon.
A forrás fotós worktree érintetlenül megmaradt, nem szabad újra ráalkalmazni.
Az integrációs worktree `/tmp/vakkostolo-integration-20260924` ellenőrzési
példány, nem új beolvasztandó feature (a két funkció már a mainben van).

A 0010 + 0011 alkalmazva a helyi Supabase-re; alkalmazott migrációt ne írjunk át.
A DB-típusokkal együtt ellenőrizve. Host borlista roundId-kulcsot használ,
felfedésnél frissül a fotózárolás. Az üres Storage-törlés nem sikeres visszajelzés.
A 0011-es felfedési panel megjeleníti a fotót, csak szerver által felfedett borhoz
kér URL-t. A párhuzamos 0012 eredménynézet `!snapshot.results` feltétele megmaradt;
az új ResultsPanel és annak privát fotókezelése elsőbbséget kap.

A results-agent módosításai nem kerülnek ebbe a commitba; a LiveGamePanel,
api és model ütközései mindkét fél kódját megőrizve feloldva.
Ellenőrzések és következő lépés: memory/short-term.md.
