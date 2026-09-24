# Aktuális állapot — 2026-09-24

## Teljes kóstolómenet az új űrlapon, kártyás felfedés és admin törlés

- Új kóstoló létrehozásakor közvetlen Bor / Szünet / Felfedés hozzáadás.
  Közös sorrend, nyilas mozgatás, törlés; szünetcím/szöveg/idő, felfedéscím,
  szöveg és egy vagy több korábbi bor kijelölése. Nem kell előbb bort menteni.
  Érvénytelen kijelölés javítható; hibás menetet a kliens és a szerver is tilt.
- 0016: create_game_with_schedule, atomi létrehozás és menetrögzítés.
  Indexekből tartós kör-ID-k, teljes kezdeti bemenet hash-e és host/kérés zár.
  Ismétlés nem dupláz és nem írja vissza a később módosított menetet.
- 0014: explicit Felfedés kártyák. Nincs kötelező N boros blokk vagy automatikus
  adatfelfedés lezáráskor. Csak a kijelölt borok válnak láthatóvá; korábbi bor
  ismételhető. Kivetítő és játékos kártyánként lapoz, ranglista összesített.
  Befejezés nem fed fel kimaradt bort. reveal_every csak kompatibilitási adat.
- Mentett kóstoló tetején állandó menetáttekintés és közvetlen kártyagombok,
  szerkesztésen kívül és újratöltve is látható szünetekkel, üzenetekkel.
- 0015: saját superadmin aal2 kóstolót törölhet a listából/részletekből,
  cím szerinti megerősítéssel. Fotók előbb Storage API-n át, majd DB kaszkád.
  Maradék fotónál véglegesítés tiltott, ismétlés biztonságos. Nincs SQL
  Storage-metaadattörlés. Futó kóstoló is törölhető.
- Mindhárom migráció (0014–0016) alkalmazva a helyi Supabase-en; ne írjuk át.
  A felhasználó kérte az elkészült változtatások commitolását.
  Alap 6554de5, a friss git log mutatja a rögzítés állapotát.

## Ellenőrzés

- Új teljes menet: npm run check 304/304, típus/lint/build sikeres.
- Létrehozó és fotó-E2E mobilon/asztalon 20/20; üres kijelölés tiltása,
  többboros kijelölés, hálózati hiba és azonos kéréses újrapróba ellenőrizve.
  Renderelt új űrlap átnézve: test-results/create-full-schedule/.
- Valódi helyi node scripts/test-create-schedule-local.mjs sikeres:
  kezdő szünet, bor és felfedés; párhuzamos ismétlés; hibás menet visszagörgetése.
- Korábbi kártyás eredmény/szerkesztő/demo E2E 28/28. Admin törlés/gyorsgomb
  E2E 22/24 + a két terhelési időtúllépés külön ismételve 2/2 sikeres.
- test:schedule:local, test:results:local, test:delete:local sikeres:
  valódi Auth/Realtime, szerverpontok és privát Storage. Saját próbaadatok törölve.
- Helyi Storage-korlát: szándékosan tiltott felfedettfotó-felülírás után
  ugyanazon objektum törlése timeoutolt. A pozitív törlési próba külön
  test:delete:local; a negatív fotózárolási próba a test:photos:local-ban maradt.
  A normál felület zárolt képre nem küld felülírást; hibánál nincs végleges törlés.

## Következő lépés

Fizikai pilot admin + két telefon + kivetítő: új kóstoló már szünet/felfedés
kártyákkal; tippek, egy- és többboros bemutató, újratöltés és befejezés.
Távoli deploy és fizikai eszközteszt nem volt. Az 5173-as fejlesztői szerver
megmaradt; a régi worktree-ket nem kell ismét beolvasztani.
