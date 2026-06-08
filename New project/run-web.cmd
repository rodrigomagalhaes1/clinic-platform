@echo off
setlocal

set "PROJECT_DIR=%~dp0"

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js 20 ou superior: https://nodejs.org
  exit /b 1
)

if not exist "%PROJECT_DIR%node_modules" (
  echo Instalando dependencias...
  pushd "%PROJECT_DIR%"
  npm install
  popd
)

echo Iniciando Vite dev server em http://localhost:5174
echo O servidor Full Stack deve estar rodando em http://localhost:5173
echo.
pushd "%PROJECT_DIR%apps\web"
npx vite --config "%PROJECT_DIR%apps\web\vite.config.js" --port 5174
popd
