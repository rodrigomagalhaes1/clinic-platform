@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "CODEX_NODE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"
set "APP_ENV=production"
if "%PORT%"=="" set "PORT=5173"
if "%PUBLIC_BASE_URL%"=="" set "PUBLIC_BASE_URL=http://localhost:%PORT%"
if "%CLINIC_DATABASE_PATH%"=="" set "CLINIC_DATABASE_PATH=data\clinic.sqlite"
if "%CLINIC_BACKUPS_PATH%"=="" set "CLINIC_BACKUPS_PATH=data\backups"

if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" --no-warnings "%PROJECT_DIR%apps\clinic-server-runtime.mjs"
  exit /b %ERRORLEVEL%
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  node --no-warnings "%PROJECT_DIR%apps\clinic-server-runtime.mjs"
  exit /b %ERRORLEVEL%
)

echo Node.js nao foi encontrado. Instale Node.js 20 ou superior no servidor.
exit /b 1
