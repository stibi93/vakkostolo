# Kezdőlapi infotainment — kész, 2026-09-24

A három fotó érzékelési, emlékezeti és társas ismeretterjesztő szekció lett.
Saját komponens: src/ui/TastingInsights.tsx + tasting-insights.css.
A HomePage kizárólag a régi home-guide blokkot cseréli, a párhuzamos /join
főgomb megmaradt. Régi home-guide.css törölve; források/határok:
docs/tasting-insights.md. 3 eredeti kutatás, közvetlen linkek a lenyitható részekben.

Ellenőrzés: integrált check 210/210, típusok/lint/build, app E2E 14/14.
Mobil/asztali renderelt képek és nyitott részletek átnézve; billentyűzetes
nyitás/zárás, forráslink-fókusz, képhiba és túlcsordulás ellenőrizve.
Kimenet: test-results/tasting-insights/, saját 4265/4266 tesztek befejeződtek.

Az app.spec.ts eleji játékosbelépés-teszteket megőriztem. Az utolsó teszt
most a 3 kutatási részletet ellenőrzi; a mozgásteszt az utolsó summaryhoz görget,
a képhibateszt a fejléc játékmesteri linkjét használja. Ne másoljátok vissza
az előző teljes HomePage/app.spec.ts fájlt; a régi képes útmutató már nincs.
Auth, DB, belépési oldalak változatlanok e feladatban. Push/deploy nincs.
