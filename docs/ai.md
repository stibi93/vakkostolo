# AI-fejlesztési alapok és memória

## Két külön feladat

A fejlesztői AI a kód és a projektterv elkészítését segíti. A termékben futó AI
opcionális későbbi funkció. A QR-belépés, időzítés, pontozás és eredmények nem
igényelnek modellt: hagyományos, tesztelhető alkalmazáskód végzi őket.

## Fejlesztői kontextus

Az `AGENTS.md` rövid projektutasításokat és célzott dokumentumhivatkozásokat ad.
A `skills.md` indexből két tényleges `SKILL.md` érhető el: átadás és játéklogikai
invariánsok. A skill-creator útmutató alapján szűk munkafolyamatokra készültek,
nem egy minden feladatra kötelező, hosszú ellenőrzési listára.
A védett `.agents/` miatt jelenleg közvetlen hivatkozással használhatók;
írható checkoutban lehet őket `.agents/skills/` alatt felfedezhetővé tenni.

| Memória | Fájl | Tartalom / frissítés |
| --- | --- | --- |
| Rövid távú | `memory/short-term.md` | kész részek, következő lépés, ellenőrzések; érdemi munkamenet végén átírva |
| Hosszú távú | `memory/long-term.md` | tartós döntések és felhasználói igények; csak érdemi változáskor |
| Döntési napló | `docs/decisions/*.md` | nagyobb technikai döntés, alternatíva, indok |
| Mérföldkőnapló | `memory/sessions/*.md` | ritka átadási pillanatkép, nem teljes beszélgetés |

A sessionök közötti emlékezet itt fájlalapú: a következő agentnek el kell
olvasnia, az előzőnek frissítenie kell. Nem ígér automatikus, platformfüggetlen
visszaemlékezést. Egyelőre nem szükséges vektoradatbázis vagy agentkeretrendszer.
Utólagos kontextusrövidítéskor is a fájlok a visszatérési pontok.

Folytatási példa: „Olvasd el az AGENTS.md-t és a memory/short-term.md-t, majd
valósítsd meg a roadmap következő belépés/váró szeletét.” A teszteredményt
dátummal és a még nem tesztelt határral együtt mentsük.

## Opcionális termék-AI, 6–10 óra külön kerettel

Első használat: a már felfedett eredményekből magyar nyelvű, rövid kóstolózáró
összefoglaló. Nincs borfelismerés, pontozás vagy titkos adatok automatikus feldolgozása.
Az alap típusok a `src/ai/summary.ts` fájlban vannak; hálózati szolgáltató nincs bekötve.

Tervezett folyamat: host kérés → szerveroldali jogosultság → felfedett aggregátumok
→ név/UID nélküli bemenet → opcionális modell → ellenőrzött rövid szöveg.
Kulcs csak szerveren; alapbeállítás kikapcsolva. Játékonként egy gyorsítótárazott
összefoglaló, kemény költség- és tokenkorlát, időtúllépés és determinista tartalék.
Hiba esetén a normál eredményoldal ugyanúgy használható.

Elfogadás: 10–20 szintetikus teszteset; a szöveg nem talál ki bort vagy számot,
nem nevez meg játékost, nem változtat ponton, részleges felfedésnél elutasít.
A determinista összegzés az MVP után is használható modell nélkül.

Forrás: [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[skillek](https://learn.chatgpt.com/docs/build-skills).
