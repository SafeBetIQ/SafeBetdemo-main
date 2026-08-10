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
import { scanText } from './secret-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Detection lives in ./secret-rules.mjs (shared + unit-tested). This script only
// enumerates git-tracked text files and applies scanText() to each.

// Files that legitimately contain redaction patterns / example placeholders.
// The fixture directory is deliberately EXCLUDED so its planted literal must FAIL a
// direct scan in the unit test, but is allow-listed here so CI is not blocked by it.
const ALLOW_PATH = [/\.env\.example$/, /scripts\/ci\/secret-rules\.mjs$/, /scripts\/ci\/secret-scan\.mjs$/, /scripts\/safebet-workforce-bridge\.mjs$/, /security\/audit-exceptions\.json$/, /tests\/fixtures\/secret-scan\//, /tests\/secretScan\.test\.mjs$/];
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
  for (const hit of scanText(text)) findings.push({ rel, line: hit.line, label: hit.label });
}

if (findings.length) {
  console.error('[secret-scan] BLOCKING — potential secrets in tracked files:');
  for (const f of findings) console.error(`   ✗ ${f.rel}:${f.line} — ${f.label}`);
  console.error('[secret-scan] FAIL — remove the secret, rotate it, and use an environment variable.');
  process.exit(1);
}
console.log(`[secret-scan] PASS — scanned ${files.length} tracked files, no committed secrets detected.`);
process.exit(0);
