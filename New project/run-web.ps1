$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCommand) {
  Write-Error "Node.js nao foi encontrado. Instale o Node.js 22 ou superior."
  exit 1
}

# Instala dependencias se node_modules ainda nao existir
$WebDir = Join-Path $ProjectDir "apps\web"
if (-not (Test-Path (Join-Path $ProjectDir "node_modules"))) {
  Write-Host "Instalando dependencias..."
  Push-Location $ProjectDir
  npm install
  Pop-Location
}

# Sobe o Vite em modo dev (HMR, resolve workspace packages via alias)
Push-Location $WebDir
npx vite
Pop-Location

