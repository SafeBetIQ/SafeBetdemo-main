#!/usr/bin/env node
// SafeBet IQ — privileged-function future-regression guard (ARCH-V4-A5.5).
//
// Prevents future migrations from silently reintroducing broad privileged
// execution after the A5 hardening baseline. STATIC scan of SQL migration text —
// no database credentials required, deterministic, safe to run in CI.
//
// It fails (exit 1) when a migration whose version is GREATER than the recorded
// baseline version:
//   (a) GRANTs EXECUTE on a function to PUBLIC or anon, and the function is not in
//       the explicit allowlist (currently only the RLS predicate
//       sbiq_may_access_chain_scope); or
//   (b) creates a SECURITY DEFINER function without pinning an explicit
//       SET search_path.
//
// Pre-baseline history is grandfathered (the A5 batches already hardened it).
//
//   node scripts/ci/privfn-guard.mjs
//
// Exposed to CI as: npm run ci:privfn

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const BASELINE_PATH = path.join(ROOT, 'security', 'privileged-function-baseline.json');

export function loadBaseline(baselinePath = BASELINE_PATH) {
  const cfg = JSON.parse(readFileSync(baselinePath, 'utf8'));
  return {
    baselineVersion: String(cfg.baselineMigrationVersion),
    allowlist: new Set((cfg.publicAnonExecuteAllowlist ?? []).map((e) => e.function)),
  };
}

// Strip line (--) and block (/* */) comments so commented-out SQL never triggers.
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

function versionOf(filename) {
  const m = filename.match(/^(\d+)_/);
  return m ? m[1] : null;
}

// Analyse one migration's SQL body. Pure — returns an array of violation strings.
export function analyzeMigrationSql(sql, { allowlist }) {
  const violations = [];
  const clean = stripSqlComments(sql);

  // (a) GRANT EXECUTE ... ON [FUNCTION] <name>(...) TO ... public|anon ...
  const grantRe = /grant\s+execute\s+on\s+(?:function\s+)?([a-z0-9_.]+)\s*\([^)]*\)\s+to\s+([^;]+);/gis;
  let g;
  while ((g = grantRe.exec(clean)) !== null) {
    const fnName = g[1].split('.').pop().toLowerCase();
    const grantees = g[2].toLowerCase();
    const hitsPublic = /\bpublic\b/.test(grantees);
    const hitsAnon = /\banon\b/.test(grantees);
    if ((hitsPublic || hitsAnon) && !allowlist.has(fnName)) {
      violations.push(
        `GRANT EXECUTE to ${hitsPublic ? 'PUBLIC' : ''}${hitsPublic && hitsAnon ? '/' : ''}${hitsAnon ? 'anon' : ''} on '${fnName}' (not in allowlist)`,
      );
    }
  }

  // (b) CREATE [OR REPLACE] FUNCTION ... SECURITY DEFINER without SET search_path.
  // Scan each create-function statement's header region up to the body delimiter.
  const createRe = /create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_.]+)\s*\(/gis;
  let c;
  while ((c = createRe.exec(clean)) !== null) {
    const fnName = c[1].split('.').pop().toLowerCase();
    // Header = from the CREATE up to the first body delimiter ($$ or AS ').
    const rest = clean.slice(c.index);
    const bodyDelim = rest.search(/\$[a-z_]*\$|\bas\s+'/i);
    const header = bodyDelim === -1 ? rest.slice(0, 2000) : rest.slice(0, bodyDelim);
    if (/security\s+definer/i.test(header) && !/set\s+search_path/i.test(header)) {
      violations.push(`SECURITY DEFINER function '${fnName}' created without an explicit SET search_path`);
    }
  }

  return violations;
}

export function scanMigrations({ migrationsDir = MIGRATIONS_DIR, baselinePath = BASELINE_PATH } = {}) {
  const { baselineVersion, allowlist } = loadBaseline(baselinePath);
  const findings = [];
  let files;
  try {
    files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return { findings, scanned: 0, baselineVersion };
  }
  let scanned = 0;
  for (const f of files) {
    const v = versionOf(f);
    if (!v || v <= baselineVersion) continue; // grandfather baseline + earlier history
    scanned += 1;
    const sql = readFileSync(path.join(migrationsDir, f), 'utf8');
    for (const msg of analyzeMigrationSql(sql, { allowlist })) {
      findings.push(`${f}: ${msg}`);
    }
  }
  return { findings, scanned, baselineVersion };
}

// CLI entry (only when run directly, not when imported by tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { findings, scanned, baselineVersion } = scanMigrations();
  if (findings.length > 0) {
    console.error(`[privfn-guard] FAIL — ${findings.length} privileged-function violation(s) in migrations after ${baselineVersion}:`);
    for (const f of findings) console.error(`  - ${f}`);
    console.error('[privfn-guard] Fix: revoke the PUBLIC/anon grant or add an approved allowlist entry with rationale; pin SET search_path on new SECURITY DEFINER functions.');
    process.exit(1);
  }
  console.log(`[privfn-guard] PASS — scanned ${scanned} post-baseline migration(s); no new PUBLIC/anon privileged grants or unpinned SECURITY DEFINER functions.`);
}
