// M1B-P1 — regression for the Step 11 "No Demo seed / simulation subsystem" cron check.
// Proves the fixed verification is safe when pg_cron is absent and still fails closed when
// pg_cron jobs exist. Runs the REAL DO block extracted from the apply workflow.
//
// Non-mutating: every case runs inside a transaction that is ROLLED BACK.
// Gated: PILOT_HARDENING_TEST_DATABASE_URL (admin DSN on a DISPOSABLE Postgres 17 server;
// db name must follow the disposable convention) + SAFEBET_DISPOSABLE_TEST_DB=1. Unset => SKIP.
// Run: node --test tests/pilotCronVerification.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDisposableDb } from './_disposableDbGuard.mjs';

const DSN = process.env.PILOT_HARDENING_TEST_DATABASE_URL;
const skip = DSN ? false : 'PILOT_HARDENING_TEST_DATABASE_URL not set (disposable Postgres 17 only)';

// Extract the exact `do $$ ... end $$;` block from Step 11 of the reviewed apply workflow.
const WF = readFileSync(new URL('../../.github/workflows/pilot-m1b-baseline-apply.yml', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
function step11DoBlock() {
  const i = WF.indexOf('- name: 11 · No Demo seed / simulation subsystem');
  assert.ok(i >= 0, 'Step 11 present');
  const seg = WF.slice(i, WF.indexOf('- name: 12 ·', i));
  const m = seg.match(/do \$\$[\s\S]*?end \$\$;/);
  assert.ok(m, 'Step 11 DO block found');
  // The workflow indents the heredoc body; strip the common leading indentation.
  return m[0].split('\n').map((l) => l.replace(/^\s{10,14}/, '')).join('\n');
}
const DO = step11DoBlock();

async function client() {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c;
}

test('step 11 DO block references cron.job only via dynamic EXECUTE', { skip }, () => {
  assert.match(DO, /to_regclass\('cron\.job'\) is not null/);
  assert.match(DO, /execute 'select count\(\*\) from cron\.job' into n/);
  assert.ok(!/exists\s*\(\s*select\s+1\s+from\s+cron\.job\s*\)/i.test(DO), 'no static cron.job reference');
});

test('CASE A: pg_cron absent => verification PASSES (cron_jobs = 0)', { skip }, async () => {
  assertDisposableDb(DSN);
  const c = await client();
  try {
    await c.query('begin');
    // Fresh Pilot has no cron schema/table.
    const reg = await c.query("select to_regclass('cron.job') is null as absent");
    assert.equal(reg.rows[0].absent, true, 'cron.job absent in the fixture');
    await assert.doesNotReject(c.query(DO), 'verification must pass when pg_cron is absent');
  } finally {
    await c.query('rollback').catch(() => {});
    await c.end();
  }
});

test('CASE B: pg_cron present with >=1 job => verification FAILS CLOSED', { skip }, async () => {
  assertDisposableDb(DSN);
  const c = await client();
  try {
    await c.query('begin');
    await c.query('create schema if not exists cron');
    await c.query('create table if not exists cron.job (jobid bigint primary key, jobname text)');
    await c.query("insert into cron.job(jobid, jobname) values (1, 'sbiq-financial-rollup-refresh')");
    await assert.rejects(c.query(DO), /pg_cron jobs present in a fresh Pilot/,
      'verification must fail closed when a cron job exists');
  } finally {
    await c.query('rollback').catch(() => {});
    await c.end();
  }
});
