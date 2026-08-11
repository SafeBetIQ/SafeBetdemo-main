// AUD-P1-006 / AUD-P1-008 — proves the CI secret scanner flags a hard-coded
// CLAUDE_BRIDGE_KEY literal and does NOT flag the approved env-var reference.
// IMPORTANT: every "secret" below is a synthetic placeholder — NEVER a real key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { scanText, scanLine } from '../scripts/ci/secret-rules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('FLAGS a hard-coded CLAUDE_BRIDGE_KEY literal (export form)', () => {
  const found = scanLine('export CLAUDE_BRIDGE_KEY="PLACEHOLDERnotarealkey0123456789abcd"');
  assert.ok(found.includes('hard-coded CLAUDE_BRIDGE_KEY literal'), 'export literal must be flagged');
});

test('FLAGS a hard-coded CLAUDE_BRIDGE_KEY literal (PowerShell $env form)', () => {
  const found = scanLine('$env:CLAUDE_BRIDGE_KEY="PLACEHOLDERnotarealkey0123456789abcd"');
  assert.ok(found.includes('hard-coded CLAUDE_BRIDGE_KEY literal'));
});

test('FLAGS a hard-coded CLAUDE_BRIDGE_KEY literal (JS object / assignment form)', () => {
  const found = scanLine("const key = { CLAUDE_BRIDGE_KEY: 'PLACEHOLDERnotarealkey0123456789abcd' }");
  assert.ok(found.includes('hard-coded CLAUDE_BRIDGE_KEY literal'));
});

test('DOES NOT flag the approved env-var reference', () => {
  assert.deepEqual(scanLine('const key = process.env.CLAUDE_BRIDGE_KEY;'), []);
  assert.deepEqual(scanLine('  Authorization: `Bearer ${process.env.CLAUDE_BRIDGE_KEY}`,'), []);
  assert.deepEqual(scanLine('if (!process.env.CLAUDE_BRIDGE_KEY) fail("config");'), []);
});

test('DOES NOT flag a documented placeholder', () => {
  assert.deepEqual(scanLine('$env:CLAUDE_BRIDGE_KEY="<secure value entered by the user>"'), []);
});

test('FLAGS a literal Bearer credential', () => {
  const found = scanLine('Authorization: "Bearer PLACEHOLDERnotarealbearertoken0123456789"');
  assert.ok(found.includes('literal Bearer credential'));
});

test('the planted fixture file is detected by scanText', () => {
  const fixture = readFileSync(path.join(HERE, 'fixtures', 'secret-scan', 'bad-bridge-key.txt'), 'utf8');
  const findings = scanText(fixture);
  assert.ok(findings.some((f) => f.label === 'hard-coded CLAUDE_BRIDGE_KEY literal'),
    'fixture with a planted literal must be flagged');
});

test('the safe fixture file is NOT detected by scanText', () => {
  const fixture = readFileSync(path.join(HERE, 'fixtures', 'secret-scan', 'good-env-ref.txt'), 'utf8');
  assert.deepEqual(scanText(fixture), [], 'env-ref-only fixture must be clean');
});
