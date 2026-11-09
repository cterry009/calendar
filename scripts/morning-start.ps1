# Morning start (2026-11-08): run by the "Calendar - Inicio de la manana" scheduled task, which wakes
# the PC at 07:50 (register-morning-task.ps1). Brings up what the day needs without anyone at the
# keyboard: Docker (Postgres + Redis), the API in production mode (task 12.12's way: migrate deploy
# + node dist/main.js, detached, same log as before), and the desktop app on today's view.
# Safe to run again: each step skips what is already up. Never stops or restarts anything.

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:LOCALAPPDATA 'CalendarProductivity'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'morning.log'
function Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Add-Content -Path $log }
# A native command's output, as plain lines. `*>> $log` wrote UTF-16 into this ANSI file and wrapped
# docker's progress (it goes to stderr) in NativeCommandError records -- unreadable (2026-11-08).
function LogOutput { process { "  $_" | Add-Content -Path $log } }

Log '--- inicio de la manana ---'

# 1. Docker Desktop and the compose services.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  $dockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dockerExe) { Start-Process $dockerExe; Log 'Docker Desktop iniciado' }
  else { Log "No encontre Docker Desktop en $dockerExe" }
  $deadline = (Get-Date).AddMinutes(4)
  do { Start-Sleep -Seconds 5; docker info *> $null } until ($LASTEXITCODE -eq 0 -or (Get-Date) -gt $deadline)
}
if ($LASTEXITCODE -eq 0) {
  Push-Location $repo; cmd /c 'docker compose up -d 2>&1' | LogOutput; Pop-Location
  Log 'docker compose up -d listo'
} else { Log 'Docker no respondio en 4 min; sigo sin la base de datos' }

# 2. The API, if nothing answers on :3000.
function ApiUp { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://localhost:3000/docs' | Out-Null; $true } catch { $false } }
if (-not (ApiUp)) {
  $server = Join-Path $repo 'server'
  if (-not (Test-Path (Join-Path $server 'dist\main.js'))) {
    Log 'No hay server\dist\main.js: corre "npm run build --prefix server" una vez'
  } else {
    Push-Location $server
    cmd /c 'npx prisma migrate deploy 2>&1' | LogOutput
    Pop-Location
    $apiLog = Join-Path $logDir 'api.log'
    $env:NODE_ENV = 'production'
    Start-Process -FilePath 'node' -ArgumentList 'dist\main.js' -WorkingDirectory $server -WindowStyle Hidden `
      -RedirectStandardOutput $apiLog -RedirectStandardError (Join-Path $logDir 'api.err.log')
    $deadline = (Get-Date).AddMinutes(2)
    do { Start-Sleep -Seconds 3 } until ((ApiUp) -or (Get-Date) -gt $deadline)
    if (ApiUp) { Log 'API arriba en :3000' } else { Log 'La API no respondio en 2 min (ver api.err.log)' }
  }
} else { Log 'La API ya estaba arriba' }

# 3. The desktop app (installed build first, then the local release build), on today's view.
$candidates = @(
  (Join-Path $env:LOCALAPPDATA 'Calendar Productivity\calendar-desktop.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\Calendar Productivity\calendar-desktop.exe'),
  (Join-Path $env:ProgramFiles 'Calendar Productivity\calendar-desktop.exe'),
  (Join-Path $repo 'apps\desktop\src-tauri\target\release\calendar-desktop.exe')
)
if (Get-Process -Name 'calendar-desktop' -ErrorAction SilentlyContinue) {
  Log 'La app de escritorio ya estaba abierta'
} else {
  $exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($exe) { Start-Process $exe; Log "App abierta: $exe" } else { Log 'No encontre la app de escritorio instalada' }
}
Log '--- fin ---'
