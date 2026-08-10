#!/usr/bin/env bash
# SafeBet IQ AI Workforce Bridge — secure launcher (AUD-P1-006).
#
# Resolves CLAUDE_BRIDGE_KEY from an approved secret store and runs the bridge client
# WITHOUT ever placing the value on a command line, in a file, or on the terminal.
#
# Resolution order (first hit wins):
#   1. Existing $CLAUDE_BRIDGE_KEY (e.g. injected by CI secret store).
#   2. AWS Secrets Manager secret  safebet/claude-bridge-key   (preferred).
#   3. AWS SSM Parameter Store SecureString  /safebet/claude-bridge-key.
#   4. Local git-ignored file  .secrets/claude-bridge.key      (local dev only).
#
# Usage (NEVER pass the key itself):
#   scripts/bridge/safebet-bridge.sh context
#   scripts/bridge/safebet-bridge.sh advice --question "..." --objective "..."
#   scripts/bridge/safebet-bridge.sh report --file report.md --id <id> --title "..." --type "Development report"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLIENT="$ROOT/scripts/safebet-workforce-bridge.mjs"

# Normalise a secret payload: accept either a raw key string or a JSON object
# ({"CLAUDE_BRIDGE_KEY":"..."} or a single-field object such as the AWS console
# default). Never echoes the value except on stdout for capture by the caller.
normalise_secret() {
  printf '%s' "$1" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      s=s.replace(/\r?\n$/,"");
      let out=s;
      try { const j=JSON.parse(s);
        if (j && typeof j==="object") {
          const keys=Object.keys(j);
          if (Object.prototype.hasOwnProperty.call(j,"CLAUDE_BRIDGE_KEY")) out=j.CLAUDE_BRIDGE_KEY;
          else if (keys.length===1) out=j[keys[0]];
          else out="";
        }
      } catch {}
      process.stdout.write(String(out||""));
    });'
}

resolve_key() {
  if [ -n "${CLAUDE_BRIDGE_KEY:-}" ]; then printf '%s' "$CLAUDE_BRIDGE_KEY"; return 0; fi
  if command -v aws >/dev/null 2>&1; then
    v="$(aws secretsmanager get-secret-value --secret-id 'safebet/claude-bridge-key' --query SecretString --output text 2>/dev/null || true)"
    if [ -n "$v" ] && [ "$v" != "None" ]; then v="$(normalise_secret "$v")"; [ -n "$v" ] && { printf '%s' "$v"; return 0; }; fi
    v="$(aws ssm get-parameter --name '/safebet/claude-bridge-key' --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true)"
    if [ -n "$v" ] && [ "$v" != "None" ]; then v="$(normalise_secret "$v")"; [ -n "$v" ] && { printf '%s' "$v"; return 0; }; fi
  fi
  if [ -f "$ROOT/.secrets/claude-bridge.key" ]; then tr -d '\r\n' < "$ROOT/.secrets/claude-bridge.key"; return 0; fi
  return 1
}

if ! KEY="$(resolve_key)" || [ -z "$KEY" ]; then
  echo "CLAUDE_BRIDGE_KEY could not be resolved from any approved secret store (env / AWS Secrets Manager / SSM / .secrets/claude-bridge.key). Configure one; never pass the key on the command line." >&2
  exit 2
fi

# Export into the child env only; run the client; the value is never echoed.
CLAUDE_BRIDGE_KEY="$KEY" node "$CLIENT" "$@"
