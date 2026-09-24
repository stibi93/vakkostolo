# Vakkóstoló — számozott címke

2026-09-24. A felhasználó által elfogadott arculati irány; jelenleg külön interaktív tanulmány.
A felhasználó az elkészült Halves-adaptációt túl jellegtelennek találta, és a
Siteinspire borászati válogatása alapján karakteresebb megoldást kért.

Megnyitás: [interaktív tanulmány](index.html). Önálló HTML, helyi betűkkel;
közvetlenül böngészőben is működik. Kezdőlap, kitölthető kóstolólap, fotós felfedés és borfotószerkesztő.
A fejléc nézetváltója és a tanulmányjelölés a prezentáció része, nem az éles
játékos navigációjának terve. Az idő csak jelölt példa, nem működő visszaszámláló.
Nincs adatküldés, tartós mentés vagy pontozási implementáció.

## Mi hiányzik a jelenlegi változatból?

- A közel azonos tónusú, finoman keretezett felületeknek nincs erős súlypontjuk.
- A Georgia + Arial páros és a sorozatos vékony elválasztók önmagukban kevés
  megkülönböztető jegyet adnak. A név nélkül a lap sok más terméké is lehetne.
- A kezdőlap dekorációja és a játék állapotai között nincs végigvitt vizuális kapcsolat.
- A mobilos rend és a tárgyilagos szövegek értékesek; az új karakter ezeken alapul.

## Megnézett referenciák

A Siteinspire archivált képernyőképeit vizsgáltam, nem a példák mindenkori élő
állapotát. A megfigyelések saját vizuális értékelések.

