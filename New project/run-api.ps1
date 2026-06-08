$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CodexNode = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin\node.exe"
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if ($NodeCommand) {
  & $NodeCommand.Source "--no-warnings" (Join-Path $ProjectDir "apps\api\src\main.ts")
  exit $LASTEXITCODE
}

if (Test-Path $CodexNode) {
  & $CodexNode "--no-warnings" (Join-Path $ProjectDir "apps\api\src\main.ts")
  exit $LASTEXITCODE
}

Write-Error "Node.js nao foi encontrado. Instale o Node.js 20 ou superior, ou execute pelo ambiente do Codex."
exit 1
