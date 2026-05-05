@echo off
cd /d "%~dp0"
title Worldline C-TEP Bridge (retail) - Portable Java
set "JAVA_EXE=%~dp0..\runtime\java\bin\java.exe"
if not exist "%JAVA_EXE%" (
  echo Portable Java ontbreekt: %JAVA_EXE%
  echo Kopieer een Java 17 x64 JRE naar backend\runtime\java ^(bin\java.exe moet bestaan^).
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
