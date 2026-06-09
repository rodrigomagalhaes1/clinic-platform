$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCommand) {
  Write-Error "Node.js nao foi encontrado. Instale o Node.js 22 ou superior: https://nodejs.org"
  exit 1
}

Write-Host "Iniciando Clinic Full Stack em http://localhost:5173"
& $NodeCommand.Source "--no-warnings" (Join-Path $ProjectDir "apps\clinic-server-runtime.mjs")
