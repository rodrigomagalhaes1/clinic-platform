$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $ProjectDir "logs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Host "Iniciando ambiente de desenvolvimento..."
Write-Host ""

# Full Stack server (API + web na porta 5173)
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$ProjectDir`" && call run-clinic.cmd > `"$LogDir\server.log`" 2> `"$LogDir\server.error.log`"" -WindowStyle Minimized

Start-Sleep -Seconds 2

# Vite dev server com HMR (proxia /v1 para 5173)
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$ProjectDir`" && call run-web.cmd > `"$LogDir\web.log`" 2> `"$LogDir\web.error.log`"" -WindowStyle Minimized

Write-Host "Full Stack (API + web): http://localhost:5173"
Write-Host "Vite dev (HMR):         http://localhost:5174"
Write-Host "Logs: $LogDir"
