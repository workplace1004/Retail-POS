@echo off
cd /d "%~dp0"
title Install Worldline C-TEP Electron TestTool
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is niet gevonden. Installeer Node.js LTS.
  pause
  exit /b 1
)
echo Installing Electron dependencies...
npm install
pause
