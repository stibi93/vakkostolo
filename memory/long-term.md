# Tartós projektmemória

## Felhasználói igények — 2026-09-23

- Vakon kóstolt borok telefonos értékelése: ár, alkohol, tetszési index.
- QR-os vendégbelépés, váró, opcionális Google-fiók.
- A host indítja a játékot, időzíti és lépteti a borokat.
- A host szabályozza a felfedés gyakoriságát; boronkénti és összesített eredmények.
- Letisztult, modern, eltérő telefonokon is használható felület.
- Kezdetben ingyenes működ/usageogadott és karbantartott mérnöki keretrendszerek használata.
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
- Nincs helyi demó. A kóstoló a Supabase-kapcsolaton fut. A hiányzó kiadási lépések a roadmapben.

Indokok: `docs/decisions/001-foundation.md`. Változáskor ezt a lapot javítsd,
ne tarts meg egymásnak ellentmondó döntéseket aktív szabályként.
