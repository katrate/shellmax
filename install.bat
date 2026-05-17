@echo off
echo.
echo   Installing ShellMax...
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo   X  Node.js not found. Install from https://nodejs.org
  exit /b 1
)

echo   OK Node.js found
npm install --silent
echo   OK Dependencies installed
npm install -g . --silent
echo   OK ShellMax installed globally

echo.
echo   Run:  shellmax
echo.
pause
