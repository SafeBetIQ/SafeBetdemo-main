// SafeBet IQ — audit-chain tamper detection acceptance (real Postgres, disposable only).
// Assumes the application baseline is ALREADY applied to the target disposable DB (the baseline
// contains psql meta-commands and must be applied via psql, not node). Proves:
//   1. a freshly built synthetic chain verifies (status=verified);
//   2. ordinary mutation is blocked by trg_audit_events_immutable (immutability);
//   3. out-of-band tampering (test-only superuser trigger-disable) is DETECTED (status=broken).
// Gated by AUDIT_TAMPER_TEST_DATABASE_URL; MUST be disposable (guarded). Unset => SKIP.
//   SAFEBET_DISPOSABLE_TEST_DB=1 AUDIT_TAMPER_TEST_DATABASE_URL=postgres://... node --test tests/auditChainTamperDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDisposableDb } from './_disposableDbGuard.mjs';

const DSN = process.env.AUDIT_TAMPER_TEST_DATABASE_URL;
const skip = DSN ? false : 'AUDIT_TAMPER_TEST_DATABASE_URL not set (disposable Postgres with baseline applied; never IQ Demo)';
// A clearly-synthetic chain scope (never a real/Demo casino id).
const SC = '5ca1ab1e-0000-0000-0000-0000000000aa';

async function newClient() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const verify = async (c) => (await c.query(`select public.sbiq_verify_audit_chain($1) v`, [SC])).rows[0].v;

test('audit-chain tamper detection', { skip }, async (t) => {
  assertDisposableDb(DSN);
  const c = await newClient();
  try {
    // clean slate for this synthetic scope (disposable DB)
    await c.query(`alter table public.audit_events disable trigger trg_audit_events_immutable`);
    await c.query(`delete from public.audit_events where chain_scope=$1`, [SC]);
    await c.query(`delete from public.audit_chain_head where chain_scope=$1`, [SC]);
    await c.query(`alter table public.audit_events enable trigger trg_audit_events_immutable`);

    await t.test('valid synthetic chain verifies', async () => {
      for (let i = 1; i <= 3; i++) {
        await c.query(
          `insert into public.audit_events (event_id, event_type, event_category, action, casino_id, outcome)
           values ($1, 'test.event', 'test', 'test', $2, 'success')`,
          [`TAMPER-TEST-${i}`, SC]);
      }
      const v = await verify(c);
      assert.equal(v.status, 'verified', `expected verified, got ${JSON.stringify(v)}`);
      assert.equal(v.events_checked, 3);
    });

    await t.test('ordinary mutation blocked by immutability trigger', async () => {
      await assert.rejects(
        c.query(`update public.audit_events set outcome='tampered' where chain_scope=$1 and chain_sequence=1`, [SC]),
        /immutab|not permitted|append-only|cannot|denied/i,
        'a plain UPDATE must be rejected by trg_audit_events_immutable');
      // chain still verifies after the blocked attempt
      assert.equal((await verify(c)).status, 'verified');
    });

    await t.test('out-of-band tamper is detected', async () => {
      // TEST-ONLY superuser bypass (disposable DB). Impossible against cloud DBs: the guard
      // rejects non-disposable hosts before any connection work happens.
      await c.query(`alter table public.audit_events disable trigger trg_audit_events_immutable`);
      await c.query(`update public.audit_events set hash = repeat('f',64) where chain_scope=$1 and chain_sequence=1`, [SC]);
      await c.query(`alter table public.audit_events enable trigger trg_audit_events_immutable`);
      const v = await verify(c);
      assert.equal(v.status, 'broken', `expected broken after tamper, got ${JSON.stringify(v)}`);
      assert.equal(Number(v.first_failing_sequence), 1);
    });
  } finally {
    // leave the disposable DB; it is destroyed with the CI job
    await c.end().catch(() => {});
  }
});
