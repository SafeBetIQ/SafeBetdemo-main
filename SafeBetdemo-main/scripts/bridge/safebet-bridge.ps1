# SafeBet IQ AI Workforce Bridge — secure launcher (AUD-P1-006).
#
# Resolves CLAUDE_BRIDGE_KEY from an approved secret store and runs the bridge client
# WITHOUT ever placing the value on a command line, in a file, or in the console.
#
# Resolution order (first hit wins):
#   1. Existing $env:CLAUDE_BRIDGE_KEY (e.g. injected by CI secret store).
#   2. AWS Secrets Manager secret  safebet/claude-bridge-key   (preferred).
#   3. AWS SSM Parameter Store SecureString  /safebet/claude-bridge-key.
#   4. Local git-ignored file  .secrets/claude-bridge.key      (local dev only).
#
# Usage (NEVER pass the key itself):
#   pwsh scripts/bridge/safebet-bridge.ps1 context
#   pwsh scripts/bridge/safebet-bridge.ps1 advice --question "..." --objective "..."
#   pwsh scripts/bridge/safebet-bridge.ps1 report --file report.md --id <id> --title "..." --type "Development report"

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # repo app root
$client = Join-Path $root 'scripts/safebet-workforce-bridge.mjs'

# Normalise a secret payload: accept either a raw key string or a JSON object
# ({"CLAUDE_BRIDGE_KEY":"..."} or a single-field object such as the AWS console
# default). Returns $null if a JSON object has multiple fields and no explicit key.
function Convert-Secret([string]$raw) {
  if (-not $raw) { return $null }
  $s = $raw.Trim()
  if ($s.StartsWith('{')) {
    try {
      $j = $s | ConvertFrom-Json
      if ($j.PSObject.Properties.Name -contains 'CLAUDE_BRIDGE_KEY') { return [string]$j.CLAUDE_BRIDGE_KEY }
      $names = @($j.PSObject.Properties.Name)
      if ($names.Count -eq 1) { return [string]$j.$($names[0]) }
      return $null
    } catch { return $s }
  }
  return $s
}

function Resolve-BridgeKey {
  if ($env:CLAUDE_BRIDGE_KEY) { return (Convert-Secret $env:CLAUDE_BRIDGE_KEY) }   # already provisioned

  # AWS Secrets Manager
  try {
    $v = & aws secretsmanager get-secret-value --secret-id 'safebet/claude-bridge-key' --query SecretString --output text 2>$null
    if ($LASTEXITCODE -eq 0 -and $v) { $k = Convert-Secret $v; if ($k) { return $k } }
  } catch {}

  # AWS SSM SecureString
  try {
    $v = & aws ssm get-parameter --name '/safebet/claude-bridge-key' --with-decryption --query 'Parameter.Value' --output text 2>$null
    if ($LASTEXITCODE -eq 0 -and $v) { $k = Convert-Secret $v; if ($k) { return $k } }
  } catch {}

  # Local git-ignored file (dev only)
  $f = Join-Path $root '.secrets/claude-bridge.key'
  if (Test-Path $f) { return (Get-Content -Raw $f).Trim() }

  return $null
}

$key = Resolve-BridgeKey
if (-not $key) {
  Write-Error 'CLAUDE_BRIDGE_KEY could not be resolved from any approved secret store (env / AWS Secrets Manager / SSM / .secrets/claude-bridge.key). Configure one of these; never pass the key on the command line.'
  exit 2
}

# Inject into the child process env ONLY (not the interactive shell), then run the client.
$env:CLAUDE_BRIDGE_KEY = $key
try {
  & node $client @args
  exit $LASTEXITCODE
} finally {
  # Best-effort scrub of the variable from this process scope.
  Remove-Item Env:CLAUDE_BRIDGE_KEY -ErrorAction SilentlyContinue
  $key = $null
}
