@echo off
cd /d "%~dp0"
title Worldline C-TEP Bridge (retail)
set "ROOT=%~dp0..\.."
set "JAVA_EXE=java"
if exist "%ROOT%\sample\runtime\java\bin\java.exe" set "JAVA_EXE=%ROOT%\sample\runtime\java\bin\java.exe"
set "PATH=%CD%\lib;%PATH%"
echo Using Java: %JAVA_EXE%
echo C-TEP:9000 HTTP:3210 (override with WORLDLINE_CTEP_PORT / WORLDLINE_CTEP_HTTP_PORT in environment)
"%JAVA_EXE%" -Djava.library.path="%CD%\lib" -cp ".;lib\JEasyCTEP-3.4.0.jar" WorldlineCtepBrowserBridge --ctep-port 9000 --http-port 3210
pause
