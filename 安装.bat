@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ================================================
echo   Antigravity Custom Theme - Install
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js not found. Install Node 18+ and run this again.
  pause
  exit /b 1
)

echo Stopping Antigravity if it is running...
taskkill /F /IM Antigravity.exe /T >nul 2>nul
timeout /t 2 /nobreak >nul

node "lib\patcher.cjs" --install --no-kill
if errorlevel 1 (
  echo.
  echo [X] Install failed. Nothing was changed in your app.
  pause
  exit /b 1
)

echo.
echo Restarting Antigravity...
set "AGY=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
if exist "%AGY%" (
  start "" "%AGY%"
) else (
  echo [!] Could not find Antigravity.exe - start it yourself.
)

echo.
echo Done. Open Settings - Appearance to find the "Custom Theme" card.
echo To undo everything, run 卸载.bat
pause
