@echo off
set "JAVA_EXE=%~dp0..\runtime\java\bin\java.exe"
echo Checking portable Java...
echo Expected: %JAVA_EXE%
echo.
if exist "%JAVA_EXE%" (
  "%JAVA_EXE%" -version
  echo.
  echo OK: portable Java gevonden.
) else (
  echo NIET GEVONDEN.
  echo Draai backend\bat\INSTALL_PORTABLE_JAVA.bat of kopieer een Java 17 x64 JRE naar backend\runtime\java
)
pause
