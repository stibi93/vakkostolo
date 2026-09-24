# Forwards the Vakkostolo dev server port from the Windows LAN address to WSL (NAT mode) and
# allows it on private networks only. Run from an elevated PowerShell; rerun after a restart.
# Listening on the LAN address (not 0.0.0.0) keeps WSL's own 127.0.0.1 forwarding working.
# ASCII only: Windows PowerShell 5 misreads UTF-8 files without a BOM.
param([int]$Port = 5173, [string]$ListenAddress = '')

$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Rendszergazdai PowerShell szukseges (Futtatas rendszergazdakent).'
}

if (-not $ListenAddress) {
  $ListenAddress = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object { $_.IPv4Address.IPAddress } | Select-Object -First 1
}
if (-not $ListenAddress) { throw 'Nem talalhato helyi halozati cim. Add meg: -ListenAddress 192.168.x.y' }

$wslAddress = (wsl.exe hostname -I).Trim().Split(' ')[0]
if (-not $wslAddress) { throw 'Nem sikerult lekerdezni a WSL IP-cimet. Fut a WSL?' }

netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=$ListenAddress 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenport=$Port listenaddress=$ListenAddress connectport=$Port connectaddress=$wslAddress | Out-Null

$ruleName = "Vakkostolo dev $Port"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private | Out-Null
}

Write-Host "Kesz: ${ListenAddress}:$Port -> ${wslAddress}:$Port (tuzfal: csak privat halozat)."
Write-Host 'Ha a Wi-Fi halozat "Nyilvanos" profilu, allitsd "Privat"-ra a Windows beallitasaiban.'
Write-Host "Visszavonas: netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=$ListenAddress; Remove-NetFirewallRule -DisplayName '$ruleName'"
