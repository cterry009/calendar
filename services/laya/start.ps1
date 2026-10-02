# Starts Laya's HTTP server for the planner (task 8.13). First run: see README.md for the venv setup.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:LAYA_HOST = '127.0.0.1'
$env:LAYA_PORT = '8100'
$env:LAYA_PRELOAD = '1'
$env:LAYA_MODELS = 'multilingual'
$env:LAYA_DEFAULT_MODEL = 'multilingual'
.\.venv\Scripts\laya-serve.exe
