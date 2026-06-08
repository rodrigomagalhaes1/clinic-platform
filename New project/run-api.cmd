@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "CODEX_NODE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"

if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" --no-warnings "%PROJECT_DIR%apps\api\src\main.ts"
  exit /b %ERRORLEVEL%
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  node --no-warnings "%PROJECT_DIR%apps\api\src\main.ts"
  exit /b %ERRORLEVEL%
)

echo Node.js nao foi encontrado.
echo Instale o Node.js 20 ou superior, ou execute pelo ambiente do Codex.
exit /b 1
