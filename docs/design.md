# Arculat — Vakkóstoló

A 2026-09-24-én elfogadott irány a **számozott, letakart borcímke**.
A termék neve minden felületen **Vakkóstoló**. A sárga és a későbbi, túl
jellegtelennek ítélt Halves-adaptáció helyét ez az arculat veszi át.

## Vizuális elvek

Az inspiráció a [Siteinspire Winery & Vineyard válogatása](https://www.siteinspire.com/websites/category/winery-vineyard),
különösen a Brau, Black Estate, Low Intervention és Dix Hectares szerkesztése.
A [jóváhagyott tanulmány](design-proposals/numbered-label/index.html) és annak
[indoklása](design-proposals/numbered-label/README.md) megőrzi a referenciákat.
Saját címkemotívumot használunk, nem más borászat arculatát másoljuk.

- Törtfehér papír `#F4F1ED`, világos felület `#FFFDFB`, tintaszöveg `#30202E`.
- Borvörös főművelet és címke `#61263F`, halványkék ellenpont `#D9E6EB`.
- Másodlagos szöveg `#675A62`; a mező, hiba és fókusz külön tokeneket kap.
- Bricolage Grotesque címek, márkanév és számok; Arial a feliratokhoz és mezőkhöz.
  Georgia kurzív csak néhány hangsúlynál, Georgia a felfedett borok neveinél.
- Nagy tételszám, világos takarócsík, erős elválasztók, alig lekerekített felületek.
  Az értékelőlapon a bevitel az elsődleges, a dekoratív nyitóblokk rejtett.
- Felfedésig az absztrakt címke minden bornál azonos színt és motívumot használ.
  A kép, címke vagy palackszín nem utalhat a rejtett borra.

A személyes `frontend-design` skill `references/wine-tasting.md` profilja
ugyanezt az irányt rögzíti; más projektekre nem írja elő ezeket a színeket.

## Kezdőlapi ismeretterjesztés

A három fotó a vakkóstolás érzékelési és társas oldalát mutatja be:
benyomások megfogalmazása és emlékezet, előzetes információ hatása, önálló
vélemény és közös beszélgetés. Rövid magyarázat, kipróbálható ötlet és natív,
billentyűzettel nyitható kutatási részletek tartoznak hozzájuk, eredeti forráslinkkel.
A korábbi szervezési útmutatót váltja fel, nem új belépési vagy játékmenet.
Források és állítási korlátok: [tasting-insights.md](tasting-insights.md).
Mobilon a képes részek teljes szélességűek. A fejlécben nincs külön
VAKBORKÓSTOLÓ felirat, a lábléc nem ismétli a márkanevet.

## Megvalósítás

A közös tokenek a `src/styles.css`-ben, a kezdőlap és belépés stílusai a
`src/app/app.css`-ben vannak. A címkegrafika, fotókeret és háttérmozgás a
`src/ui/` közös komponenseiben és `visuals.css` fájljában található.
A Bricolage latin és latin-ext WOFF2 fájljai helyben, a `src/ui/fonts/`
könyvtárból töltődnek, OFL licencükkel együtt. Külső fontszolgáltató nem kell.

Az arculat a kezdőlapon, a demó három nézetében, a belépésnél, a kóstoló
létrehozásánál és mentett adatainál, valamint a meghívó és kivetítő oldalain
jelenik meg. A játékszabály, Auth és adatbázis működése ettől nem változik.

## Képek és mozgás

Három kitalált bor AI-val készített mintafotója a `public/demo/` könyvtárban
van. Eredetük és promptjaik: `public/demo/IMAGE-SOURCES.md`.
A demó játékmesteri „Mintaborok képei” részében a kép cserélhető, törölhető,
és a minta visszaállítható. JPEG, PNG és WebP választható, legfeljebb 8 MB
és 40 megapixel méretig. Hibás kép esetén az előző marad meg. A kép arányait
megőrizzük, a teljes palack látszik; betöltési, hiányzó és hibaállapot is van.

Ez **helyi demófunkció**: nincs feltöltés és tartós mentés, frissítéskor a
saját képek elvesznek. Fotó csak a nyitott játékmesteri képszerkesztőben és a
felfedett eredménynél kerül a DOM-ba. A publikus, kitalált minták nem jelentenek
éles adatvédelmi megoldást. Online borfotóhoz privát tárolás és szerveroldali,
felfedéshez kötött hozzáférés szükséges; ez külön fejlesztési egység.

A kezdőlap saját, közvetlenül SVG-ben rajzolt szüreti csendéletet használ:
szőlőfürt és levelek, számozott/letakart címkéjű palack, pohár és dűlősorok.
Forrás: `src/ui/HarvestArtwork.tsx`, stílus: `src/ui/harvest.css`. Nincs külső
illusztráció vagy képszolgáltatás; ez dekoráció, nem egy játékbeli bor képe.
A demó kis címkegrafikája megmarad, a csendélet csak a kezdőlapon látható.

Az illusztráció két rétege mozog: a szőlőág 7,5 másodperces félciklussal leng,
mögötte a világos kör 16 másodperces félciklussal eltolódik.
Kizárólag CSS `transform` animáció, JavaScript képkockahurok, videó, blur és
új függőség nélkül. A szöveg, palack és pohár stabil. A megállító gomb a
jelenlegi fázisban szüneteltet; újraindításkor onnan folytatja. Képernyőn kívül
IntersectionObserver, háttérlapon Page Visibility állítja le a mozgást.
A rendszer csökkentett mozgás beállítását induláskor és változáskor is követjük.
A teljes kezdőlap mögött további két, halvány szőlőlevél-árnyékréteg mozog
12 és 15 másodperces félciklussal. Két saját SVG-vonalrajz szélfuvallatot
jelez: 9 és 11 másodpercenként elúszik és elhalványul, eltolt indulással.
Ezek csak `transform` és `opacity` tulajdonságot animálnak; legfeljebb hat
réteg mozog egyszerre, a szövegek végig stabilak.
A `HomeAtmosphere` csak ezen az útvonalon él, a `useAmbientMotion` közös
állapota kezeli a rajzot és a hátteret. A fejléc közös kapcsolójával minden mozgás
megállítható; rejtett böngészőlapon és reduced-motion esetén mind leáll.
A fix hátteret görgetés közben is látni; a rajz továbbra is külön szünetel,
ha kikerül a képernyőről. A háttér nincs interakcióban a tartalommal, nem kap
fókuszt, és nem olvassa fel a képernyőolvasó.

A kezdőlap háromképes galériája saját számozott címkékkel és pohárpecséttel
kapcsolódik az arculathoz. AI-val készült hangulatképek:
`public/images/harvest-grapes.jpg` (222 KiB), `vineyard-rows.jpg` (295 KiB)
és `blind-tasting-table.jpg` (181 KiB). Progresszív JPEG-ek; az eredeti PNG
kompozícióját és felbontását megtartják. A galéria képei késleltetve töltődnek,
előre lefoglalt képaránnyal. Betöltési hibánál azonos méretű, pecsétes helyőrző
marad. Források és végleges promptok: `public/images/IMAGE-SOURCES.md` és
`public/images/GALLERY-SOURCES.md`. Nem konkrét borászat vagy a kóstoló titkos
borának fényképei.

A játékmesterek tájékoztatója külön, publikus `/jatekmester` aloldalon érhető
el a kezdőlap fejlécéből. Itt szerepel az online működés készültsége, a belépés
és a szervezés három lépése, kóstolóasztal-fotóval. A tényleges játékmesteri
felület útvonala továbbra is `/host`.

A kezdőlap főművelete „Csatlakozás a játékhoz”, célja a `/join` belépési oldal.
Az oldal a közös űrlaparculattal fogadja a meghívólinket, majd a meglévő
meghívó-ellenőrzéshez és beceneves váróbelépéshez vezet. Nincs háttéranimáció
az adatbevitel mögött. Hibás linknél a mező fókuszt és kapcsolt hibaüzenetet kap;
online konfiguráció nélkül a felület egyértelműen jelzi a belépés hiányát.
A kezdőlapi képes útmutató harmadik eleme is a valódi játékhoz csatlakozást
magyarázza, nem a demót. A demó útvonala megmarad külön fejlesztői próbához.

Kóstolás és adatbevitel közben nincs háttéranimáció.

## Szöveg és ellenőrzés

Természetes, tárgyilagos magyar szövegek, tegezéssel. A cím a funkciót vagy
állapotot nevezi meg, a gomb a műveletet, a súgó a következő lépést.
Nincsenek erőltetett szlogenek és boros szóviccek. A demó, online előkészítés,
határidő és visszaigazolt beküldés jelentése maradjon pontos.

360, 768 és 1440 px szélességen a ténylegesen renderelt nézeteket ellenőrizzük.
Legalább 44 px érintési cél, olvasható mező, látható fókusz és túlcsordulás
nélküli tördelés kell. A sikeres build önmagában nem vizuális ellenőrzés.
