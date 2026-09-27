---
name: game-invariants
description: Implement or review blind tasting round transitions, rating deadlines, score rules, and database access boundaries in this project.
---

# Játéklogika és hozzáférés

A `docs/product.md` írja le a játékszabályokat; a `docs/database.md` a
jogosultságokat. Az időt és a módosítható állapotot élesben PostgreSQL ellenőrzi.

Módosításkor az érintett határt teszteld: lejárt beküldés; ismételt beküldés;
másik játék vagy másik játékos adatai; felfedés előtti titkok; párhuzamos
körindítás.

A bor titkos adatai külön táblában maradjanak. Felfedéstől független publikus
DTO-ba ne kerüljenek. Az adatbázisfüggvény a hívó jogosultságát ellenőrizze,
rögzített search_path-t és célzott EXECUTE-jogot kapjon. Új írható API előtt
legyen világos, hogy mi akadályozza meg az állapotgép megkerülését.

A tetszési indexből ne számolj helyes/hibás választ. Ár egész HUF-ban, alkohol
0,1 százalékpontos lépésben. A hiányzó válasz ne legyen nulla tetszési érték.
Új pontozási képlet új verziót kapjon; futó játékban a verzió ne változzon.
