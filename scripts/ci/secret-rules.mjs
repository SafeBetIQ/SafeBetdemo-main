// Shared secret-detection rules (AUD-P1-008 / AUD-P1-006). Pure + unit-testable.
// Env-var NAME references (process.env.X) and placeholders are NOT secrets; only a
// literal value assigned to a secret-bearing variable, or a recognisable token
// shape, is flagged. NEVER put a real secret in this file or its tests.

export const RULES = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, 'private key block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\baws_secret_access_key\s*=\s*[A-Za-z0-9/+]{40}\b/i, 'AWS secret access key'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, 'JWT / Supabase key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'OpenAI-style secret key'],
  // Claude Bridge credential — a LITERAL value assigned to CLAUDE_BRIDGE_KEY, in any
  // shell/JS form (export X=..., $env:X="...", X: '...'). process.env.X is NOT matched.
  [/(?:export\s+|[$]env:)?CLAUDE_BRIDGE_KEY\s*[:=]\s*["']?[A-Za-z0-9][A-Za-z0-9._/+-]{15,}["']?/, 'hard-coded CLAUDE_BRIDGE_KEY literal'],
  // Any Authorization bearer literal (defence-in-depth for accidental logging).
  [/Authorization\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9][A-Za-z0-9._~+/=-]{20,}/i, 'literal Bearer credential'],
  // Generic assignment of a real-looking value to a known secret-bearing variable.
  [/\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|DB_PASSWORD|DATABASE_URL|SUPABASE_JWT_SECRET|[A-Z0-9_]*_SECRET|[A-Z0-9_]*_API_?KEY|[A-Z0-9_]*_PASSWORD)\s*[:=]\s*["']?[A-Za-z0-9._/+-]{16,}["']?/, 'hard-coded secret assignment'],
];

// process.env / import.meta.env / env-var NAME references are safe — strip them so
// they never trip the assignment rules.
const SAFE_REFERENCE = /(?:process\.env\.|import\.meta\.env\.|Deno\.env\.get\(|['"]?)\b[A-Z0-9_]+\b/;

// Assignments whose RHS is a runtime SECRET-MANAGER / CONFIG reference (not a literal):
// e.g. AWS CDK secretValueFromJson().unsafeUnwrap(), SSM getParameter, Supabase
// current_setting(), process.env, etc. These are the SAFE way to consume secrets and
// must not be flagged. Only skip when there is NO quoted 16+ char literal on the line.
const SAFE_REFERENCE_CALL = /secretValueFromJson\(|\.unsafeUnwrap\(|fromSecretsManager|fromSecret\b|getSecretValue|SecretString|current_setting\(|process\.env\.|import\.meta\.env\.|Deno\.env\.get\(|ssm\.getParameter|valueForStringParameter|StringParameter\.value|fromStringParameterName/;
const HAS_QUOTED_LITERAL_SECRET = /["'][A-Za-z0-9][A-Za-z0-9._/+\-]{15,}["']/;

/** Return the list of {label} findings for a single line of text. */
export function scanLine(line) {
  const out = [];
  // A runtime reference to a secret store / env / config with no inline literal value
  // is the APPROVED pattern — never a committed secret.
  const isSafeReference = SAFE_REFERENCE_CALL.test(line) && !HAS_QUOTED_LITERAL_SECRET.test(line)
    && !/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(line);
  // A pure name reference like `process.env.CLAUDE_BRIDGE_KEY` has no assigned value.
  const looksLikeNameRefOnly = /process\.env\.[A-Z0-9_]+|import\.meta\.env\.[A-Z0-9_]+/.test(line)
    && !/=\s*["'][A-Za-z0-9]/.test(line);
  for (const [re, label] of RULES) {
    if (re.test(line)) {
      // Never flag a runtime secret-store/config reference (no literal present).
      if (isSafeReference && /secret assignment|_KEY literal|Bearer credential|CLAUDE_BRIDGE_KEY/.test(label)) continue;
      // Do not flag pure env-name references (no literal value present).
      if (looksLikeNameRefOnly && /CLAUDE_BRIDGE_KEY|_SECRET|_KEY|_PASSWORD/.test(label + line) && !/["'][A-Za-z0-9]{12,}/.test(line)) continue;
      out.push(label);
    }
  }
  return out;
}

/** Scan a multi-line string; returns [{line, label}]. */
export function scanText(text) {
  const findings = [];
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const label of scanLine(lines[i])) findings.push({ line: i + 1, label });
  }
  return findings;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void SAFE_REFERENCE;
