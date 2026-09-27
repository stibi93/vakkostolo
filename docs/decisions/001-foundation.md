# ADR 001 — statikus frontend és PostgreSQL-alapú játék

Dátum: 2026-09-23. Státusz: javasolt alapként implementálva, felhasználóval finomítható.

Kontextus: kis létszámú élő játék, telefonok, alacsony költség, egy fejlesztő.
Döntés: React/Vite + Supabase; a tranzakciós játéklogika PostgreSQL RPC-ben.
Következmény: nincs külön alkalmazásszerver, de jogosultságot és állapotátmenetet
SQL-ben is tesztelni kell. Ingyenes szolgáltatások rendelkezésre állása nem garantált.

Alternatíva: Next.js + saját API — több szerveroldali felületet ad, jelenleg nem
indokolja a privát játék SEO-igénye. Saját VPS + PostgreSQL/WebSocket — hordozható,
de több üzemeltetés. Firebase — lehetséges, de a relációs kör/válasz modell és a
tranzakciók PostgreSQL-ben közvetlenül kifejezhetők.

Fejlesztői memória Markdownban; nincs futásidejű LLM vagy agentkeretrendszer.
Nincs helyi demó: a kóstoló a Supabase-kapcsolaton fut.

A felhasználó külön kérte a praktikus, jelenleg elfogadott fejlesztői megoldásokat.
Ennek megfelelően a függőségek kiadott verziói és npm-lockfile rögzítik a buildet;
strict TypeScript, ESLint, Vitest, PostgreSQL-motort használó PGlite tesztek és
Playwright biztosítják az ellenőrizhetőséget. Nincs saját UI-keretrendszer,
egyedi websocketszerver vagy indokolatlan agentplatform. A tesztkörnyezet
nem azonos a valódi Supabase infrastruktúrával, ezért a pilot integrációs kapu.
