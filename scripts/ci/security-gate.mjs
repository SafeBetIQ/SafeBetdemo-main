#!/usr/bin/env node
// SafeBet IQ CI dependency-security gate (AUD-P1-001 / AUD-P1-008).
//
// Runs the PRODUCTION dependency audit and fails promotion when a production
// Critical exists (never excepted) or a production High exists that is NOT covered
// by a non-expired, documented exception in security/audit-exceptions.json.
//
// Non-bypassable: the verdict is derived from the audit JSON, not the audit
// command's own exit code. Exit 1 blocks the pipeline; exit 0 allows it.
//
//   node scripts/ci/security-gate.mjs

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Directory whose production dependencies are audited. Defaults to the repo root;
// set SBIQ_AUDIT_DIR (relative to root) for monorepos where the app lives in a
// subdirectory (e.g. "frontend" on the production branch). Exceptions are always
// read from <root>/security/audit-exceptions.json.
const AUDIT_DIR = path.resolve(ROOT, process.env.SBIQ_AUDIT_DIR || '.');
const SEV_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function loadExceptions() {
  try {
    const cfg = JSON.parse(readFileSync(path.join(ROOT, 'security', 'audit-exceptions.json'), 'utf8'));
    const now = Date.now();
    const active = new Map();   // package -> { maxRank, expiry }
    const expired = [];
    for (const e of cfg.exceptions ?? []) {
      const exp = Date.parse(e.expiry);
      if (Number.isNaN(exp)) { console.error(`[gate] exception for ${e.package} has an invalid/missing expiry — ignored`); continue; }
      if (exp < now) { expired.push(e.package); continue; }   // expired exceptions do NOT protect
      active.set(e.package, { maxRank: SEV_RANK[e.maxSeverity] ?? SEV_RANK.high, expiry: e.expiry });
    }
    return { active, expired };
  } catch {
    console.error('[gate] no readable security/audit-exceptions.json — no exceptions applied');
    return { active: new Map(), expired: [] };
  }
}

function runAudit() {
  try {
    const out = execSync('npm audit --omit=dev --json', { cwd: AUDIT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) {
    // npm audit exits non-zero when vulnerabilities exist; its JSON is still on stdout.
    const out = e?.stdout?.toString() ?? '';
    try { return JSON.parse(out); } catch { console.error('[gate] could not parse npm audit output'); process.exit(2); }
  }
}

const { active, expired } = loadExceptions();
const audit = runAudit();
const vulns = audit.vulnerabilities ?? {};

const blocking = [];   // must fail the build
const allowed = [];    // covered by a valid exception (tracked)
for (const [name, v] of Object.entries(vulns)) {
  const rank = SEV_RANK[v.severity] ?? 0;
  if (rank < SEV_RANK.high) continue;                 // only High/Critical gate (Moderate/Low = warn)
  const exc = active.get(name);
  if (v.severity === 'critical') { blocking.push({ name, severity: v.severity, reason: 'critical is never excepted' }); continue; }
  if (exc && rank <= exc.maxRank) { allowed.push({ name, severity: v.severity, expiry: exc.expiry }); continue; }
  blocking.push({ name, severity: v.severity, reason: expired.includes(name) ? 'exception EXPIRED' : 'no exception' });
}

const m = audit.metadata?.vulnerabilities ?? {};
console.log(`[gate] production audit: total=${m.total} critical=${m.critical} high=${m.high} moderate=${m.moderate} low=${m.low}`);
if (allowed.length) {
  console.log('[gate] allowed by time-limited exception (tracked):');
  for (const a of allowed) console.log(`   - ${a.name} (${a.severity}) until ${a.expiry}`);
}
if (blocking.length) {
  console.error('[gate] BLOCKING production findings (no valid exception):');
  for (const b of blocking) console.error(`   ✗ ${b.name} (${b.severity}) — ${b.reason}`);
  console.error('[gate] FAIL — remediate or add a time-limited, evidence-based exception.');
  process.exit(1);
}
console.log('[gate] PASS — no un-excepted production High/Critical vulnerabilities.');
process.exit(0);
