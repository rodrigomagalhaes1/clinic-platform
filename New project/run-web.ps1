$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CodexNode = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin\node.exe"
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if ($NodeCommand) {
  & $NodeCommand.Source (Join-Path $ProjectDir "apps\web\serve-static.mjs")
  exit $LASTEXITCODE
}

if (Test-Path $CodexNode) {
  & $CodexNode (Join-Path $ProjectDir "apps\web\serve-static.mjs")
  exit $LASTEXITCODE
}

Write-Error "Node.js nao foi encontrado. Instale o Node.js 20 ou superior, ou execute pelo ambiente do Codex."
exit 1

