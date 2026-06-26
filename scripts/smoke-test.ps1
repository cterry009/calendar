$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$passed = 0
$failed = 0

function Assert-Pass($name, $scriptBlock) {
  try {
    & $scriptBlock
    Write-Host "[PASS] $name" -ForegroundColor Green
    $script:passed++
  } catch {
    Write-Host "[FAIL] $name - $($_.Exception.Message)" -ForegroundColor Red
    $script:failed++
  }
}

Assert-Pass 'GET /docs (Swagger UI)' {
  $r = Invoke-WebRequest "$base/docs" -UseBasicParsing
  if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
  if ($r.Content -notmatch 'swagger') { throw 'swagger UI not found' }
}

Assert-Pass 'GET /health' {
  $r = Invoke-RestMethod "$base/health"
  if ($r.status -ne 'ok') { throw "unexpected response" }
}

Assert-Pass 'GET /health/db' {
  $r = Invoke-RestMethod "$base/health/db"
  if ($r.database -ne 'connected') { throw "db not connected" }
}

$email = "smoke-$(Get-Random)@calendar.local"
$password = 'TestPass123!'
$reg = $null
$login = $null
$refreshed = $null

Assert-Pass 'POST /auth/register' {
  $body = @{
    email = $email
    password = $password
    name = 'Smoke Test'
    deviceLabel = 'Smoke Web Client'
    devicePlatform = 'WEB'
  } | ConvertTo-Json
  $script:reg = Invoke-RestMethod "$base/auth/register" -Method POST -Body $body -ContentType 'application/json'
  if (-not $script:reg.accessToken) { throw 'missing accessToken' }
  $script:login = $script:reg
}

Assert-Pass 'POST /auth/login' {
  $body = @{
    email = $email
    password = $password
    deviceLabel = 'Smoke Web Client'
    devicePlatform = 'WEB'
  } | ConvertTo-Json
  $script:login = Invoke-RestMethod "$base/auth/login" -Method POST -Body $body -ContentType 'application/json'
  if (-not $script:login.accessToken) { throw 'missing accessToken' }
}

Assert-Pass 'GET /auth/me' {
  $headers = @{ Authorization = "Bearer $($script:login.accessToken)" }
  $r = Invoke-RestMethod "$base/auth/me" -Headers $headers
  if ($r.email -ne $email) { throw 'email mismatch' }
}

Assert-Pass 'POST /devices/register' {
  $headers = @{ Authorization = "Bearer $($script:login.accessToken)" }
  $body = @{ label = 'Smoke Web 2'; platform = 'WEB' } | ConvertTo-Json
  $device = Invoke-RestMethod "$base/devices/register" -Method POST -Headers $headers -Body $body -ContentType 'application/json'
  if (-not $device.deviceId) { throw 'missing deviceId' }
}

Assert-Pass 'GET /devices' {
  $headers = @{ Authorization = "Bearer $($script:login.accessToken)" }
  $r = Invoke-RestMethod "$base/devices" -Headers $headers
  if (@($r).Count -lt 1) { throw 'no devices returned' }
}

Assert-Pass 'POST /auth/refresh' {
  $body = @{ refreshToken = $script:login.refreshToken } | ConvertTo-Json
  $script:refreshed = Invoke-RestMethod "$base/auth/refresh" -Method POST -Body $body -ContentType 'application/json'
  if (-not $script:refreshed.accessToken) { throw 'missing refreshed token' }
}

Assert-Pass 'GET /sync/pull' {
  $headers = @{ Authorization = "Bearer $($script:refreshed.accessToken)" }
  $r = Invoke-RestMethod "$base/sync/pull" -Headers $headers
  if ($null -eq $r.tasks) { throw 'missing tasks array' }
}

Assert-Pass 'POST /sync/batch (create task)' {
  $headers = @{ Authorization = "Bearer $($script:refreshed.accessToken)" }
  $clientId = [guid]::NewGuid().ToString()
  $body = @{
    tasks = @(
      @{
        clientId = $clientId
        title = 'Tarea smoke test'
        estimatedMinutes = 30
        difficulty = 'MEDIUM'
        complexity = 5
        priority = 'MEDIUM'
        status = 'PENDING'
        updatedAt = (Get-Date).ToUniversalTime().ToString('o')
      }
    )
  } | ConvertTo-Json -Depth 5
  $r = Invoke-RestMethod "$base/sync/batch" -Method POST -Headers $headers -Body $body -ContentType 'application/json'
  $applied = @($r.applied.tasks | Where-Object { $_.status -eq 'applied' })
  if ($applied.Count -lt 1) { throw "task not applied: $($r | ConvertTo-Json -Depth 5 -Compress)" }
}

Write-Host ""
Write-Host "=== Smoke test summary: $passed passed, $failed failed ==="
if ($failed -gt 0) { exit 1 }
