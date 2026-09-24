#!/usr/bin/env node
// Starts Vite for same-network testing: invite links use the machine's LAN address and the
// browser talks to the local Supabase through the Vite proxy, so only the app port must be reachable.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? 5173);
const privateIpv4 = /^(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}$/;
const isWsl = (() => {
  try { return /microsoft/i.test(readFileSync('/proc/version', 'utf8')); } catch { return false; }
})();

function run(command, args) {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 }).trim(); }
  catch { return ''; }
}

function windowsLanAddress() {
  const output = run('powershell.exe', ['-NoProfile', '-Command',
    'Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } | ' +
    'ForEach-Object { $_.IPv4Address.IPAddress }']);
  return output.split(/\s+/).find((address) => privateIpv4.test(address));
}

function localLanAddress() {
  return Object.values(networkInterfaces()).flat()
    .find((entry) => entry && entry.family === 'IPv4' && !entry.internal && privateIpv4.test(entry.address))?.address;
}

const wslMode = isWsl ? run('wslinfo', ['--networking-mode']) || 'nat' : null;
const lanHost = process.env.LAN_HOST?.trim() || (isWsl && wslMode !== 'mirrored' ? windowsLanAddress() : localLanAddress());
if (!lanHost) {
  console.error('Nem található helyi hálózati IPv4-cím. Add meg kézzel: LAN_HOST=192.168.x.y npm run dev:lan');
  process.exit(1);
}
const publicUrl = `http://${lanHost}:${port}`;

console.log(`\nVakkóstoló a helyi hálózaton: ${publicUrl}`);
console.log(`Játékmesterként ezen a gépen: http://127.0.0.1:${port}/host`);
console.log('A meghívó linkek és QR-kódok a hálózati címre mutatnak.');
if (isWsl && wslMode !== 'mirrored') {
  const wslAddress = run('hostname', ['-I']).split(/\s+/)[0];
  const script = run('wslpath', ['-w', fileURLToPath(new URL('./wsl-lan-forward.ps1', import.meta.url))]);
  console.log(`\nWSL (${wslMode}) hálózat: a Windowsnak tovább kell adnia a ${port}-es portot a WSL-nek (${wslAddress}).`);
  console.log('Egyszer, illetve a WSL/Windows újraindítása után futtasd rendszergazdai PowerShellben:');
  console.log(`  powershell -ExecutionPolicy Bypass -File "${script}" -Port ${port} -ListenAddress ${lanHost}`);
}
console.log('');

const vite = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
  '--host', '0.0.0.0', '--port', String(port), '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: '/', VITE_PUBLIC_APP_URL: publicUrl },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => vite.kill(signal));
vite.on('exit', (code) => process.exit(code ?? 0));

setTimeout(async () => {
  try {
    await fetch(`${publicUrl}/`, { signal: AbortSignal.timeout(3000) });
    console.log(`\n✓ A ${publicUrl} cím elérhető ezen a gépen keresztül.`);
  } catch {
    console.log(`\n! A ${publicUrl} cím most nem érhető el.${isWsl && wslMode !== 'mirrored'
      ? ' Futtasd a fenti PowerShell-parancsot rendszergazdaként.' : ' Ellenőrizd a tűzfalat.'}`);
  }
}, 2500);
