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
REM Recompile bridge class when javac is available (prevents stale .class).
set "JAVAC_EXE=%~dp0..\runtime\java\bin\javac.exe"
if exist "%JAVAC_EXE%" (
  "%JAVAC_EXE%" --release 17 -encoding UTF-8 -cp "lib\JEasyCTEP-3.4.0.jar" "WorldlineCtepBrowserBridge.java" >nul 2>nul
) else (
  where javac >nul 2>nul
  if %ERRORLEVEL%==0 (
    javac --release 17 -encoding UTF-8 -cp "lib\JEasyCTEP-3.4.0.jar" "WorldlineCtepBrowserBridge.java" >nul 2>nul
  )
)
set "CTEP=9000"
set "HTTP=3210"
if defined WORLDLINE_CTEP_PORT set "CTEP=%WORLDLINE_CTEP_PORT%"
if defined WORLDLINE_CTEP_HTTP_PORT set "HTTP=%WORLDLINE_CTEP_HTTP_PORT%"
set "SERIAL_BAUD=115200"
if defined WORLDLINE_CTEP_SERIAL_BAUD set "SERIAL_BAUD=%WORLDLINE_CTEP_SERIAL_BAUD%"
echo Using portable Java: %JAVA_EXE%
echo HTTP bridge port:%HTTP%
if defined WORLDLINE_CTEP_SERIAL (
  echo Mode: SERIAL port:%WORLDLINE_CTEP_SERIAL% baud:%SERIAL_BAUD%
  "%JAVA_EXE%" -Djava.library.path="%CD%\lib" -cp ".;lib\JEasyCTEP-3.4.0.jar" WorldlineCtepBrowserBridge --mode serial --serial %WORLDLINE_CTEP_SERIAL% --serial-baud %SERIAL_BAUD% --http-port %HTTP%
) else (
  echo Mode: TCP C-TEP listen:%CTEP%
  "%JAVA_EXE%" -Djava.library.path="%CD%\lib" -cp ".;lib\JEasyCTEP-3.4.0.jar" WorldlineCtepBrowserBridge --mode tcp --ctep-port %CTEP% --http-port %HTTP%
)
pause
