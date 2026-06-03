@echo off
REM Run from backend/bat — bridge cwd is backend/worldline-ctep-bridge, Java from backend/runtime/java
cd /d "%~dp0..\worldline-ctep-bridge"
if not exist "lib\JEasyCTEP-3.4.0.jar" (
  echo Ontbrekende bridge: lib\JEasyCTEP-3.4.0.jar niet gevonden in worldline-ctep-bridge.
  echo Kopieer de Worldline bridge-bestanden naar backend\worldline-ctep-bridge\
  pause
  exit /b 1
)
title Worldline C-TEP Bridge ONLY - Portable Java
set "JAVA_EXE=%~dp0..\runtime\java\bin\java.exe"
if not exist "%JAVA_EXE%" (
  echo Portable Java ontbreekt: %JAVA_EXE%
  echo Draai eerst INSTALL_PORTABLE_JAVA.bat in de map backend\bat
  pause
  exit /b 1
)
set "PATH=%CD%\lib;%PATH%"
set "CTEP=9000"
set "HTTP=3210"
if defined WORLDLINE_CTEP_PORT set "CTEP=%WORLDLINE_CTEP_PORT%"
if defined WORLDLINE_CTEP_HTTP_PORT set "HTTP=%WORLDLINE_CTEP_HTTP_PORT%"
echo Starting Java bridge with portable Java...
echo C-TEP:%CTEP% HTTP:%HTTP%
"%JAVA_EXE%" -Djava.library.path="%CD%\lib" -cp ".;lib\JEasyCTEP-3.4.0.jar" WorldlineCtepBrowserBridge --ctep-port %CTEP% --http-port %HTTP%
pause
