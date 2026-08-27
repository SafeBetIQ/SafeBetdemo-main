// SEC-RPC-1 — static assertions on the certified-financial RPC privilege migration.
// The exposure is a database GRANT state, so full proof is the Demo live negative
// tests (anon/authenticated direct call -> denied). These CI-runnable checks pin the
// migration's INTENT so a regression (re-adding PUBLIC/anon/authenticated EXECUTE, or
// mutating the function body under this filename) is caught in source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase', 'migrations');
const file = readdirSync(migDir).find((f) => f.includes('sec_rpc_1_revoke_certified_posture_public_execute'));
const rawSql = readFileSync(join(migDir, file), 'utf8').toLowerCase();
// Assertions must reflect EXECUTABLE SQL, not the explanatory comments (which
// legitimately quote "security definer" and the old migration). Strip `-- …` lines.
const sql = rawSql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

const SIG = 'public.sbiq_certified_financial_posture_v2(uuid, timestamptz)';

test('migration exists', () => assert.ok(file, 'SEC-RPC-1 migration file present'));

test('revokes EXECUTE from public (the actual source of the grant)', () => {
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+public\.sbiq_certified_financial_posture_v2\(uuid,\s*timestamptz\)\s+from\s+public/);
});

test('revokes EXECUTE from anon', () => {
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+public\.sbiq_certified_financial_posture_v2\(uuid,\s*timestamptz\)\s+from\s+anon/);
});

test('revokes EXECUTE from authenticated', () => {
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+public\.sbiq_certified_financial_posture_v2\(uuid,\s*timestamptz\)\s+from\s+authenticated/);
});

test('grants/retains EXECUTE to service_role', () => {
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.sbiq_certified_financial_posture_v2\(uuid,\s*timestamptz\)\s+to\s+service_role/);
});

test('does NOT change the function body (no create/replace)', () => {
  assert.doesNotMatch(sql, /create\s+(or\s+replace\s+)?function/);
});

test('does NOT alter SECURITY DEFINER or drop the function', () => {
  assert.doesNotMatch(sql, /security\s+(definer|invoker)/);
  assert.doesNotMatch(sql, /drop\s+function/);
  assert.doesNotMatch(sql, /alter\s+function/);
});

test('does not touch unrelated functions (SEC-RPC-1 scope is the certified RPC only)', () => {
  // every REVOKE/GRANT line targets the certified posture function
  for (const line of sql.split('\n')) {
    if (/\b(revoke|grant)\b/.test(line)) {
      assert.ok(line.includes('sbiq_certified_financial_posture_v2'),
        `privilege statement must target only the certified RPC: ${line}`);
    }
  }
});

test('uses the exact resolved signature', () => {
  assert.ok(sql.includes(SIG), `migration must reference ${SIG}`);
});
