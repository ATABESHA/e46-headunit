@echo off
rem E46 head unit on Windows: starts the core and opens both screens in Microsoft Edge.
rem Double-click this file. Close this black window to stop everything.
title E46 head unit
cd /d "%~dp0..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it by typing this in PowerShell:
  echo.
  echo     winget install OpenJS.NodeJS.LTS
  echo.
  echo Then close this window and double-click start.bat again.
  pause
  exit /b 1
)

rem Electron is only needed in the car (Linux); Edge shows the screens here.
set ELECTRON_SKIP_BINARY_DOWNLOAD=1

if not exist node_modules (
  echo First start: installing components. This takes a few minutes...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto failed
)

echo Building the screen app...
call npm run build
if errorlevel 1 goto failed

rem Opens the two Edge windows a few seconds from now, once the core is running.
start "" /min cmd /c "%~dp0open-screens.bat"

rem The core runs in a loop, so "Software update" can restart it with new code.
set E46_RESTART_LOOP=1
:loop
node core\src\index.js
echo.
echo The core stopped. Starting it again in 3 seconds (close this window to stop)...
timeout /t 3 /nobreak >nul
goto loop

:failed
echo.
echo Something went wrong - see the messages above.
pause
exit /b 1
