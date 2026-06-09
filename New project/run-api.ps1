$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCommand) {
  Write-Error "Node.js nao foi encontrado. Instale o Node.js 22 ou superior: https://nodejs.org"
  exit 1
}

Write-Host "Iniciando API standalone em http://localhost:3333"
& $NodeCommand.Source "--no-warnings" (Join-Path $ProjectDir "apps\api\src\main.ts")
