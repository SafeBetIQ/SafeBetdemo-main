// Certified Audit Chain — independent verifier + SQL↔TS parity.
// Run: node --test tests/auditChain.test.mjs
//
// The fixture below is REAL data captured from the deployed SafeBet Demo chain
// (platform scope, sequences 1–2). The stored `hash` values were computed by the
// database (sbiq_audit_event_hash). These tests prove the independent TypeScript
// verifier recomputes byte-identical hashes (SQL↔TS parity) and detects tamper.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  canonicalJson, auditEventHash, verifyChain, AUDIT_GENESIS_HASH,
} from '../lib/consumerPlatform/index.ts';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// Live fixture (SafeBet Demo, platform chain).
const E1 = {
  chain_scope: 'platform', chain_sequence: 1, previous_hash: AUDIT_GENESIS_HASH,
  event_id: '70d7b41b-85cf-4faf-9a69-1bc96c0a8be8', event_type: 'user_login',
  user_id: 'a1b2c3d4-1111-1111-1111-000000000001', user_role: 'super_admin',
  casino_id: null, resource_type: null, resource_id: null, outcome: 'success',
  created_at: '2026-05-21 13:47:20.124606+00', correlation_id: null, metadata: { casino_id: null },
  hash: '881d5dbc66d4801c1e5602709b280124dc0100a734615fa766a961a268419733',
};
const E2 = {
  chain_scope: 'platform', chain_sequence: 2, previous_hash: E1.hash,
  event_id: '3ff4b448-70d3-4de8-8e3e-24bed02bf5da', event_type: 'user_login',
  user_id: 'a1b2c3d4-1111-1111-1111-000000000001', user_role: 'super_admin',
  casino_id: null, resource_type: null, resource_id: null, outcome: 'success',
  created_at: '2026-05-21 14:08:06.334472+00', correlation_id: null, metadata: { casino_id: null },
  hash: '2e94b3c3fa5d6d3b311be8069a8ed9df49eb9d3ad12d94f72480138f4f7749cf',
};

test('SQL↔TS parity: the TS verifier recomputes the database hashes exactly', () => {
  assert.equal(auditEventHash(E1, sha256), E1.hash, 'genesis event hash matches the DB');
  assert.equal(auditEventHash(E2, sha256), E2.hash, 'second event hash matches the DB');
});

test('genesis: the first event uses the documented all-zero previous hash', () => {
  assert.equal(E1.previous_hash, '0'.repeat(64));
});

test('a fully valid chain verifies', () => {
  const r = verifyChain('platform', [E1, E2], sha256, E2.hash);
  assert.equal(r.status, 'verified');
  assert.equal(r.eventsChecked, 2);
  assert.equal(r.expectedHead, E2.hash);
});

test('canonical JSON is key-order independent and matches the DB serialisation', () => {
  assert.equal(canonicalJson({ b: '2', a: '1' }), canonicalJson({ a: '1', b: '2' }));
  assert.equal(canonicalJson({ casino_id: null }), '{"casino_id":null}');
  assert.equal(canonicalJson({ x: 1, y: [3, 2] }), '{"x":"1","y":["3","2"]}');
});

test('tamper: changing a material field breaks verification', () => {
  const tampered = { ...E2, outcome: 'failure' }; // hash no longer matches
  const r = verifyChain('platform', [E1, tampered], sha256, E2.hash);
  assert.equal(r.status, 'broken');
  assert.equal(r.firstFailingSequence, 2);
  assert.equal(r.reason, 'recomputed hash mismatch');
});

test('tamper: changing metadata breaks verification', () => {
  const tampered = { ...E1, metadata: { casino_id: 'injected' } };
  assert.notEqual(auditEventHash(tampered, sha256), E1.hash);
});

test('tamper: reordering events breaks the previous-hash linkage', () => {
  const r = verifyChain('platform', [E2, E1], sha256);
  assert.equal(r.status, 'broken');
});

test('tamper: modifying the previous hash is detected', () => {
  const r = verifyChain('platform', [E1, { ...E2, previous_hash: '0'.repeat(64) }], sha256);
  assert.equal(r.status, 'broken');
  assert.equal(r.reason, 'previous_hash linkage broken');
});

test('tamper: a wrong chain head is detected even when links are intact', () => {
  const r = verifyChain('platform', [E1, E2], sha256, '0'.repeat(64));
  assert.equal(r.status, 'broken');
  assert.equal(r.reason, 'chain head mismatch');
});

test('deleting an event (sequence gap) is detected', () => {
  const r = verifyChain('platform', [E2], sha256); // E1 removed → seq starts at 2
  assert.equal(r.status, 'broken');
  assert.equal(r.reason, 'sequence gap or duplicate');
});
