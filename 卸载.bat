@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   Antigravity Custom Theme - Uninstall
echo ================================================
echo.

echo Stopping Antigravity if it is running...
taskkill /F /IM Antigravity.exe /T >nul 2>nul
timeout /t 2 /nobreak >nul

node "lib\patcher.cjs" --uninstall --no-kill
if errorlevel 1 (
  echo.
  echo [X] Uninstall failed.
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
echo Restored the original app. Your settings are kept in %USERPROFILE%\.gemini\config\agy-bg
pause
