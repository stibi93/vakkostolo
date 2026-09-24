# Arculati átvezetés — 2026-09-24

Állapot: kész, a közös munkapéldányba integrálva. Ág: `feat/wine-design`.
Munkakönyvtár: `/tmp/vakkostolo-design-20260924`.

Hatókör: jóváhagyott bordó–törtfehér arculat, serif címek, mobilos kóstolólap.
Érintett fájlok: `src/styles.css`, `src/app/app.css`, `src/app/HomePage.tsx`,
`src/demo/DemoApp.tsx`, `src/demo/TastingArtwork.tsx`, `src/main.tsx`, `index.html`.
A demó működése, az Auth és a játéklétrehozás logikája nem része a munkának.

A közös munkapéldány jelenlegi módosításai a külön worktree-ben megőrizve.
Integrációkor csak az ebből készült saját diff alkalmazandó az aktuális fájlokra.
Ez munkamegosztási jegyzet, nem visszaigazolt fájlzár. Új játéklétrehozó felület
integrációjakor a közös tokeneket használd; a sárga arculat már elutasított.

## Átadás

A hét fájl saját változásai az induló munkapéldányhoz képzett patchből kerültek
be, `git apply --check` után. A branch a korábbi közös változások másolatát is
tartalmazza; ne cherry-pickeld vagy másold vissza egészében.

Közös tokenek: `--ink`, `--paper`, `--sheet`, `--accent`, `--accent-hover`,
`--accent-soft`, `--muted`, `--line`, `--control-border`, `--error`, `--serif`.
A régi sárga/plakátos tokenek helyett ezeket használd. A meglévő `.button-primary`,
`.button-secondary`, `.actions`, `.muted`, `.small-note` osztályok megmaradtak;
az alap input/select/gomb stílusok közösek. Új oldal saját elrendezése külön CSS-be
kerüljön. A régi fontcsomagok importjai kikerültek, függőségeikhez nem nyúltam.

Végső közös ellenőrzés: `npm run check` (58 teszt), teljes Playwright (22 próba),
360/768/1280 px kézi ellenőrzés, billentyűzetes értékelés és hibás bevitel.
Renderelt képek átnézve; példák a helyi `test-results/design/` könyvtárban.
Az új játéklétrehozó felület közben elkészült és integrálva lett. Az új arculattal
360/1280 px-en vizuálisan ellenőrizve; részletek: `memory/game-creation-handoff.md`.
A felhasználó kérésére a közös arculat és szövegezés is a `main` ágon kerül commitba.
