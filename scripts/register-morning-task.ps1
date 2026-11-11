# Registers (or updates) the scheduled task that wakes the PC at 06:25 (moved 2026-11-10 for the 6:30 morning check-in) and runs morning-start.ps1.
# Run once from a normal PowerShell: powershell -ExecutionPolicy Bypass -File scripts\register-morning-task.ps1
# Optional: -At '06:25'. It runs only while you're signed in (it opens the desktop app), and it can
# wake the PC from sleep or hibernation, not from a full shutdown.

param([string]$At = '06:25')

$script = Join-Path $PSScriptRoot 'morning-start.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
# 2026-11-10: also at logon (1 min later), so a PC started before the daily time gets the API too.
$logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$logon.Delay = 'PT1M'
$trigger = @((New-ScheduledTaskTrigger -Daily -At $At), $logon)
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName 'Calendar - Inicio de la manana' -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Force | Out-Null

# Windows ignores WakeToRun unless wake timers are allowed in the active power plan.
powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
powercfg /SETACTIVE SCHEME_CURRENT

Write-Host "Listo: 'Calendar - Inicio de la manana' a las $At, con despertador. Log: $env:LOCALAPPDATA\CalendarProductivity\morning.log"
Write-Host "Probar ahora: Start-ScheduledTask -TaskName 'Calendar - Inicio de la manana'"
