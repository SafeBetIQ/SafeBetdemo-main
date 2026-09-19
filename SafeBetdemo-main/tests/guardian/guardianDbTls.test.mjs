// SafeBet Guardian — CA-validated PostgreSQL TLS (ARCH-V4-PR2). Offline unit tests.
//   node --test tests/guardian/guardianDbTls.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { guardianDbSsl, guardianPgSsl, assertNoInsecureTls, InsecureTlsForbiddenError } from '../../products/guardian/src/db/tls.ts';

test('ssl config always sets rejectUnauthorized:true + TLS1.2 minimum', () => {
  const s = guardianDbSsl({ env: {} });
  assert.equal(s.rejectUnauthorized, true);
  assert.equal(s.minVersion, 'TLSv1.2');
});

test('hostname is set as servername for SAN verification', () => {
  const s = guardianDbSsl({ host: 'aws-0-eu-west-1.pooler.supabase.com', env: {} });
  assert.equal(s.servername, 'aws-0-eu-west-1.pooler.supabase.com');
});

test('NODE_TLS_REJECT_UNAUTHORIZED=0 is refused', () => {
  assert.throws(() => guardianDbSsl({ env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' } }), InsecureTlsForbiddenError);
  assert.throws(() => assertNoInsecureTls({ NODE_TLS_REJECT_UNAUTHORIZED: '0' }), InsecureTlsForbiddenError);
});

test('sslmode=no-verify is refused', () => {
  assert.throws(() => guardianDbSsl({ env: { GUARDIAN_DB_SSL_MODE: 'no-verify' } }), InsecureTlsForbiddenError);
});

test('inline CA PEM is honoured', () => {
  const pem = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';
  const s = guardianDbSsl({ env: { GUARDIAN_DB_CA_PEM: pem } });
  assert.equal(s.ca, pem);
  assert.equal(s.rejectUnauthorized, true);
});

test('a non-PEM CA bundle path is refused (no silent insecure fallback)', () => {
  // A bundle env pointing at a non-existent/non-PEM file must throw, never downgrade.
  assert.throws(() => guardianDbSsl({ env: { GUARDIAN_DB_CA_BUNDLE: 'Z:/does/not/exist.pem' } }));
});

test('guardianPgSsl mirrors guardianDbSsl', () => {
  const a = guardianPgSsl('h'); assert.equal(a.rejectUnauthorized, true); assert.equal(a.servername, 'h');
});

test('the TLS module never assigns an insecure config literal', () => {
  const src = readFileSync('products/guardian/src/db/tls.ts', 'utf8');
  assert.ok(!/rejectUnauthorized\s*:\s*false/.test(src), 'no rejectUnauthorized:false');
  // Only the guard COMPARISON (=== "0") may reference the bypass; no ASSIGNMENT of it.
  assert.ok(!/NODE_TLS_REJECT_UNAUTHORIZED\s*=[^=]/.test(src), 'no NODE_TLS bypass assignment');
});

test('type contract: rejectUnauthorized is the literal true (cannot be false)', () => {
  // Structural: the returned object cannot carry rejectUnauthorized:false by construction.
  const s = guardianDbSsl({ env: {} });
  assert.notEqual(s.rejectUnauthorized, false);
});
