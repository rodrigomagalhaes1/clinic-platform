$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $ProjectDir "logs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$ProjectDir`" && call run-api.cmd > `"$LogDir\api.log`" 2> `"$LogDir\api.error.log`"" -WindowStyle Minimized
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$ProjectDir`" && call run-web.cmd > `"$LogDir\web.log`" 2> `"$LogDir\web.error.log`"" -WindowStyle Minimized

Write-Host "API: http://localhost:3333"
Write-Host "Web: http://localhost:5173"
Write-Host "Logs: $LogDir"

