@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "LOG_DIR=%PROJECT_DIR%logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

start "Clinic Automation API" /min cmd /k "cd /d "%PROJECT_DIR%" && call run-api.cmd > "%LOG_DIR%\api.log" 2> "%LOG_DIR%\api.error.log""
start "Clinic Automation Web" /min cmd /k "cd /d "%PROJECT_DIR%" && call run-web.cmd > "%LOG_DIR%\web.log" 2> "%LOG_DIR%\web.error.log""

echo API: http://localhost:3333
echo Web: http://localhost:5173
echo Logs: %LOG_DIR%

