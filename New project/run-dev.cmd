@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "LOG_DIR=%PROJECT_DIR%logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo Iniciando ambiente de desenvolvimento...
echo.

start "Clinic Full Stack" /min cmd /k "cd /d "%PROJECT_DIR%" && call run-clinic.cmd > "%LOG_DIR%\server.log" 2> "%LOG_DIR%\server.error.log""
timeout /t 2 /nobreak >nul
start "Clinic Vite Dev" /min cmd /k "cd /d "%PROJECT_DIR%" && call run-web.cmd > "%LOG_DIR%\web.log" 2> "%LOG_DIR%\web.error.log""

echo Full Stack (API + web): http://localhost:5173
echo Vite dev (HMR):         http://localhost:5174
echo Logs: %LOG_DIR%
