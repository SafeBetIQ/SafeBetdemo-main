// M1B-P1F — end-to-end privilege hardening on a DISPOSABLE Postgres 17 (never a real project).
// Emulates a fresh Supabase project's default privileges, then proves:
//   1. preflight passes on the empty emulated project;
//   2. WITHOUT the pre-apply hardening, the curated baseline leaves SECURITY DEFINER functions
//      callable by anon (verification fails closed, VERIFY A3);
//   3. WITH preflight → hardening → baseline → post-apply grants, the privilege state equals the
//      reviewed manifest byte-for-byte;
//   4. preflight refuses a non-empty project.
// Gated: PILOT_HARDENING_TEST_DATABASE_URL (admin DSN on a disposable server; db name must follow
// the disposable convention) + SAFEBET_DISPOSABLE_TEST_DB=1. Unset ⇒ SKIP.
// Harness note: psql meta-commands (\set, \restrict) are stripped because files are sent via the
// pg driver; the real workflow applies the same files with psql 17.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDisposableDb } from './_disposableDbGuard.mjs';

const DSN = process.env.PILOT_HARDENING_TEST_DATABASE_URL;
const skip = DSN ? false : 'PILOT_HARDENING_TEST_DATABASE_URL not set (disposable Postgres 17 only)';
const BASE = '../../deploy/pilot/baseline/';
const sql = (f) => readFileSync(new URL(BASE + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  .split('\n').filter((l) => !l.startsWith('\\')).join('\n');

async function client(db) {
  const { default: pg } = await import('pg');
  const u = new URL(DSN); if (db) u.pathname = `/${db}`;
  const c = new pg.Client({ connectionString: u.toString() }); await c.connect(); return c;
}
async function run(db, files) { const c = await client(db); try { for (const f of files) await c.query(sql(f)); } finally { await c.end(); } }
async function lines(db, file) {
  const c = await client(db);
  try { const r = await c.query(sql(file)); const last = Array.isArray(r) ? r[r.length - 1] : r; return last.rows.map((x) => x.line).join('\n') + '\n'; }
  finally { await c.end(); }
}

test('Pilot privilege hardening (disposable Postgres 17)', { skip, timeout: 600_000 }, async (t) => {
  assertDisposableDb(DSN);
  const tag = `${process.pid}`;
  const HARD = `pilot_hardening_test_${tag}`, RAW = `pilot_unhardened_test_${tag}`;
  const admin = await client();
  try {
    for (const d of [HARD, RAW]) { await admin.query(`drop database if exists ${d}`); await admin.query(`create database ${d}`); }
    for (const d of [HARD, RAW]) await run(d, ['platform-prep.sql', 'rehearsal/supabase-defaults-emulation.sql']);

    await t.test('preflight passes on the empty emulated project', async () => {
      const out = await lines(HARD, 'pilot_preflight.sql');
      assert.match(out, /^public_relations\|0$/m);
      assert.match(out, /^new_function_public_execute_default\|granted\(PostgreSQL default\)$/m);
    });

    // M1B-P1F: the Pilot apply uses the generated Supabase derivative (supabase_admin default-privilege
    // statements removed). The derivative is produced deterministically by generate-supabase-derivative.mjs
    // (determinism proven in tests/pilotSupabaseDerivative.test.mjs); here we apply the committed artifact.
    const DERIV = 'generated/pilot_app_schema_supabase.sql';
    await t.test('WITHOUT hardening: anon can execute SECURITY DEFINER functions → verification fails', async () => {
      await run(RAW, [DERIV]);
      await assert.rejects(lines(RAW, 'pilot_privilege_verify.sql'), /VERIFY A3: SECURITY DEFINER functions callable by anon/);
    });

    await t.test('WITH hardening: privilege state equals the reviewed manifest exactly', async () => {
      // preflight (no supabase_admin membership required) → hardening preamble → apply derivative →
      // post-apply privilege hardening. The structural fingerprint (captured between apply and post-apply
      // in the workflow) is proven by the rehearsal/apply jobs, not this manifest-equality test.
      await run(HARD, ['pilot_pre_apply_security.sql', DERIV, 'pilot_post_apply_grants.sql']);
      const got = await lines(HARD, 'pilot_privilege_verify.sql');
      const want = readFileSync(new URL(BASE + 'pilot_privilege_manifest.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
      assert.equal(got, want);
    });

    await t.test('preflight refuses a non-empty project; hardening refuses to run twice', async () => {
      await assert.rejects(lines(HARD, 'pilot_preflight.sql'), /PREFLIGHT A3/);
      await assert.rejects(run(HARD, ['pilot_pre_apply_security.sql']), /public schema is not empty/);
    });
  } finally {
    for (const d of [HARD, RAW]) await admin.query(`drop database if exists ${d}`).catch(() => {});
    await admin.end();
  }
});
