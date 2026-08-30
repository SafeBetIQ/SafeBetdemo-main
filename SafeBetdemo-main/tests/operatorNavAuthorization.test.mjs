// UAT-OP-1 P1-5/P1-4 — operator navigation authorization invariants (source-level).
// The nav config is declared inline in components/AppShell.tsx; these static checks
// pin the security-relevant role assignments so a regression is caught in CI. The
// live route guard in app/admin/security/page.tsx is the enforcing control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appShell = readFileSync(join(root, 'components', 'AppShell.tsx'), 'utf8');
const securityPage = readFileSync(join(root, 'app', 'admin', 'security', 'page.tsx'), 'utf8');

function navLine(title) {
  return appShell.split('\n').find((l) => l.includes(`title: '${title}'`)) ?? '';
}

test('Security Audit Log is NOT navigable by casino_admin (operator)', () => {
  const line = navLine('Security Audit Log');
  assert.ok(line, 'Security Audit Log nav entry exists');
  assert.doesNotMatch(line, /'casino_admin'/, 'casino_admin must not be listed for the Security Audit Log');
  assert.match(line, /'super_admin'/);
  assert.match(line, /'compliance_officer'/);
});

test('Security Audit Log route enforces the restriction server-side (not just nav)', () => {
  assert.match(securityPage, /SECURITY_LOG_ROLES/);
  assert.match(securityPage, /super_admin/);
  assert.match(securityPage, /compliance_officer/);
  // an unauthorised role is denied before the data-fetching inner component mounts
  assert.match(securityPage, /Access restricted/i);
  assert.match(securityPage, /SecurityAuditLogInner/);
});

test('Self-Exclusion is reachable from the operator workflow (authenticated route)', () => {
  // UAT-OP-3 (P1-B): the entry now targets the authenticated /casino/self-exclusion
  // module, not the marketing /features/self-exclusion-network page.
  const line = navLine('Self-Exclusion');
  assert.ok(line, 'Self-Exclusion nav entry exists in AppShell');
  assert.match(line, /'casino_admin'/);
  assert.match(line, /\/casino\/self-exclusion/);
  assert.doesNotMatch(line, /features\/self-exclusion-network/);
});
