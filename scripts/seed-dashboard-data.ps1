param(
  [string]$BaseUrl = $(if ($env:CALENDAR_API_URL) { $env:CALENDAR_API_URL } else { 'http://localhost:3000' }),
  [string]$Email = $(if ($env:CALENDAR_DEMO_EMAIL) { $env:CALENDAR_DEMO_EMAIL } else { "dashboard-seed-$([guid]::NewGuid().ToString('N').Substring(0, 8))@calendar.local" }),
  [string]$Password = $(if ($env:CALENDAR_DEMO_PASSWORD) { $env:CALENDAR_DEMO_PASSWORD } else { 'TestPass123!' }),
  [string]$AccessToken = $env:CALENDAR_ACCESS_TOKEN,
  [switch]$UseLoginOnly
)

$ErrorActionPreference = 'Stop'

function New-IsoDate([datetime]$Date) {
  return $Date.ToUniversalTime().ToString('o')
}

function Invoke-JsonPost([string]$Url, $Body, [hashtable]$Headers = @{}) {
  return Invoke-RestMethod -Method POST -Uri $Url -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 10) -ContentType 'application/json'
}

function Get-AccessToken {
  param(
    [string]$BaseUrl,
    [string]$Email,
    [string]$Password,
    [string]$AccessToken,
    [bool]$UseLoginOnly
  )

  if ($AccessToken) {
    Write-Host 'Using access token from argument/env.' -ForegroundColor Cyan
    return $AccessToken
  }

  $device = @{
    deviceLabel = 'Dashboard seed script'
    devicePlatform = 'WEB'
  }

  if (-not $UseLoginOnly) {
    try {
      $registerBody = @{
        email = $Email
        password = $Password
        name = 'Dashboard Demo'
        deviceLabel = $device.deviceLabel
        devicePlatform = $device.devicePlatform
      }
      $register = Invoke-JsonPost "$BaseUrl/auth/register" $registerBody
      if ($register.accessToken) {
        Write-Host "Registered user: $Email" -ForegroundColor Green
        return [string]$register.accessToken
      }
    } catch {
      Write-Host 'Register failed, trying login...' -ForegroundColor Yellow
    }
  }

  $loginBody = @{
    email = $Email
    password = $Password
    deviceLabel = $device.deviceLabel
    devicePlatform = $device.devicePlatform
  }

  $login = Invoke-JsonPost "$BaseUrl/auth/login" $loginBody
  if (-not $login.accessToken) {
    throw 'Unable to get access token via login.'
  }

  Write-Host "Logged in: $Email" -ForegroundColor Green
  return [string]$login.accessToken
}

$token = Get-AccessToken -BaseUrl $BaseUrl -Email $Email -Password $Password -AccessToken $AccessToken -UseLoginOnly:$UseLoginOnly.IsPresent
$headers = @{ Authorization = "Bearer $token" }

$tasks = @()
$pomodoros = @()
$fitness = @()

$today = (Get-Date).Date
$start = $today.AddDays(-13)

for ($i = 0; $i -lt 14; $i++) {
  $day = $start.AddDays($i)
  $weekday = [int]$day.DayOfWeek
  $isCurrentWeek = $i -ge 7
  $exerciseDay = ($weekday -eq 1) -or ($weekday -eq 3) -or ($weekday -eq 5) -or (($weekday -eq 0) -and $isCurrentWeek)

  $baseTasks = if ($exerciseDay) { 3 } else { 1 }
  $taskCount = $baseTasks + (if ($isCurrentWeek) { 1 } else { 0 })

  for ($t = 0; $t -lt $taskCount; $t++) {
    $difficulty = if ($t % 3 -eq 0) { 'HARD' } elseif ($t % 2 -eq 0) { 'MEDIUM' } else { 'EASY' }
    $priority = if ($difficulty -eq 'HARD') { 'HIGH' } elseif ($difficulty -eq 'MEDIUM') { 'MEDIUM' } else { 'LOW' }

    $estimated = if ($difficulty -eq 'HARD') { 90 + ($t * 5) } elseif ($difficulty -eq 'MEDIUM') { 60 + ($t * 5) } else { 35 + ($t * 5) }
    $baseFactor = if ($difficulty -eq 'HARD') { 1.15 } elseif ($difficulty -eq 'MEDIUM') { 1.05 } else { 0.95 }
    $fitnessFactor = if ($exerciseDay) { 0.92 } else { 1.08 }
    $trendFactor = if ($isCurrentWeek) { 0.94 } else { 1.0 }
    $actual = [math]::Max(20, [math]::Round($estimated * $baseFactor * $fitnessFactor * $trendFactor))

    $scheduledAt = $day.AddHours(9 + ($t * 2))
    $completedAt = $scheduledAt.AddMinutes(20)

    $tasks += @{
      clientId = [guid]::NewGuid().ToString()
      updatedAt = (New-IsoDate $completedAt)
      title = "Demo tarea $($i + 1)-$($t + 1)"
      description = if ($exerciseDay) { 'Dia con ejercicio: productividad alta' } else { 'Dia normal de trabajo' }
      scheduledAt = (New-IsoDate $scheduledAt)
      estimatedMinutes = $estimated
      actualMinutes = $actual
      difficulty = $difficulty
      complexity = if ($difficulty -eq 'HARD') { 8 } elseif ($difficulty -eq 'MEDIUM') { 5 } else { 3 }
      priority = $priority
      category = 'Demo dashboard'
      status = 'COMPLETED'
      completedAt = (New-IsoDate $completedAt)
    }

    $pomodoroCount = if ($difficulty -eq 'HARD') { 2 } else { 1 }
    for ($p = 0; $p -lt $pomodoroCount; $p++) {
      $startedAt = $day.AddHours(8 + ($t * 2)).AddMinutes($p * 30)
      $endedAt = $startedAt.AddMinutes(25)

      $pomodoros += @{
        id = [guid]::NewGuid().ToString()
        updatedAt = (New-IsoDate $endedAt)
        state = 'IDLE'
        focusDurationMin = 25
        shortBreakMin = 5
        longBreakMin = 15
        cyclesBeforeLongBreak = 4
        completedCycles = 1
        active = $false
        interrupted = $false
        startedAt = (New-IsoDate $startedAt)
        endedAt = (New-IsoDate $endedAt)
      }
    }
  }

  if ($exerciseDay) {
    $loggedAt = $day.AddHours(7).AddMinutes(30)
    $fitness += @{
      updatedAt = (New-IsoDate $loggedAt.AddMinutes(15))
      activityType = if ($weekday -eq 5) { 'fuerza' } else { 'running' }
      durationMinutes = if ($isCurrentWeek) { 55 } else { 40 }
      intensity = if ($isCurrentWeek) { 'HIGH' } else { 'MEDIUM' }
      notes = if ($isCurrentWeek) { 'Entrenamiento con buena energia' } else { 'Sesion consistente' }
      loggedAt = (New-IsoDate $loggedAt)
      source = 'MANUAL'
    }
  }
}

$payload = @{
  tasks = $tasks
  pomodoroSessions = $pomodoros
  fitnessEntries = $fitness
}

$result = Invoke-JsonPost "$BaseUrl/sync/batch" $payload $headers

Write-Host ''
Write-Host 'Dashboard demo data seeded.' -ForegroundColor Green
Write-Host "API: $BaseUrl"
Write-Host "Email: $Email"
Write-Host "Tasks: $($tasks.Count)"
Write-Host "Pomodoros: $($pomodoros.Count)"
Write-Host "Fitness entries: $($fitness.Count)"
Write-Host "Applied keys: $(([string[]]$result.applied.Keys) -join ', ')"
