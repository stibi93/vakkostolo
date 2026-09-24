# Üzemeltetés és költség

## Ajánlott induló felállás

Statikus frontend Cloudflare Pages-en, Supabase Free EU-régióban, opcionális
saját domain. Ez személyes, kis forgalmú használatra akár havi 0 Ft szolgáltatási
költséggel indulhat, szolgáltatói aldomainnel. Ez lehetőség, nem korlátlan vagy
garantált díjmentesség. Nincs külön AI-előfizetésre vagy API-kulcsra szükség a játékhoz.

2026-09-23-án ellenőrzött keretek: a [Supabase Free](https://supabase.com/pricing)
500 MB adatbázist, 50 000 havi aktív felhasználót, 200 egyidejű Realtime-kapcsolatot
és havi 2 millió Realtime-üzenetet tartalmaz. Egy hét inaktivitás után szüneteltetés
lehet, automatikus adatbázismentés nincs az ingyenes csomagban.
A [Cloudflare Pages Free](https://developers.cloudflare.com/pages/platform/limits/)
havi 500 buildet enged. A kereteket élesítés előtt ismét ellenőrizni kell.

Későbbi költségek: saját domain éves díja, nagyobb DB/Realtime-forgalom,
megbízhatóság miatt fizetős adatbázis, mentéstárolás, opcionális e-mailküldés és
AI-hívások. A fejlesztői AI-eszköz előfizetése külön személyes fejlesztési költség.
A 30 fős cél nem kapacitásgarancia; hostlapok és kivetítő is kapcsolatot használnak.

## Konfiguráció

`.env.example` alapján hozz létre helyi `.env.local` fájlt. Csak a Supabase URL
és publishable key publikus; service-role/secret key soha nem kezdődhet `VITE_`-tal.
Jelenleg a demo konfiguráció nélkül fut, ezek a változók a következő integrációhoz kellenek.

Supabase: EU-régió, anonim bejelentkezés engedélyezése, Google OAuth a hostnak,
pontos callback allowlist, fejlesztői és éles környezet szétválasztása. A publikus
vendég-authhoz abuse-védelem és szükség esetén CAPTCHA; a meghívás rate limitjét
a DB/Edge Function rétegben kell megoldani. Ezek még nem működő részei az alapnak.

## Frontend telepítési recept

A helyi teljes backendhez `supabase/config.toml` is készült (PostgreSQL 17,
anonim Auth bekapcsolva). Telepített Supabase CLI és működő Docker mellett
`supabase start` indítja a helyi stacket; a tiszta helyi adatbázisra a migrációk
alkalmazandók. Ez a teljes konténeres környezet most nem került elindításra.
Ne futtass adatbázis-resetet mentendő adatokon. A konfiguráció nem állítja át
a távoli projektet. [CLI-konfiguráció](https://supabase.com/docs/guides/local-development/cli/config).

Praktikus hálózati részlet: egy közös Wi-Fi mögött minden vendég ugyanarról az
IP-ről érkezhet. A helyi anonim Auth limit 60 új vendég/IP/óra; az éles keretet
a várható létszámhoz, az újrapróbálkozásokhoz és az abuse-védelemhez kell igazítani.
A platform alapértéke jelenleg 30/IP/óra. A QR-belépés pilotjában ezt is teszteljük.
[Auth rate limit konfiguráció](https://supabase.com/docs/guides/local-development/cli/config#authrate_limitanonymous_users).

1. Írható Git checkoutban inicializáld a repositoryt és töltsd fel a választott távoli tárhelyre.
2. Pages-projekt: build `npm run build`, output `dist`, Node 22.22+.
3. Környezeti változók csak az éles backend-integráció elkészülte után szükségesek.
4. A `public/_redirects` biztosítja a későbbi kliensoldali útvonalak SPA-fallbackjét.
5. HTTPS-címről teszteld a kamerával olvasható belépési URL-t, majd két külön eszközzel a játékot.

Ez recept, a projektből most nem történt publikálás. A jelenlegi build demót telepítene.
CI: `.github/workflows/ci.yml`; lint + típus + tesztek + build minden PR/push esetén.
A CI nem deployol, és nem futtat migrációt az éles adatbázison.
Dependabot-konfiguráció heti npm és GitHub Actions frissítési javaslatokat készít
a GitHub repositoryban. A verziók emelése után a CI kapu marad az ellenőrzés.

## Esemény előtti és utáni teendők

Előtte: Supabase aktív állapotának ellenőrzése és szükség esetén visszaállítása
legalább egy nappal korábban; quota, Wi-Fi/mobilnet, host-login és próbaválasz.
Ne tartsd mesterséges pingeléssel aktívan az ingyenes projektet.

Utána: szükséges eredmények exportja, mentés külön helyre, játékosadatok törlése
a választott megőrzési rend szerint. Kezdeti termékjavaslat: 90 nap eseményadat,
majd törlés/anonimizálás; ez nem automatikusan bekapcsolt vagy jogi követelmény.
Az adatkezelési tájékoztatót és a konkrét törlési folyamatot élesítés előtt elkészítjük.
Vendégekhez becenév és technikai Auth UID elég; a Google e-mail ne kerüljön játékoslistába.

Mentés: Free csomagban saját adatbázisexport és időszakos restore-próba szükséges.
A migráció csak sémát állít vissza, az elveszett válaszokat nem. Helyi demo semmit
nem ment, frissítéskor újraindul — ezt a felület jelzi.
