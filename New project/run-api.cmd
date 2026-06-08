@echo off
setlocal

set "PROJECT_DIR=%~dp0"

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js 20 ou superior: https://nodejs.org
  exit /b 1
)

echo Iniciando API standalone em http://localhost:3333
node --no-warnings "%PROJECT_DIR%apps\api\src\main.ts"
