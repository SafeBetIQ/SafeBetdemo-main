// Phase 4.4 — operations: policy store, modes, monitoring, scheduled tasks.
// Run: node --test tests/operations.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadActivePolicyRules, toStoredRows } from '../lib/policyPlatform/store.ts';
import { PolicyRulesPlatform } from '../lib/policyPlatform/index.ts';
import { defaultConfiguration } from '../lib/policyPlatform/config/index.ts';
import {
  OPERATING_MODES, normalizeMode, operationalProfile,
  evaluateHealth, overallSeverity,
  ensurePartitions, assessProjectionIntegrity,
} from '../lib/operations/index.ts';

// ─── WS1 Policy store: config externalised, logic unchanged ───────────────────

function fakePolicyStore(rulesByActive) {
  return {
    calls: [],
    rpc(fn) {
      this.calls.push(fn);
      if (fn === 'sbiq_active_policy_rules') {
        return Promise.resolve({ data: rulesByActive, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

test('the store loads the active rule set and the platform evaluates it (logic unmoved)', async () => {
  const shipped = defaultConfiguration();
  const store = fakePolicyStore(shipped.map(r => r)); // definitions returned as jsonb rows
  const rules = await loadActivePolicyRules(store);
  assert.equal(rules.length, shipped.length);
  // The platform consumes store config through its existing configure() seam.
  const platform = new PolicyRulesPlatform([]);
  assert.equal(platform.policyCount, 0);
  platform.configure(rules);
  assert.equal(platform.policyCount, shipped.length);
});

test('an empty store returns null so callers keep their current configuration', async () => {
  assert.equal(await loadActivePolicyRules(fakePolicyStore([])), null);
});

test('stored rows carry the full definition plus indexed columns', () => {
  const rows = toStoredRows(1, defaultConfiguration());
  assert.equal(rows.length, defaultConfiguration().length);
  const za = rows.find(r => r.policy_id === 'ZA-RG-001');
  assert.equal(za.policy_set_version, 1);
  assert.equal(za.scope, 'jurisdiction');
  assert.equal(za.jurisdiction, 'ZA');
  assert.equal(za.applies_to, 'player');
  assert.equal(za.definition.policyReference.length > 0, true);
});

test('malformed stored rules are rejected on load (reject-not-repair)', async () => {
  const store = fakePolicyStore([{ policyId: 'X', scope: 'bogus' }]);
  await assert.rejects(() => loadActivePolicyRules(store), /unknown scope/);
});

test('policy versioning is a data operation — a new rule set changes decisions without code', async () => {
  const platform = new PolicyRulesPlatform([]);
  platform.configure(await loadActivePolicyRules(fakePolicyStore(defaultConfiguration())));
  const before = platform.policyCount;
  // "Rollback" to a smaller version = configure a different stored set.
  platform.configure(await loadActivePolicyRules(fakePolicyStore(defaultConfiguration().slice(0, 3))));
  assert.equal(platform.policyCount, 3);
  assert.notEqual(platform.policyCount, before);
});

// ─── WS2 Operational modes: never change business rules ───────────────────────

test('modes resolve and expose operational (not business) knobs', () => {
  assert.deepEqual([...OPERATING_MODES], ['development', 'demonstration', 'staging', 'production']);
  assert.equal(normalizeMode('PRODUCTION'), 'production');
  assert.equal(normalizeMode('nonsense'), 'demonstration'); // safe default
  const prod = operationalProfile('production');
  const demo = operationalProfile('demonstration');
  assert.equal(prod.simulatorEnabled, false);
  assert.equal(demo.simulatorEnabled, true);
  assert.ok(prod.lagCriticalSeconds < demo.lagCriticalSeconds, 'production alerts stricter');
  assert.equal(prod.demoDataAllowed, false);
});

// ─── WS4 Monitoring: alerts on meaningful operational conditions only ─────────

const healthy = {
  casino_id: 'c', events_in_log: 100, distinct_players: 10, players_projected: 10,
  sessions_projected: 8, machines_projected: 9, last_event_at: new Date().toISOString(),
  projection_lag_seconds: 5, max_row_version: 3,
};

test('a healthy snapshot raises no alerts', () => {
  assert.deepEqual(evaluateHealth(healthy, operationalProfile('production')), []);
});

test('projection lag crosses warning then critical by mode threshold', () => {
  const warn = evaluateHealth({ ...healthy, projection_lag_seconds: 45 }, operationalProfile('production'));
  assert.equal(warn[0].code, 'PROJECTION_LAG_WARNING');
  const crit = evaluateHealth({ ...healthy, projection_lag_seconds: 200 }, operationalProfile('production'));
  assert.equal(crit[0].severity, 'critical');
  // Same lag is fine in demonstration (looser thresholds) — ops knob, not business.
  assert.deepEqual(evaluateHealth({ ...healthy, projection_lag_seconds: 45 }, operationalProfile('demonstration')), []);
});

test('projection drift is detected (rebuild advised)', () => {
  const alerts = evaluateHealth({ ...healthy, distinct_players: 10, players_projected: 7 }, operationalProfile('production'));
  assert.ok(alerts.some(a => a.code === 'PROJECTION_DRIFT'));
  assert.equal(overallSeverity(alerts), 'warning');
});

test('ingestion stall detected on an active casino with stale events', () => {
  const stale = new Date(Date.now() - 3600_000).toISOString();
  const alerts = evaluateHealth({ ...healthy, last_event_at: stale }, operationalProfile('production'));
  assert.ok(alerts.some(a => a.code === 'INGESTION_STALL'));
});

// ─── WS3 Scheduled tasks: orchestrate existing capabilities ───────────────────

test('ensurePartitions calls the platform partition function per month', async () => {
  const calls = [];
  const client = { rpc(fn, args) { calls.push({ fn, args }); return Promise.resolve({ data: 'part', error: null }); } };
  const result = await ensurePartitions(client, 2);
  assert.equal(result.ok, true);
  assert.equal(calls.filter(c => c.fn === 'sbiq_ensure_event_partition').length, 3); // current + 2
});

test('projection integrity assessment recommends rebuild only on drift', () => {
  assert.equal(assessProjectionIntegrity({ distinct_players: 10, players_projected: 10 }).ok, true);
  const drift = assessProjectionIntegrity({ distinct_players: 10, players_projected: 6 });
  assert.equal(drift.ok, false);
  assert.equal(drift.detail.rebuild_advised, true);
});
