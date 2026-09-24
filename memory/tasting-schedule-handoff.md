# Szerkeszthető kóstolómenet – kész, 2026-09-24

Ez a munkamenet a közös fő munkafában dolgozik. A borfotó-agent 0010 számát
szabadon hagytam: új migrációm `202609240011_tasting_schedule.sql`.
Új `src/schedule/*`, módosul `src/live/*`, a HostWorkspace-ba csak a
ScheduleEditor import/bekötés és háttérben frissíthető részletek kerülnek.
A fotókezeléshez nem nyúlok. A `get_host_game` RPC változatlan marad;
boroknál a még pending kör ID megmarad átrendezéskor és szerkesztéskor,
csak a kivett pending bor round sora törlődik kaszkáddal.
A snapshot privát korábbi projekciót használ, ezt csak az aktuális szünettel
és már felfedett boradatokkal bővíti. Jövőbeli képmezőt nem projektál.
A DB-típusfájlt mindkét migráció integrációja után újra kell generálni.

A 0011 migráció már alkalmazva a helyi Supabase-en. A külön worktree 0010
fotómigrációját későbbi integrációkor `supabase migration up --local --include-all`
útján kell beilleszteni; az alkalmazott 0011-et ne írd át.

Ellenőrzés: check 257/257, érintett E2E 28/28 + végső órapróba 2/2;
helyi valódi Supabase versengési és Realtime próba sikeres. Részletek a
short-term.md legújabb bejegyzésében. Commit/deploy nincs.
