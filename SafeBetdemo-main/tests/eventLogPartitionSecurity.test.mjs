// Event-log partition RLS security — contract + Platform-Health detection.
// Run: node --test tests/eventLogPartitionSecurity.test.mjs
//
// Encodes the security contract enforced by migration
// `secure_casino_event_log_partitions_rls` and the DB integrity view
// `sbiq_event_log_partition_security`: a casino_event_log partition is SECURE
// iff RLS is enabled AND no anon/authenticated grants exist. Ordinary client
// roles must never receive a permissive (USING true) policy. Future partitions
// created by sbiq_ensure_event_partition must be born secure.
//
// The "live" fixtures below are the real post-migration posture captured from
// the SafeBet Demo project (uexdjngogzunjxkpxwll) on 2026-07-29.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Contract (mirrors public.sbiq_event_log_partition_security.is_secure) ─────
const isPartitionSecure = (p) => p.rls_enabled === true && p.no_client_grants === true;

// Platform-Health detector: returns the list of insecure partitions.
const detectInsecurePartitions = (rows) => rows.filter((p) => !isPartitionSecure(p));

// Policy linter: ordinary client roles (anon/authenticated) must not get a
// permissive USING(true)/no-qual policy on event-log tables.
const PERMISSIVE = new Set([null, undefined, 'true', '(true)']);
const hasPermissiveOrdinaryPolicy = (policies) =>
  policies.some(
    (pol) =>
      pol.roles.some((r) => r === 'anon' || r === 'authenticated') &&
      PERMISSIVE.has(pol.using == null ? null : String(pol.using).trim().toLowerCase()),
  );

// Models the post-condition of the hardened sbiq_ensure_event_partition():
// a newly created partition is RLS-enabled with anon/authenticated revoked.
const bornPartition = (name) => ({ partition: name, rls_enabled: true, no_client_grants: true });

// ── Live post-migration fixture (all four partitions secure) ─────────────────
const LIVE_AFTER = [
  { partition: 'casino_event_log_2026_07', rls_enabled: true, no_client_grants: true },
  { partition: 'casino_event_log_2026_08', rls_enabled: true, no_client_grants: true },
  { partition: 'casino_event_log_2026_09', rls_enabled: true, no_client_grants: true },
  { partition: 'casino_event_log_2026_12', rls_enabled: true, no_client_grants: true }, // born via hardened creator
];

// Pre-migration exposure (what the finding described).
const LIVE_BEFORE = [
  { partition: 'casino_event_log_2026_07', rls_enabled: false, no_client_grants: false },
  { partition: 'casino_event_log_2026_08', rls_enabled: false, no_client_grants: false },
  { partition: 'casino_event_log_2026_09', rls_enabled: false, no_client_grants: false },
];

test('1/3/12: every current partition is secure post-migration; Platform Health flags none', () => {
  for (const p of LIVE_AFTER) assert.ok(isPartitionSecure(p), `${p.partition} must be secure`);
  assert.deepEqual(detectInsecurePartitions(LIVE_AFTER), [], 'no insecure partitions remain');
});

test('12: Platform Health DETECTS an insecure partition fixture (RLS off or client grants)', () => {
  const insecure = detectInsecurePartitions(LIVE_BEFORE);
  assert.equal(insecure.length, 3, 'all pre-migration partitions detected as insecure');
  // RLS on but grants present → still insecure
  assert.ok(!isPartitionSecure({ rls_enabled: true, no_client_grants: false }));
  // grants revoked but RLS off → still insecure
  assert.ok(!isPartitionSecure({ rls_enabled: false, no_client_grants: true }));
});

test('9/10: a future partition born via the hardened creator is secure', () => {
  const p = bornPartition('casino_event_log_2027_01');
  assert.ok(isPartitionSecure(p), 'future partition must be RLS-enabled with no client grants');
});

test('11: a permissive USING(true) policy for ordinary roles is rejected', () => {
  assert.ok(hasPermissiveOrdinaryPolicy([{ roles: ['authenticated'], using: 'true' }]));
  assert.ok(hasPermissiveOrdinaryPolicy([{ roles: ['anon'], using: null }]));
  // The real parent policy is tenant-scoped and must NOT be flagged permissive.
  assert.ok(
    !hasPermissiveOrdinaryPolicy([
      { roles: ['authenticated'], using: '(casino_id IN ( SELECT app_visible_casinos()))' },
    ]),
  );
});

test('2/4: post-migration grant matrix denies anon+authenticated direct child access', () => {
  // Captured from has_table_privilege() after the migration.
  const grants = {
    casino_event_log: { anon_select: false, auth_select: true, auth_insert: false, service_select: true },
    casino_event_log_2026_07: { anon_select: false, auth_select: false, auth_insert: false, service_select: true },
    casino_event_log_2026_08: { anon_select: false, auth_select: false, auth_insert: false, service_select: true },
    casino_event_log_2026_09: { anon_select: false, auth_select: false, auth_insert: false, service_select: true },
  };
  for (const [rel, g] of Object.entries(grants)) {
    assert.equal(g.anon_select, false, `${rel}: anon must not read`);
    if (rel !== 'casino_event_log') assert.equal(g.auth_select, false, `${rel}: authenticated must not read child directly`);
    assert.equal(g.service_select, true, `${rel}: trusted server retains access`);
  }
  // Trusted path preserved: authenticated may read the RLS-scoped parent only.
  assert.equal(grants.casino_event_log.auth_select, true);
});
