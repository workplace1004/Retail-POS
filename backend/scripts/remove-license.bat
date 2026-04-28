@echo off
setlocal

rem Removes locally stored POS/Kiosk license by clearing Electron Chromium profile data.
rem License is stored in OPFS inside chromium-session (or profile storage) under AppData\Roaming.

set "REMOVED_COUNT=0"

echo.
echo ==========================================
echo  POS License Removal Utility
echo ==========================================
echo  This will remove local browser profile data
echo  from common app folders (RES POS / RES Kiosk / pos-frontend)
echo  for current and common local users.
echo.
echo  NOTE: This resets app local storage/session too.
echo.

if /I not "%~1"=="/y" (
  set /p _confirm=Type YES to continue: 
  if /I not "%_confirm%"=="YES" (
    echo Cancelled.
    exit /b 0
  )
)

echo.
echo Closing POS processes...
taskkill /F /IM "RES POS.exe" >nul 2>&1
taskkill /F /IM "RESKiosk.exe" >nul 2>&1
taskkill /F /IM "pos-frontend.exe" >nul 2>&1
taskkill /F /IM "electron.exe" >nul 2>&1

call :tryRemove "%APPDATA%\RES POS\chromium-session"
call :tryRemove "%APPDATA%\RES Kiosk\chromium-session"
call :tryRemove "%APPDATA%\pos-frontend\chromium-session"

call :tryRemove "C:\Users\pos\AppData\Roaming\RES POS\chromium-session"
call :tryRemove "C:\Users\pos\AppData\Roaming\RES Kiosk\chromium-session"
call :tryRemove "C:\Users\pos\AppData\Roaming\pos-frontend\chromium-session"

call :tryRemove "C:\Users\Administrator\AppData\Roaming\RES POS\chromium-session"
call :tryRemove "C:\Users\Administrator\AppData\Roaming\RES Kiosk\chromium-session"
call :tryRemove "C:\Users\Administrator\AppData\Roaming\pos-frontend\chromium-session"

if "%REMOVED_COUNT%"=="0" (
  echo.
  echo No known chromium-session folders were found.
  echo If app still shows licensed, run this bat as the same Windows user that runs the app.
  exit /b 0
)

echo.
echo Done.
echo Removed %REMOVED_COUNT% profile folder(s).
echo Local license and Chromium session data were removed.
echo Start POS again and activate license if required.
echo.
exit /b 0

:tryRemove
set "TARGET=%~1"
if not exist "%TARGET%" goto :eof
echo Removing "%TARGET%" ...
rd /s /q "%TARGET%"
if exist "%TARGET%" (
  echo   Failed to remove. Close app and try again.
) else (
  set /a REMOVED_COUNT+=1
  echo   Removed.
)
goto :eof

