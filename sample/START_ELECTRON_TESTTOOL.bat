@echo off
cd /d "%~dp0"
title Worldline C-TEP Electron TestTool Portable Java
if not exist "runtime\java\bin\java.exe" (
  echo Portable Java ontbreekt: runtime\java\bin\java.exe
  echo.
  echo Draai eerst INSTALL_PORTABLE_JAVA.bat
  echo Of kopieer Java 17 x64 JRE naar runtime\java
  echo.
  pause
  exit /b 1
)
if not exist node_modules\electron (
  echo Electron dependencies ontbreken.
  echo Voer eerst INSTALL_DEPENDENCIES.bat uit.
  pause
  exit /b 1
)
npm start
pause
