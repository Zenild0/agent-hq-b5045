# Updates ZenoBid to the newest version and restarts the service.
# Run from an ADMINISTRATOR PowerShell:  powershell -ExecutionPolicy Bypass -File .\deploy\windows\update.ps1
# (Avoid doing this in the middle of a live auction: screens reconnect by themselves, but wait for a pause.)
$ErrorActionPreference = 'Stop'
$AppDir = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $AppDir
git pull
npm ci
npm run build
Restart-Service ZenoBid
Start-Sleep -Seconds 3
$health = Invoke-RestMethod "http://127.0.0.1:8787/api/health"
Write-Host "Updated and running: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
