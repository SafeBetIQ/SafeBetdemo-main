// ARCH-V4-A3 — Shared Platform Foundation audit contract + strangler extraction.
// Proves the audit-chain primitive now lives at @/lib/platform/audit (Shared
// Foundation owner), that the deprecated IQ path (consumerPlatform/auditChain) and
// the IQ facade (consumerPlatform) re-export the SAME functions with byte-identical
// output, and that no consumer's behaviour changed by the move.
//   node --test tests/platformAuditContract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import * as platform from '../lib/platform/audit/index.ts';
import * as deprecatedShim from '../lib/consumerPlatform/auditChain.ts';
import * as iqFacade from '../lib/consumerPlatform/index.ts';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// A representative valid two-event chain (built from the module itself).
function buildChain() {
  const base = {
    chain_scope: 'tenant:demo', event_type: 'TEST', user_id: 'u1', user_role: 'admin',
    casino_id: 'c1', resource_type: 'r', resource_id: 'r1', outcome: 'success',
    created_at: '2026-09-04T10:00:00.000Z', correlation_id: 'corr-1', metadata: { a: 1, b: [2, 3] },
  };
  const e1 = { ...base, chain_sequence: 1, event_id: 'e1', previous_hash: platform.AUDIT_GENESIS_HASH };
  e1.hash = platform.auditEventHash(e1, sha);
  const e2 = { ...base, chain_sequence: 2, event_id: 'e2', previous_hash: e1.hash };
  e2.hash = platform.auditEventHash(e2, sha);
  return [e1, e2];
}

test('governed platform module exposes the full audit contract', () => {
  for (const k of ['AUDIT_CHAIN_SCHEMA', 'AUDIT_GENESIS_HASH', 'canonicalJson', 'canonicalTimestamp', 'auditEventHash', 'verifyChain']) {
    assert.ok(platform[k] !== undefined, `platform exports ${k}`);
  }
  assert.equal(platform.AUDIT_CHAIN_SCHEMA, 'v1');
  assert.equal(platform.AUDIT_GENESIS_HASH, '0'.repeat(64));
});

test('governed module verifies a valid chain and detects tampering', () => {
  const chain = buildChain();
  assert.equal(platform.verifyChain('tenant:demo', chain, sha).status, 'verified');
  const tampered = structuredClone(chain);
  tampered[1].outcome = 'failure'; // hash no longer matches
  assert.equal(platform.verifyChain('tenant:demo', tampered, sha).status, 'broken');
});

test('deprecated IQ shim re-exports the SAME functions (byte-identical output)', () => {
  const chain = buildChain();
  // same hash from both paths
  assert.equal(deprecatedShim.auditEventHash(chain[0], sha), platform.auditEventHash(chain[0], sha));
  assert.equal(deprecatedShim.canonicalJson({ z: 1, a: 2 }), platform.canonicalJson({ z: 1, a: 2 }));
  assert.equal(deprecatedShim.AUDIT_GENESIS_HASH, platform.AUDIT_GENESIS_HASH);
  assert.equal(deprecatedShim.verifyChain('tenant:demo', chain, sha).status, 'verified');
});

test('IQ facade (consumerPlatform) now surfaces the governed audit contract', () => {
  const chain = buildChain();
  assert.equal(iqFacade.auditEventHash(chain[0], sha), platform.auditEventHash(chain[0], sha));
  assert.equal(iqFacade.AUDIT_CHAIN_SCHEMA, platform.AUDIT_CHAIN_SCHEMA);
});

test('strangler: IQ facade consumes the governed platform path (not the local file)', () => {
  const idx = readFileSync(new URL('../lib/consumerPlatform/index.ts', import.meta.url), 'utf8');
  assert.match(idx, /from '\.\.\/platform\/audit\/index\.ts'/);
  // the old shim is marked deprecated and only re-exports the platform module.
  const shim = readFileSync(new URL('../lib/consumerPlatform/auditChain.ts', import.meta.url), 'utf8');
  assert.match(shim, /@deprecated/);
  assert.match(shim, /platform\/audit/);
  assert.doesNotMatch(shim, /export function (auditEventHash|verifyChain)/); // impl moved, not duplicated
});
