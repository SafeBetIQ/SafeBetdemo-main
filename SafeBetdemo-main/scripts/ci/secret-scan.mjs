#!/usr/bin/env node
// SafeBet IQ CI secret scan (AUD-P1-008). Fails if a committed secret is detected
// in tracked files. Scans git-tracked text files only (never node_modules / build
// output). Exit 1 blocks the pipeline.
//
//   node scripts/ci/secret-scan.mjs

import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// High-signal secret patterns. Env-var NAMES and placeholders are NOT secrets.
const RULES = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, 'private key block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\baws_secret_access_key\s*=\s*[A-Za-z0-9/+]{40}\b/i, 'AWS secret access key'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, 'JWT / Supabase key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'OpenAI-style secret key'],
  // Assignment of a real-looking value to a known secret-bearing variable name.
  [/\b(?:CLAUDE_BRIDGE_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|DB_PASSWORD|DATABASE_URL|SUPABASE_JWT_SECRET)\s*[:=]\s*["']?[A-Za-z0-9._/+-]{16,}["']?/, 'hard-coded secret assignment'],
];

// Files that legitimately contain redaction patterns / example placeholders.
const ALLOW_PATH = [/\.env\.example$/, /scripts\/ci\/secret-scan\.mjs$/, /scripts\/safebet-workforce-bridge\.mjs$/, /security\/audit-exceptions\.json$/];
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.woff', '.woff2', '.ttf', '.lock']);

let files = [];
try {
  files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
} catch { console.error('[secret-scan] not a git repo / git unavailable'); process.exit(2); }

const findings = [];
for (const rel of files) {
  if (ALLOW_PATH.some((re) => re.test(rel))) continue;
  if (SKIP_EXT.has(path.extname(rel).toLowerCase())) continue;
  const abs = path.join(ROOT, rel);
  let text;
  try { if (statSync(abs).size > 2 * 1024 * 1024) continue; text = readFileSync(abs, 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [re, label] of RULES) {
      if (re.test(lines[i])) findings.push({ rel, line: i + 1, label });
    }
  }
}

if (findings.length) {
  console.error('[secret-scan] BLOCKING — potential secrets in tracked files:');
  for (const f of findings) console.error(`   ✗ ${f.rel}:${f.line} — ${f.label}`);
  console.error('[secret-scan] FAIL — remove the secret, rotate it, and use an environment variable.');
  process.exit(1);
}
console.log(`[secret-scan] PASS — scanned ${files.length} tracked files, no committed secrets detected.`);
process.exit(0);
