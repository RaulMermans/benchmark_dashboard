@echo off
setlocal

set "SCRIPT=%~dp0.tools\open-localhost.ps1"

if not exist "%SCRIPT%" (
  echo No encuentro %SCRIPT%
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
