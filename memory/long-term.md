# Tartós projektmemória

## Felhasználói igények — 2026-09-23

- Vakon kóstolt borok telefonos értékelése: ár, alkohol, tetszési index.
- QR-os vendégbelépés, váró, opcionális Google-fiók.
- A host indítja a játékot, időzíti és lépteti a borokat.
- A host szabályozza a felfedés gyakoriságát; boronkénti és összesített eredmények.
- Letisztult, modern, eltérő telefonokon is használható felület.
- Kezdetben ingyenes működésre törekvés, projektinfrastruktúra és AI-memória kérése.
- Praktikus, korszerű, elfogadott és karbantartott mérnöki keretrendszerek használata.
- A vizuális arculat legyen karakteres, kreatív; a korábbi pasztell, kártyás
  megjelenést a felhasználó AI-generált hatásúnak találta. Az új borklub-plakátos
  irány egyelőre munkaverzió, nem kifejezetten jóváhagyott felhasználói színpreferencia.

## Tervezési döntések — 2026-09-23

- React/TypeScript/Vite + Supabase, statikus hosting: kevesebb üzemeltetés.
- Magyar UI, HUF; 2–30 fő / 1–12 bor induló feltételezés, nem felhasználói korlát.
- Vendég = anonim Auth-felhasználó. A host tartós bejelentkezést kap.
- Valós boradat külön titkos táblában, felfedéshez külön pillanatkép.
- Szerveridő és sorzár védi a beküldést; egy játékos/kör egy válasz.
- Pontozás v1: 50 ár + 50 alkohol; tetszés nem versenypont. Javasolt szabály.
- AI a fejlesztéshez fájlalapú emlékezettel; termék-AI opcionális, kikapcsolva.
- A kész alap demo, nem éles többjátékos alkalmazás. A hiányzó funkciók a roadmapben.

Indokok: `docs/decisions/001-foundation.md`. Változáskor ezt a lapot javítsd,
ne tarts meg egymásnak ellentmondó döntéseket aktív szabályként.

## Fejlesztési munkamenet — 2026-09-24

- Felhasználói kérés: Git és logikus fejlesztési egységek, elsőként scaffolding.
  A meglévő projektalap külön induló commitban megőrizve; minden további
  egység konkrét viselkedést, ellenőrzést és dokumentációt fogjon össze.
- A kezdőlap és a helyi demo külön útvonal (`/`, `/demo`). A demo csak
  megnyitáskor töltődik be, így az alkalmazásbelépési pont külön bővíthető
  Auth és valódi játék felé. A külön csomag nem jogosultsági határ.
- Helyi repository `main` ágon; távoli szolgáltató még nincs beállítva.

## Host Auth — 2026-09-24

- React Router kezeli az alkalmazásútvonalakat, a Supabase SDK PKCE-folyamattal
  a Google-belépést. Indok: központi útvonalak a következő játékfunkciókhoz,
  bevett Auth-kliens saját tokenkezelés helyett.
- A callback explicit, egyszeri kódbeváltás; a cél a saját `/host`, nincs szabad
  átirányítás. A felület szerverrel ellenőrzött usert használ, az anonimitást
  megkülönbözteti. A játékjogosultság továbbra is DB/RPC-felelősség.
- A host Auth klienskódja kész; a valódi Google/Supabase integráció külön kapu.
  A tesztek szintetikus Auth HTTP-válaszokat használnak, nem külső fiókot.
