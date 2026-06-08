@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "APP_ENV=production"
if "%PORT%"=="" set "PORT=5173"
if "%PUBLIC_BASE_URL%"=="" set "PUBLIC_BASE_URL=http://localhost:%PORT%"
if "%CLINIC_DATABASE_PATH%"=="" set "CLINIC_DATABASE_PATH=data\clinic.sqlite"
if "%CLINIC_BACKUPS_PATH%"=="" set "CLINIC_BACKUPS_PATH=data\backups"

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js 20 ou superior: https://nodejs.org
  exit /b 1
)

echo Iniciando Clinic em modo producao em http://localhost:%PORT%
node --no-warnings "%PROJECT_DIR%apps\clinic-server-runtime.mjs"