| Referencia | Megfigyelés | Vakkóstoló-adaptáció |
| --- | --- | --- |
| [Domaine de Brau](https://www.siteinspire.com/website/11901-domaine-de-brau) | Nagy, súlyos márkatipográfia, határozott szerkesztési tengely, közvetlen hangulat. | Karakteres groteszk márka és címsor; erős tételszám; aszimmetrikus kezdőlap. |
| [Black Estate](https://www.siteinspire.com/website/94-black-estate) | Szokatlan oszloparányok, szövegből és szabad térből felépített karakter. | Tudatos arányok, egy erős fókusz, információs sorok egymásba ágyazott kártyák helyett. |
| [Low Intervention](https://www.siteinspire.com/website/9102-low-intervention) | Világoskék színmező és váratlan, torzított tárgyi kép. | A színpárosítás bátorsága: borvörös és hűvös halványkék. Saját, olvasható címkegrafika. |
| [Dix Hectares](https://www.siteinspire.com/website/13517-dix-hectares) | Nagy léptékű tipográfia, erős atmoszféra egy domináns képfelületen. | A nyitólap egyetlen emlékezetes gesztusa. A munkaoldalakon kisebb lépték. |

A hivatkozott márkákat, képeket és grafikákat nem használjuk termékassetként.
A borászat tája és palackjai itt félrevezetőek lehetnének: a Vakkóstoló többféle
bort kezel, a rejtett tétel színe vagy fajtája nem következtethető ki a grafikából.

## A saját ötlet: letakart borcímke

Egy nagyméretű tételszám, borvörös címkefelület és a név helyét takaró világos
sáv adja a felismerhető motívumot. Ez a valódi vakkóstolási gyakorlatból ered.
A felfedéskor a sáv helyén a bor neve jelenik meg, a tételszám változatlan marad.
A márkajel a címkét átmetsző sáv egyszerűsítése.

A motívum szerepe képernyőnként:

- **Kezdőlap:** nagy, enyhén elfordított címke, erős cím és egy elsődleges művelet.
- **Meghívó/váró:** eseménynév, játékkód, résztvevők. A címke a kódot keretezheti;
  a QR nagy kontrasztú és ép marad, nem forgatjuk vagy takarjuk.
- **Kóstolólap:** kompakt, egyenes tételfejléc, jól olvasható hátralévő idő;
  két becslés, tetszés és mentés. Az illusztráció helyét átveszi a feladat.
- **Felfedés:** ugyanazon azonosító mellett megjelenik a név; a saját becslés és
  a valódi adat egymás mellett. A tetszés elkülönül a versenyponttól.
- **Játékmester:** erős oldalcím, áttekinthető tételsorok és jól elkülönített
  műveletek. A sűrű boradat-űrlapon a díszítés visszafogott.

## Paletta és betűk

| Szerep | Érték |
| --- | --- |
| Alap, papírfelület | `#F4F1ED` |
| Főszöveg, erős keret | `#30202E` |
| Márkaszín és elsődleges művelet | `#61263F` |
| Másodlagos nagy színmező, felfedett címke | `#D9E6EB` |
| Beviteli felület | `#FFFDFB` |
| Másodlagos szöveg | `#675A62` |

Bricolage Grotesque 600–700 a márkához, címhez és tételszámhoz; Arial a folyamatos
szöveghez és vezérlőkhöz. Georgia italic legfeljebb egy rövid kiemeléshez, illetve
a felfedett bor nevéhez. A groteszk már telepített projektfüggőség; a tanulmány
helyi Latin és Latin Extended WOFF2 készletet használ, licenccel. A magyar hosszú
ékezetek tényleges megjelenését is ellenőriztem.

A halványkék a keretező színmezőké; a működő űrlap világos. A hibához külön
szemantikus szín, szöveges üzenet és fókusz szükséges az alkalmazásban.

## Interakció és átvezetés

Felfedéshez rövid, kb. 200–350 ms-os átmenet illik; az adat csak a szerver által
engedélyezett állapotban kerülhet a klienshez. Nem tárolunk titkos bort egy
vizuális takarás alatt. Csökkentett mozgásnál az átmenet kimarad. A kezdőlap lassú, megállítható
fénykarika-animációt kapott; az értékelés képernyőjén nincs háttérmozgás.

Javasolt megvalósítási sorrend:

1. A személyes skill projektprofilja már az elfogadott irányt rögzíti.
   Az alkalmazás közös tokenjeinek és komponenseinek átvezetése következik.
2. Új márkafejléc és megosztott `RoundLabel` komponens rejtett/felfedett állapottal,
   biztonságos publikus DTO alapján; a fejléckomponens nem kér le titkos adatot.
3. Egy teljes játékosfolyamat átvezetése: váró → értékelés → mentés → felfedés.
   Az összes állapotban látszódjon, melyik tételről van szó.
4. Kezdőlap és játékmesteri oldalak; végül közös mobilos és billentyűzetes ellenőrzés.

A mostani feladat csak kutatás és javaslat: új `docs/design-proposals/numbered-label/`
könyvtárban dolgoztam. Alkalmazáskódot és a párhuzamos meghívófejlesztést nem
módosítottam. Későbbi implementációhoz külön worktree és saját diff szükséges.

## Ellenőrzés

A tanulmány mindhárom nézete 360, 768 és 1440 px-en renderelve; nincs vízszintes
túlcsordulás. Ár/alkohol kitöltés, csúszka billentyűzettel, Tab/Enter mentés és
az értékek átvezetése a felfedésbe sikeres. Asztali és mobilos képek átnézve.
Ez a prototípus ellenőrzése, nem az alkalmazás új regressziós vizsgálata.

[Kezdőlap](home-1440.png) · [Mobilos kezdőlap](home-360.png) ·
[Kóstolólap](tasting-360.png) · [Felfedés](reveal-360.png)


## Borfotók és háttérmozgás — 2026-09-24

- Három külön, beépített `image_gen` hívással készült, kitalált bort ábrázoló
  fotó: Furmint, Kékfrankos, Rosé. Az eredeti PNG-k az `assets/` mappában vannak;
  a pontos promptok és eredet: [IMAGE-SOURCES.md](assets/IMAGE-SOURCES.md).
- Borfotók nézet: boronként saját JPEG/PNG/WebP fájl, előnézet, törlés,
  mintakép-visszaállítás. 8 MB / 40 megapixel korlát, típus- és dekódolási hiba
  kezelése, a meglévő kép megőrzésével. Kiválasztás közbeni csere/törlés nem
  engedi a késői dekódolásnak visszaállítani a már lecserélt képet.
- Felfedéskor három bor között lehet váltani. Az elsőhöz a mintalap tippje
  kapcsolódik, a másik kettőnél nincs kitalált játékosválasz.
- A kezdőlapon és az értékelésnél nincs felszerelt fotóelem `src` attribútummal;
  a fotók csak a szerkesztőben és felfedéskor töltődnek be. Ez helyi minta:
  a boradatok a prototípus JS-ében vannak, valódi jogosultságot nem modellez.
- A kép nem kerül szerverre, frissítés után a mintaképek térnek vissza. Éles
  képfeltöltéshez később privát tárhely, hostjogosultság, szerveres fájlellenőrzés
  és csak felfedéskor kiadott kép-hozzáférés kell. Ez nincs még implementálva.
- CSS-alapú, pohártalp-fénykarikát idéző háttérmozgás csak a kezdőlapon.
  Megállítható, csökkentett mozgásnál automatikusan statikus, nincs hálózati asset.
- A négy nézet 360/768/1440 px-en ellenőrizve: képcsere, törlés, visszaállítás,
  hibás típus/méret/dekódolás, billentyűzetes mentés és reduced-motion sikeres.
  A prototípus JS külön lintje és szintaxisellenőrzése sikeres; az appkód nem változott.

[Borfotók asztalon](photos-1440.png) · [Borfotók mobilon](photos-360.png) ·
[Fotós felfedés](reveal-360.png)
