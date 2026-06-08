@echo off
setlocal

set "PROJECT_DIR=%~dp0"

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js 20 ou superior: https://nodejs.org
  exit /b 1
)

echo Iniciando Clinic Full Stack em http://localhost:5173
node --no-warnings "%PROJECT_DIR%apps\clinic-server-runtime.mjs"
