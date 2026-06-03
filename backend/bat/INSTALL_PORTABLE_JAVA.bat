@echo off
cd /d "%~dp0"
title Install Portable Java 17 (Worldline C-TEP)
echo.
echo Deze stap downloadt Eclipse Temurin Java 17 JRE x64 naar backend\runtime\java
echo ^(geen globale Java/PATH nodig voor de bridge^).
echo.
where powershell >nul 2>nul
if errorlevel 1 (
  echo PowerShell niet gevonden.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install-portable-java.ps1"
pause
