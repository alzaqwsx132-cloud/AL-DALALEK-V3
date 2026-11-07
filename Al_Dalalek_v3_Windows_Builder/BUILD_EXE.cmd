@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Al Dalalek V3 - Build Windows EXE
cd /d "%~dp0"
set "ROOT=%~dp0"
set "NODEHOME=%ROOT%.tools\node-v22.16.0-win-x64"

echo ==============================================
echo    Al Dalalek V3 - Windows EXE Builder
echo ==============================================
echo.
if not exist "%ROOT%project\package.json" goto FAIL
if not exist "%ROOT%project\.env" goto NO_ENV
where npm.cmd >nul 2>&1
if not errorlevel 1 goto BUILD

echo Node.js not found. Downloading portable Node.js...
if not exist "%ROOT%.tools" mkdir "%ROOT%.tools"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $dest=$env:ROOT+'.tools'; $zip=Join-Path $dest 'node-v22.16.0-win-x64.zip'; if (!(Test-Path (Join-Path $env:NODEHOME 'npm.cmd'))) { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip' -OutFile $zip -UseBasicParsing; Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force; Remove-Item -LiteralPath $zip -Force }"
if errorlevel 1 goto FAIL
set "PATH=%NODEHOME%;%PATH%"
where npm.cmd >nul 2>&1
if errorlevel 1 goto FAIL

:BUILD
cd /d "%ROOT%project"
echo.
echo [1/5] Installing dependencies (internet required)...
call npm.cmd install --no-audit --no-fund --no-progress
if errorlevel 1 goto FAIL
echo.
echo [2/5] Running source logic tests...
call npm.cmd run test:logic
if errorlevel 1 goto FAIL
echo.
echo [3/5] Checking TypeScript...
call npm.cmd run typecheck
if errorlevel 1 goto FAIL
echo.
echo [4/5] Building the app interface...
call npm.cmd run build
if errorlevel 1 goto FAIL
echo.
echo [5/5] Creating the portable EXE...
call npx.cmd --no-install electron-builder --win portable --x64
if errorlevel 1 goto FAIL
if not exist "%CD%\windows-release\Al-Dalalek-v3.exe" goto FAIL

echo.
echo ==============================================
echo  SUCCESS! Your EXE is here:
echo  project\windows-release\Al-Dalalek-v3.exe
echo ==============================================
start "" "%CD%\windows-release"
pause
exit /b 0

:NO_ENV
echo Missing Supabase config: project\.env
exit /b 2

:FAIL
echo.
echo BUILD FAILED. No successful EXE yet.
echo Please send a screenshot of the error above.
pause
exit /b 1
