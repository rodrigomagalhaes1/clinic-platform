@echo off
setlocal
set "PATH=C:\Program Files\Docker\Docker\resources\bin;%PATH%"
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop nao foi encontrado.
  echo Instale o Docker Desktop, abra-o uma vez e execute este arquivo novamente.
  exit /b 1
)
cd /d "%~dp0infra\evolution-api"
docker compose up -d
docker compose ps
