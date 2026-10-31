# Installs ZenoBid as a Windows service (starts at boot, restarts if it crashes).
# Run from an ADMINISTRATOR PowerShell, after "npm ci" and "npm run build":
#   powershell -ExecutionPolicy Bypass -File .\deploy\windows\install-service.ps1
# Needs NSSM:  winget install NSSM.NSSM   (then open a NEW PowerShell window)
param(
  [string]$AppDir = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$DataDir = "C:\zenobid-data",
  [int]$Port = 8787
)
$ErrorActionPreference = 'Stop'

$node = (Get-Command node -ErrorAction Stop).Source
$nssmCmd = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssmCmd) { throw "NSSM was not found. Run:  winget install NSSM.NSSM   then open a NEW PowerShell window and try again." }
$nssm = $nssmCmd.Source
if (-not (Test-Path "$AppDir\dist-server\index.js")) { throw "The app is not built yet. Run:  cd $AppDir ; npm ci ; npm run build" }

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
New-Item -ItemType Directory -Force -Path "$DataDir\logs" | Out-Null

# replace any earlier install
& $nssm stop ZenoBid 2>$null | Out-Null
& $nssm remove ZenoBid confirm 2>$null | Out-Null

& $nssm install ZenoBid $node "dist-server\index.js"
& $nssm set ZenoBid AppDirectory $AppDir
# HOST=127.0.0.1: only this machine (and the Cloudflare tunnel running on it) can reach the app
& $nssm set ZenoBid AppEnvironmentExtra "NODE_ENV=production" "PORT=$Port" "HOST=127.0.0.1" "DATA_DIR=$DataDir" "TRUST_PROXY=true"
& $nssm set ZenoBid Start SERVICE_AUTO_START
& $nssm set ZenoBid AppStdout "$DataDir\logs\out.log"
& $nssm set ZenoBid AppStderr "$DataDir\logs\error.log"
& $nssm set ZenoBid AppRotateFiles 1
& $nssm set ZenoBid AppRotateBytes 5000000
& $nssm start ZenoBid

Start-Sleep -Seconds 3
try {
  $health = Invoke-RestMethod "http://127.0.0.1:$Port/api/health"
  Write-Host "ZenoBid is running. Health check: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
  Write-Warning "The service started but the health check failed. Look at $DataDir\logs\error.log"
}
