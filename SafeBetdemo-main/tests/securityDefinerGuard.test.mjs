// SEC-SD-1 — forward guardrail for SECURITY DEFINER privilege hygiene.
//
// Root cause of the certified-RPC exposure (SEC-RPC-1) and the wider estate finding:
// a freshly CREATEd function default-grants EXECUTE to PUBLIC, and revoking only
// `anon, authenticated` leaves that PUBLIC grant (which they inherit) intact. This
// test fails CI when a NEW migration defines a SECURITY DEFINER function without
// explicitly revoking EXECUTE from PUBLIC (or opting out in writing).
//
// LIMITATIONS (documented deliberately):
//  - This is a source heuristic, NOT a database check. It cannot see the live ACL.
//    The authoritative control is supabase/security/security_definer_estate_audit.sql.
//  - It grandfathers the pre-existing estate via a baseline file; those legacy
//    functions are tracked for remediation in docs/security/SEC-SD-1-estate-remediation.md,
//    not by this guard.
//  - It matches statements textually; a migration can still mis-scope a revoke. Pair
//    it with review + the live audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase', 'migrations');
const baseline = new Set(
  readFileSync(join(root, 'supabase', 'security', 'security_definer_baseline.txt'), 'utf8')
    .split('\n').map((l) => l.trim()).filter(Boolean),
);

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql'));

function stripComments(sql) {
  return sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
}

test('every NEW migration defining a SECURITY DEFINER function revokes EXECUTE from PUBLIC', () => {
  const offenders = [];
  for (const f of files) {
    if (baseline.has(f)) continue; // grandfathered legacy estate (tracked separately)
    const sql = stripComments(readFileSync(join(migDir, f), 'utf8')).toLowerCase();
    const definesSecDef = /create\s+(or\s+replace\s+)?function/.test(sql) && /security\s+definer/.test(sql);
    if (!definesSecDef) continue;
    // Opt-out for a deliberately PUBLIC-callable function (must be justified in the file).
    if (/sec-sd:\s*intentional-public-execute/.test(sql)) continue;
    const revokesPublic = /revoke\s+(execute|all)[\s\S]*?\bfrom\b[\s\S]*?\bpublic\b/.test(sql);
    if (!revokesPublic) offenders.push(f);
  }
  assert.deepEqual(
    offenders, [],
    `New SECURITY DEFINER migration(s) must "revoke execute on function … from public" `
    + `(or add a justified "-- sec-sd: intentional-public-execute" marker):\n  ${offenders.join('\n  ')}`,
  );
});

test('baseline file exists and is non-empty (grandfathered legacy estate)', () => {
  assert.ok(baseline.size > 0, 'security_definer_baseline.txt must list the pre-existing estate');
});
