# Read-only diagnosis (2026-11-08): why a client can't reach the API, whether game time reaches the
# server, and whether the night block / commitment / "can't close" are in force on the PC and the
# phone. Changes nothing (no restarts, no am crash / force-stop). Writes diag-report.log at the repo
# root (ignored by git) so Claude can read it.
$repo = Split-Path -Parent $PSScriptRoot
$out = Join-Path $repo 'diag-report.log'
"Diagnóstico $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Set-Content $out -Encoding utf8
function Section($t) { "`n=== $t ===" | Add-Content $out -Encoding utf8 }
function Run($label, [scriptblock]$b) { "--- $label" | Add-Content $out -Encoding utf8; try { & $b 2>&1 | Out-String -Width 220 | Add-Content $out -Encoding utf8 } catch { "ERROR: $_" | Add-Content $out -Encoding utf8 } }

Section 'Red y API'
Run 'IPv4 de este PC' { Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object InterfaceAlias, IPAddress }
Run 'URL que usa el teléfono (apps/mobile/.env)' { Select-String -Path (Join-Path $repo 'apps\mobile\.env') -Pattern 'API_URL' }
Run 'Docker' { docker ps --format '{{.Names}} {{.Status}}' }
Run 'Proceso escuchando en :3000' { Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress, OwningProcess, @{n='Proceso';e={(Get-Process -Id $_.OwningProcess).Path}} }
Run 'API en localhost' { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 'http://localhost:3000/docs').StatusCode }
Run 'API en cada IP del PC' { Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | ForEach-Object { $u = "http://$($_.IPAddress):3000/docs"; try { "$u -> $((Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 $u).StatusCode)" } catch { "$u -> FALLA: $($_.Exception.Message)" } } }
Run 'Firewall: reglas para el puerto 3000 o node' { Get-NetFirewallRule -Enabled True -Direction Inbound | Where-Object { $_.DisplayName -match 'node|3000|calendar' } | Select-Object DisplayName, Action, Profile }
Run 'Perfil de red' { Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory }
Run 'Últimas líneas del log de la API' { Get-Content (Join-Path $env:LOCALAPPDATA 'CalendarProductivity\api.log') -Tail 25 -ErrorAction Stop }

Section 'Base de datos (solo tu usuario)'
$email = (Select-String -Path (Join-Path $repo 'server\.env.dev-user') -Pattern '^SEED_DEV_EMAIL=(.*)$').Matches.Groups[1].Value.Trim('"')
"Usuario: $email" | Add-Content $out -Encoding utf8
# The query goes in on stdin: passing it with -c through docker strips PowerShell's doubled quotes,
# and Postgres then folds "userId" to userid.
function Sql($label, $q) { Run $label { Push-Location $repo; $q | docker compose exec -T postgres psql -U calendar -d calendar -P pager=off; Pop-Location } }
$uid = "(select id from users where email = '$email')"
Sql 'Dispositivos' "select label, platform, `"lastSeenAt`", `"revokedAt`" from devices where `"userId`" = $uid order by `"lastSeenAt`" desc limit 10;"
Sql 'Tiempo de juego, últimos 10 días' "select date::date, `"totalMinutes`", `"updatedAt`" from daily_game_time where `"userId`" = $uid order by date desc limit 10;"
Sql 'Tiempo de apps de escritorio, últimos 5 días' "select date::date, `"updatedAt`" from daily_desktop_app_time where `"userId`" = $uid order by date desc limit 5;"
Sql 'Compromiso de bloqueo' "select `"startedAt`", `"endsAt`" from block_commitments where `"userId`" = $uid;"
Sql 'Ventana nocturna en el plan' "select `"planData`"->'nightWindow' as night, `"updatedAt`" from study_plans where `"userId`" = $uid;"
Sql 'Lista NIGHT' "select count(*) filter (where enabled) as activas, count(*) as total from block_list_entries where `"userId`" = $uid and scope = 'NIGHT';"

Section 'PC: no se puede cerrar'
Run 'App de escritorio corriendo' { Get-Process -Name 'calendar-desktop' -ErrorAction Stop | Select-Object Id, Path, StartTime }
Run 'Inicio con Windows (Run)' { Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' | Out-String }
Run 'Tareas programadas de Calendar' { Get-ScheduledTask | Where-Object { $_.TaskName -match 'Calendar|calendar' } | Select-Object TaskName, State }

Section 'Teléfono (adb, solo lectura)'
Run 'adb devices' { adb devices }
Run 'Accesibilidad' { adb shell dumpsys accessibility | Select-String -Pattern 'calendar|FocusBlock|Enabled services|Bound services|crashed' }
Run 'Administrador del dispositivo' { adb shell dumpsys device_policy | Select-String -Pattern 'calendar|Active admin' }
Run 'adb reverse' { adb reverse --list }
Run 'App instalada' { adb shell dumpsys package app.calendarproductivity.mobile | Select-String -Pattern 'versionName|lastUpdateTime' }

"`nFin." | Add-Content $out -Encoding utf8
Write-Host "Listo: $out"
