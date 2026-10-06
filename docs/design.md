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
- Bricolage Grotesque címek, márkanév és számok; Instrument Sans a szöveghez,
  feliratokhoz és mezőkhöz. Fraunces (kurzív is) a hangsúlyokhoz és a felfedett
  borok neveihez.
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

Az arculat a kezdőlapon, a belépésnél, a kóstoló létrehozásánál és mentett
adatainál, valamint a meghívó és kivetítő oldalain jelenik meg. A játékszabály,
Auth és adatbázis működése ettől nem változik.

## 2026-os frissítés

- **Pincetéma.** Minden szín `light-dark()` token a `:root`-on; az oldal a
  rendszer sötét módját követi. Sötétben a főszín rozé (`#e3a2bb`), rajta sötét
  szöveg (`--on-accent`). A `.theme-cellar` mindig sötét: ezt kapja a kivetítő.
- **Mozgás.** Közös görbék (`--ease-out`, `--ease-spring`), `stage-in` belépés,
  oldalváltás View Transitions API-val (`<Link viewTransition>`), gombnyomásnál
  enyhe összehúzódás. Csökkentett mozgásnál minden azonnal a végállapotban áll.
- **Telefonos játék.** Kompakt fejléc ikonos mozgáskapcsolóval, széltől szélig
  játéklap, ragadós körfejléc fogyó időcsíkkal (csak kijelzés, a határidőt a
  szerver dönti el), ragadós beküldőgomb, animált mentési visszaigazolás.
- **Felfedés.** A tételszámos takarócsík lehámlik a fotóról, a bornév felemelkedik,
  a számok felpörögnek (`CountUp`). A borlapok lapozhatók és húzhatók. A dobogó
  a tényleges helyezési szinteket mutatja, lépcsőnként legfeljebb három névvel.
- **Kivetítő.** Tévés színpad: sötét, nagy betű, a vezérlés vékony felső sávban.
  Egy felfedett bor fotóval, névvel és adatokkal 1280×720-ba fér görgetés nélkül.
- **Host irányítópult.** 1100 px felett két oszlop: balra az élő kör, vezérlés,
  résztvevők és menet, jobbra a meghívó, a borok és a fotók. Futó körben a
  lezárás az elsődleges gomb; ritka műveletek halk szöveges gombot kapnak.
- Nem használunk üveghatást, színátmenetes hőst vagy erős lekerekítést: a
  frissítés a számozott címke irányát élesíti, nem cseréli le.

## Képek és mozgás

A borfotót a játékmester tölti fel. JPEG, PNG és WebP választható, legfeljebb
8 MB és 40 megapixel méretig. Hibás kép esetén az előző marad meg. A kép
arányait megőrizzük, a teljes palack látszik; betöltési, hiányzó és hibaállapot
is van. A fotó privát tárolóban van, és csak felfedés után kerül a játékos elé.

A kezdőlap saját, közvetlenül SVG-ben rajzolt szüreti csendéletet használ:
szőlőfürt és levelek, számozott/letakart címkéjű palack, pohár és dűlősorok.
Forrás: `src/ui/HarvestArtwork.tsx`, stílus: `src/ui/harvest.css`. Nincs külső
illusztráció vagy képszolgáltatás; ez dekoráció, nem egy játékbeli bor képe.
A csendélet csak a kezdőlapon látható.

Az illusztráció három rétege mozog: a többszínű szőlőág 4,8 másodperces
félciklussal, −6 és +7 fok között leng; mögötte a rétegzett színfoltok
16 másodperces, a levéllel kísért szélvonalak 8 másodperces félciklussal mozdulnak.
Kizárólag CSS `transform` és `opacity` animáció, JavaScript képkockahurok, videó, blur és
új függőség nélkül. A szöveg és a palack stabil. A pohár szára a csukló tengelye: a kehely ebből a pontból ír kört, oldalra dől, majd a kör túlsó felén közelebb vagy távolabb látszik, és a mozdulat végén visszaáll. A megállító gomb a
jelenlegi fázisban szüneteltet; újraindításkor onnan folytatja. Képernyőn kívül
IntersectionObserver, háttérlapon Page Visibility állítja le a mozgást.
A rendszer csökkentett mozgás beállítását induláskor és változáskor is követjük.
A teljes kezdőlap mögött további két, halvány szőlőlevél-árnyékréteg mozog
12 és 15 másodperces félciklussal. Két saját SVG-vonalrajz szélfuvallatot
jelez: 9 és 11 másodpercenként elúszik és elhalványul, eltolt indulással.
Színes pohártalp-karikák és sodródó levélrészletek egészítik ki őket.
Ezek csak `transform` és `opacity` tulajdonságot animálnak; összesen hat
háttérréteg, a kezdőlapi rajzzal legfeljebb kilenc réteg mozog egyszerre.
A bordó mellett zsályazöld, szilva, tompa kék és agyagrózsaszín jelenik meg;
a szövegek végig stabilak, a színek nem függnek játékadatoktól.
A `HomeAtmosphere` az App szintjén, minden útvonal mögött egyetlen példányban él.
Az AppMotionContext közös állapota kezeli a rajzot és a hátteret; navigáláskor
a szüneteltetés megmarad. A fejléc közös kapcsolójával a dekoratív mozgás
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
meghívó-ellenőrzéshez és beceneves váróbelépéshez vezet. Hibás linknél a mező fókuszt és kapcsolt hibaüzenetet kap;
online konfiguráció nélkül a felület egyértelműen jelzi a belépés hiányát.
A kezdőlapi képes útmutató harmadik eleme is a játékhoz csatlakozást magyarázza.

Felhasználói kérésre minden oldalon fut a közös háttér: a belépésnél, hostnál,
játékosnál aktív körben is, kivetítőn, betöltéskor és a 404 oldalon.
A mezők, QR-kódok és tartalmi panelek stabilak maradnak. Ez felülírja a korábbi,
csak kezdőlapra és váróra korlátozott mozgási szabályt.

A közös háttérben a levélárnyékok 11–13% fedettségűek,
a szélvonalak legfeljebb 32%-ig erősödnek. A rétegek a képernyő közepére is
benyúlnak; a váró panelje 72%, a kivetítő résztvevőpanelje 78% papírfedettségű.
A QR és az értékelőfelület továbbra is átlátszatlan. A közös hat háttérréteg
mozog, új rajzolási ciklus vagy animációs függőség nélkül.

Az „Élő kapcsolat” zöld pontja két másodperces opacity/transform pulzust kap,
ha van betöltött, friss snapshot és élő Realtime-kapcsolat. Sikertelen frissítés,
offline állapot, betöltés vagy kapcsolatvesztés esetén nem pulzál; reduced-motion
és háttérbe tett böngészőlap esetén statikus. A pulzus a kapcsolat állapotát jelzi,
nem egyes szerverüzenetek érkezését.

## Szöveg és ellenőrzés

Természetes, tárgyilagos magyar szövegek, tegezéssel. A cím a funkciót vagy
állapotot nevezi meg, a gomb a műveletet, a súgó a következő lépést.
Nincsenek erőltetett szlogenek és boros szóviccek. Az online előkészítés,
a határidő és a visszaigazolt beküldés jelentése maradjon pontos.

360, 768 és 1440 px szélességen a ténylegesen renderelt nézeteket ellenőrizzük.
Legalább 44 px érintési cél, olvasható mező, látható fókusz és túlcsordulás
nélküli tördelés kell. A sikeres build önmagában nem vizuális ellenőrzés.
