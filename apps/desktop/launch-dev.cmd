@echo off
title Calendar Productivity
setlocal

rem ---------------------------------------------------------------------------
rem Launches the desktop app. Runs `npm run dev` here, which starts apps/web's
rem Vite server (via tauri.conf.json's beforeDevCommand) and opens the Tauri
rem window. Also starts the API server in its own window if nothing is on :3000.
rem
rem Until the backend is deployed (task 12.5) there is no self-contained build,
rem so this dev launcher is how you run the desktop client. Keep this window
rem open while using the app; closing it stops Vite / the dev server.
rem ---------------------------------------------------------------------------

rem PATH safety net (in case Node isn't on PATH for this session).
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs\;%PATH%"

cd /d "%~dp0"

rem Start the API server too if nothing is listening on :3000.
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo [launcher] Starting the API server in a new window...
  start "Calendar API" cmd /k "cd /d ""%~dp0..\..\server"" && npm run dev"
  echo [launcher] Waiting a few seconds for the API to come up...
  timeout /t 6 /nobreak >nul
)

echo [launcher] Starting the desktop app (Vite + Tauri window)...
call npm run dev

endlocal
