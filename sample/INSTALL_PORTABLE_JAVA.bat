@echo off
cd /d "%~dp0"
title Install Portable Java 17 for Worldline C-TEP Tool
echo.
echo Deze stap downloadt Eclipse Temurin Java 17 JRE x64 en plaatst die in runtime\java.
echo Daarna heeft de POS-pc geen globale Java/PATH nodig.
echo.
where powershell >nul 2>nul
if errorlevel 1 (
  echo PowerShell niet gevonden.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install-portable-java.ps1"
pause
