// UAT-OP-3 P1-B — Self-Exclusion is an authenticated Operator module, not marketing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appShell = readFileSync(join(root, 'components', 'AppShell.tsx'), 'utf8');
const pagePath = join(root, 'app', 'casino', 'self-exclusion', 'page.tsx');

test('operator nav points Self-Exclusion at the authenticated route, not the marketing page', () => {
  const line = appShell.split('\n').find((l) => l.includes("title: 'Self-Exclusion'"));
  assert.ok(line, 'Self-Exclusion nav entry exists');
  assert.match(line, /\/casino\/self-exclusion/);
  assert.doesNotMatch(line, /features\/self-exclusion-network/);
  assert.match(line, /'casino_admin'/);
});

test('no operator nav entry routes to the marketing self-exclusion page', () => {
  const navLines = appShell.split('\n').filter((l) => /href:\s*'\//.test(l));
  for (const l of navLines) assert.doesNotMatch(l, /features\/self-exclusion-network/);
});

test('authenticated self-exclusion route exists and uses AppShell + guard', () => {
  assert.ok(existsSync(pagePath), 'app/casino/self-exclusion/page.tsx exists');
  const page = readFileSync(pagePath, 'utf8');
  assert.match(page, /DashboardLayout/);
  assert.match(page, /CasinoAdminGuard/);
});

test('self-exclusion data is scoped to the operator casino (RLS + explicit filter) and read-only', () => {
  const page = readFileSync(pagePath, 'utf8');
  assert.match(page, /from\(['"]self_exclusions['"]\)/);
  assert.match(page, /\.eq\(['"]casino_id['"],\s*casinoId\)/);
  // read-only: no write verbs against the table
  assert.doesNotMatch(page, /\.(insert|update|delete|upsert)\(/);
  // honest empty state, no fabricated records
  assert.match(page, /No active self-exclusions found/i);
});

test('search + status filter are present', () => {
  const page = readFileSync(pagePath, 'utf8');
  assert.match(page, /statusFilter/);
  assert.match(page, /Search/);
});
