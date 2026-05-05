@echo off
cd /d "%~dp0"
echo Checking portable Java...
if exist "runtime\java\bin\java.exe" (
  "runtime\java\bin\java.exe" -version
  echo.
  echo OK: portable Java gevonden.
) else (
  echo NIET GEVONDEN: runtime\java\bin\java.exe
  echo Draai INSTALL_PORTABLE_JAVA.bat of kopieer een Java 17 x64 JRE naar runtime\java
)
pause
