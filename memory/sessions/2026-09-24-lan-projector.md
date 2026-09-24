# 2026-09-24 – Kivetítő váró és LAN-próba

## Kész
- `/present/:gameId` (`src/invites/ProjectorPage.tsx`): cím (`list_host_games`), QR, link,
  becenevek; `get_host_game`-et nem hív, boradat nem kerül a lapra. Tokent a host
  localStorage-ából olvassa, `storage` eseményre frissül. Link a meghívó panelen
  („Kivetítő nézet”, új lap).
- `npm run dev:lan` (`scripts/dev-lan.mjs`): Vite `0.0.0.0`, `VITE_SUPABASE_URL=/`
  (Vite-proxy a helyi Supabase felé), `VITE_PUBLIC_APP_URL=http://<LAN-IP>:<port>`.
  WSL NAT-nál a Windows Wi-Fi-címét PowerShellből kéri le, és kiírja a
  `scripts/wsl-lan-forward.ps1` rendszergazdai parancsot (portproxy a LAN-címen,
  nem 0.0.0.0-n, hogy a WSL localhost-továbbítás ne sérüljön; tűzfal csak Private).
- `readSupabaseConfig` relatív URL-t originnel old fel; HTTP privát IPv4-re csak
  `allowLanHttp` (DEV) mellett. `readPublicAppOrigin` a meghívó eredetéhez.

## Ellenőrzés
- `npm run check` zöld (141 teszt), teljes e2e 40/40.
- Valódi helyi Supabase-en proxyn át: host kóstolót hoz létre, kivetítő boradat nélkül,
  a link `192.168.1.73`-ra mutat, vendég a WSL IP-n át belép, kivetítőn megjelenik.

## Hiányzik
- A Windows portproxy rendszergazdai futtatása a felhasználónál; valódi telefonos próba.
- Host belépés csak `127.0.0.1`-ről (Google-lánc); másik eszközön futó kivetítőhöz
  prezentációtoken kellene (későbbi bővítés).
