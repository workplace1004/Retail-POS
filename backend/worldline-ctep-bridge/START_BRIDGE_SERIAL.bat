@echo off
REM Worldline C-TEP over USB/serial (COM). Set COM port to match Device Manager.
REM Optional: WORLDLINE_CTEP_SERIAL_BAUD (default 115200), WORLDLINE_CTEP_HTTP_PORT (default 3210)
set WORLDLINE_CTEP_SERIAL=COM1
set WORLDLINE_CTEP_SERIAL_BAUD=115200
cd /d "%~dp0"
if not "%~1"=="" set "WORLDLINE_CTEP_SERIAL=%~1"
if not defined WORLDLINE_CTEP_SERIAL set "WORLDLINE_CTEP_SERIAL=COM1"
call "%~dp0START_BRIDGE.bat"
