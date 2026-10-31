# Zips every auction and uploaded photo into C:\zenobid-backups, keeping 14 days.
#   powershell -ExecutionPolicy Bypass -File .\deploy\windows\backup.ps1
# Auction files are written atomically, so this is safe to run while the app is live.
param(
  [string]$DataDir = "C:\zenobid-data",
  [string]$BackupDir = "C:\zenobid-backups",
  [int]$KeepDays = 14
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$zip = Join-Path $BackupDir "zenobid-$stamp.zip"
$paths = @("$DataDir\events", "$DataDir\uploads") | Where-Object { Test-Path $_ }
if (-not $paths) { Write-Host "Nothing to back up yet."; exit 0 }
Compress-Archive -Path $paths -DestinationPath $zip
Get-ChildItem $BackupDir -Filter 'zenobid-*.zip' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item
Write-Host "Saved $zip"
