@echo off
cd /d "%~dp0\backend"
title Worldline C-TEP Bridge ONLY - Portable Java
set "ROOT=%~dp0"
set "JAVA_EXE=%ROOT%runtime\java\bin\java.exe"
if not exist "%JAVA_EXE%" (
  echo Portable Java ontbreekt: %JAVA_EXE%
  echo Draai eerst INSTALL_PORTABLE_JAVA.bat in de hoofdmap.
  pause
  exit /b 1
)
set "PATH=%CD%\lib;%PATH%"
echo Starting Java bridge with portable Java...
"%JAVA_EXE%" -Djava.library.path="%CD%\lib" -cp ".;lib\JEasyCTEP-3.4.0.jar" WorldlineCtepBrowserBridge --ctep-port 9000 --http-port 3210
pause
