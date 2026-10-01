// SafeBet IQ — B4.1 migration file static assertions (SCHEMA group, runnable without a DB).
// Verifies the forward migration encodes EXACTLY the approved Revision 3.4 design.
//   node --test tests/protectionAlertsMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', 'supabase', 'migrations', '20261001120000_b4_1_player_protection_alerts.sql'), 'utf8');
const lower = SQL.toLowerCase();
// Executable SQL with `-- ...` line comments stripped (for negative-presence checks
// that must not be tripped by explanatory comment prose).
const code = lower.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
// Column block = text from the CREATE TABLE to the first standalone ');'
const tableBlock = lower.slice(lower.indexOf('create table public.player_protection_alerts'), lower.indexOf('\n);'));

test('fail-closed DDL: plain CREATE, no IF NOT EXISTS / CREATE OR REPLACE', () => {
  assert.ok(/create table public\.player_protection_alerts \(/.test(lower));
  assert.ok(!/create table if not exists player_protection_alerts/.test(lower));
  assert.ok(!/create or replace function/.test(lower));
});

test('exactly the two persisted alert types; excluded rules are NOT persisted types', () => {
  assert.ok(/check \(alert_type in \('self_exclusion_breach_review','intervention_follow_up_overdue'\)\)/.test(lower));
  for (const ex of ['current_higher_risk_review', 'intervention_completeness_review', 'self_exclusion_expiry_review']) {
    assert.ok(!lower.includes(ex), `excluded rule ${ex} must not appear in the migration`);
  }
});

test('no source_fingerprint, no severity column, no resolution_note on the table', () => {
  assert.ok(!SQL.includes('source_fingerprint'));
  assert.ok(!tableBlock.includes('severity'));        // severity appears only in the audit_events insert, not as a column
  assert.ok(!tableBlock.includes('resolution_note'));
  assert.ok(!SQL.includes('resolution_note'));
});

test('rule_version is non-empty provenance and NOT part of any unique identity index', () => {
  assert.ok(/rule_version\s+text not null check \(length\(btrim\(rule_version\)\) > 0\)/.test(lower));
  // identity indexes key ONLY on the typed source id, filtered by alert_type — never on rule_version
  assert.ok(/create unique index ppa_identity_self_exclusion\s+on public\.player_protection_alerts \(self_exclusion_id\)\s+where alert_type = 'self_exclusion_breach_review'/.test(lower));
  assert.ok(/create unique index ppa_identity_intervention\s+on public\.player_protection_alerts \(intervention_id\)\s+where alert_type = 'intervention_follow_up_overdue'/.test(lower));
  assert.ok(!/create unique index[^;]*rule_version/.test(lower));
});

test('id + identity + evidence + generation are immutable on UPDATE', () => {
  assert.ok(/new\.id\s+is distinct from old\.id/.test(lower));
  assert.ok(/new\.evidence\s+is distinct from old\.evidence/.test(lower));
  assert.ok(/new\.generated_by\s+is distinct from old\.generated_by/.test(lower));
});

test('DB owns timestamps and re-proves eligibility + generates evidence', () => {
  assert.ok(/new\.generated_at := now\(\)/.test(lower));
  assert.ok(/new\.acknowledged_at := now\(\)/.test(lower));
  assert.ok(/new\.resolved_at := now\(\)/.test(lower));
  assert.ok(/new\.evidence := jsonb_build_object/.test(lower));          // evidence DB-generated
  assert.ok(/v_se_status is distinct from 'breached'/.test(lower));       // Rule A re-proof
  assert.ok(/v_fud < \(now\(\) at time zone 'africa\/johannesburg'\)::date/.test(lower)); // Rule C strict SAST
});

test('OPEN->RESOLVED cannot fabricate acknowledgement (attribution transition-gated)', () => {
  assert.ok(/acknowledgement attribution may change only on open->acknowledged/.test(lower));
  assert.ok(/resolution attribution may change only on ->resolved/.test(lower));
});

test('audit emits into the EXISTING chain with actor as uuid (user_id uuid contract)', () => {
  assert.ok(/insert into public\.audit_events/.test(lower));
  assert.ok(/'player_protection_alert', new\.id::text, v_actor, v_role, new\.casino_id/.test(lower)); // actor uuid, not ::text
  assert.ok(lower.includes("'protection_alert.generated'"));
  assert.ok(lower.includes("'protection_alert.acknowledged'"));
  assert.ok(lower.includes("'protection_alert.resolved'"));
});

test('access model: RLS enabled+forced, service_role-only, no DELETE, no PUBLIC/anon/authenticated', () => {
  assert.ok(/enable row level security/.test(lower));
  assert.ok(/force\s+row level security/.test(lower));
  assert.ok(/revoke all on public\.player_protection_alerts from public/.test(lower));
  assert.ok(/revoke all on public\.player_protection_alerts from anon/.test(lower));
  assert.ok(/revoke all on public\.player_protection_alerts from authenticated/.test(lower));
  assert.ok(/grant select, insert, update on public\.player_protection_alerts to service_role/.test(lower));
  assert.ok(!/grant[^;]*delete[^;]*player_protection_alerts/.test(lower));
});

test('no SECURITY DEFINER anywhere; functions revoke EXECUTE from PUBLIC', () => {
  assert.ok(!/security definer/.test(code));   // comment-stripped: no definer-rights function
  assert.ok(/revoke all on function public\.sbiq_ppa_validate\(\) from public/.test(lower));
  assert.ok(/revoke all on function public\.sbiq_ppa_audit\(\) from public/.test(lower));
  assert.ok(/set search_path = pg_catalog, public/.test(lower));
});

test('both triggers present (validate BEFORE, audit AFTER)', () => {
  assert.ok(/create trigger trg_ppa_validate\s+before insert or update/.test(lower));
  assert.ok(/create trigger trg_ppa_audit\s+after insert or update/.test(lower));
});

test('no auto-executing rollback/DROP embedded in the forward migration', () => {
  assert.ok(!/drop table/.test(code));
  assert.ok(!/\bcascade\b/.test(code));
});

test('federation isolation: no B4.1 source references dormant cross-operator objects', () => {
  const files = [
    'lib/responsibleProfitability/alerts.ts',
    'lib/responsibleProfitability/alertsServer.ts',
    'app/api/casino/protection-alerts/route.ts',
    'app/api/casino/protection-alerts/evaluate/route.ts',
    'app/api/casino/protection-alerts/[id]/acknowledge/route.ts',
    'app/api/casino/protection-alerts/[id]/resolve/route.ts',
    'app/casino/responsible-profitability/alerts/page.tsx',
    'supabase/migrations/20261001120000_b4_1_player_protection_alerts.sql',
  ];
  const forbidden = ['cross_operator_alerts', 'cross_operator_signal_log', 'player_pseudonym_tokens'];
  for (const f of files) {
    const txt = readFileSync(join(here, '..', ...f.split('/')), 'utf8').toLowerCase();
    for (const term of forbidden) assert.ok(!txt.includes(term), `${f} must not reference dormant ${term}`);
  }
});
