@echo off
cd /d "%~dp0"
title Worldline C-TEP Bridge (retail) - Portable Java
set "ROOT=%~dp0..\.."
set "JAVA_EXE=%ROOT%\sample\runtime\java\bin\java.exe"
if not exist "%JAVA_EXE%" (
  echo Portable Java ontbreekt: %JAVA_EXE%
  echo Draai eerst INSTALL_PORTABLE_JAVA.bat in de sample-hoofdmap ^(zie sample\README_PORTABLE_JAVA_NL.txt^).
  pause
  exit /b 1
)
set "PATH=%CD%\lib;%PATH%"
set "CTEP=9000"
set "HTTP=3210"
if defined WORLDLINE_CTEP_PORT set "CTEP=%WORLDLINE_CTEP_PORT%"
if defined WORLDLINE_CTEP_HTTP_PORT set "HTTP=%WORLDLINE_CTEP_HTTP_PORT%"
echo Using portable Java: %JAVA_EXE%
echo C-TEP:%CTEP% HTTP:%HTTP%
"%JAVA_EXE%" -Djava.library.path="%CD%\lib" -cp ".;lib\JEasyCTEP-3.4.0.jar" WorldlineCtepBrowserBridge --ctep-port %CTEP% --http-port %HTTP%
pause
