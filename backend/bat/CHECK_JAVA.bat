@echo off
echo Checking system Java ^(PATH / JAVA_HOME^)...
echo.
where java 2>nul
echo.
java -version 2>nul
echo.
echo Voor de Worldline bridge is geen globale Java nodig: gebruik portable Java in backend\runtime\java
echo ^(controle: backend\bat\CHECK_PORTABLE_JAVA.bat^).
echo.
pause
