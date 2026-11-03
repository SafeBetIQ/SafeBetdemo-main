// M1B-P1F — Pilot privilege model (revised): reviewed manifest, hardening artifacts and baseline hash
// guard. Static only (no database). Run: node --test tests/pilotPrivilegeManifest.test.mjs
//
// Revised policy (owner corrections): PUBLIC function EXECUTE = NONE (Correction 2); the three inherited
// Demo exposures are closed (Decision 3: sbiq_financial_rollup_checkpoint anon/authenticated removed;
// sbiq_may_access_chain_scope anon/PUBLIC removed; sbiq_audit_benchmark anon/authenticated/PUBLIC
// removed); future postgres objects are opt-in (Correction 4). The byte-exact manifest is re-proven
// against a live postgres:17 apply by the CI rehearsal/apply jobs; here we check internal consistency,
// the manifest SHA, and that the hardening SQL encodes exactly these decisions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const BASE = '../../deploy/pilot/baseline/';
const raw = (f) => readFileSync(new URL(BASE + f, import.meta.url));
const txt = (f) => raw(f).toString('utf8').replace(/\r\n/g, '\n');
const sha = (b) => createHash('sha256').update(b).digest('hex');

const MANIFEST = txt('pilot_privilege_manifest.txt');
const LINES = MANIFEST.split('\n').filter(Boolean);
const fnLines = LINES.filter((l) => l.startsWith('fn|')).map((l) => {
  const [, sig, secdef, owner, sp, exec] = l.split('|');
  return { sig, secdef: secdef === 'secdef=true', owner: owner.slice(6), pinned: sp === 'search_path=set', exec: exec.slice(5).split(',').filter(Boolean) };
});
const eff = Object.fromEntries(LINES.filter((l) => l.startsWith('eff|')).map((l) => {
  const p = l.split('|'); return [p[1], { anon: p[2] === 'anon=true', authenticated: p[3] === 'authenticated=true', service_role: p[4] === 'service_role=true' }];
}));

test('curated baseline hash guard: SHA of the LF canonical baseline is exactly the authorised value', () => {
  const lf = Buffer.from(raw('pilot_app_schema_baseline.sql').toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  assert.equal(sha(lf), '530941a513216c056eab18e182be09f3d0fe803955c7c7315ccd36123b9fa182');
});

test('reviewed privilege manifest: SHA file matches, lines unique and C-collation ordered', () => {
  const [expected] = txt('pilot_privilege_manifest.sha256').split(/\s+/);
  assert.equal(sha(Buffer.from(MANIFEST, 'utf8')), expected);
  assert.equal(new Set(LINES).size, LINES.length);
  const sorted = [...LINES].sort((a, b) => (Buffer.compare(Buffer.from(a), Buffer.from(b))));
  assert.deepEqual(LINES, sorted, 'byte (COLLATE "C") order');
});

test('expected shape: 361 relations, 151 functions, 130 SECURITY DEFINER', () => {
  const rels = new Set(LINES.filter((l) => l.startsWith('rel|')).map((l) => l.split('|')[2]));
  assert.equal(rels.size, 361);
  assert.equal(fnLines.length, 151);
  assert.equal(fnLines.filter((f) => f.secdef).length, 130);
});

test('no relation is granted to PUBLIC', () => {
  assert.equal(LINES.filter((l) => l.startsWith('rel|') && l.split('|')[3] === 'PUBLIC').length, 0);
});

test('Correction 2: PUBLIC function EXECUTE is NONE, and the post-apply file grants nothing to public', () => {
  const pub = fnLines.filter((f) => f.exec.includes('PUBLIC'));
  assert.deepEqual(pub.map((f) => f.sig), [], 'no function is PUBLIC-executable');
  const grants = [...txt('pilot_post_apply_grants.sql').matchAll(/^grant execute on function public\..+ to public;$/gm)];
  assert.equal(grants.length, 0, 'post-apply file must contain no GRANT … TO public');
});

test('SECURITY DEFINER: owned by postgres, search_path pinned; NONE executable by anon (Decision 3B)', () => {
  for (const f of fnLines.filter((x) => x.secdef)) {
    assert.equal(f.owner, 'postgres', f.sig); assert.ok(f.pinned, `${f.sig} pins search_path`);
  }
  const anonSecdef = fnLines.filter((f) => f.secdef && eff[f.sig].anon).map((f) => f.sig);
  assert.deepEqual(anonSecdef, [], 'no SECURITY DEFINER function is anon-executable');
});

test('effective EXECUTE (PUBLIC removed ⇒ direct membership): anon 15, authenticated 94, service_role 150', () => {
  const n = (k) => Object.values(eff).filter((e) => e[k]).length;
  assert.equal(n('anon'), 15); assert.equal(n('authenticated'), 94); assert.equal(n('service_role'), 150);
  assert.equal(eff['rotate_risk_engine_secret()'].service_role, false, 'only postgres may rotate the risk-engine secret');
});

test('Decision 3: the three inherited exposures are closed in the manifest', () => {
  // 3A — sbiq_financial_rollup_checkpoint: no anon / authenticated table grant; service_role + postgres kept.
  const cp = LINES.filter((l) => l.startsWith('rel|r|sbiq_financial_rollup_checkpoint|')).map((l) => l.split('|')[3]).sort();
  assert.deepEqual(cp, ['postgres', 'service_role']);
  // 3B — sbiq_may_access_chain_scope: no PUBLIC/anon EXECUTE; authenticated + service_role retained.
  assert.equal(eff['sbiq_may_access_chain_scope(p_scope text)'].anon, false);
  assert.equal(eff['sbiq_may_access_chain_scope(p_scope text)'].authenticated, true);
  assert.equal(eff['sbiq_may_access_chain_scope(p_scope text)'].service_role, true);
  assert.ok(!fnLines.find((f) => f.sig === 'sbiq_may_access_chain_scope(p_scope text)').exec.some((r) => r === 'PUBLIC' || r === 'anon'));
  // 3C — sbiq_audit_benchmark: executable only by postgres + service_role.
  assert.deepEqual(fnLines.find((f) => f.sig === 'sbiq_audit_benchmark(p_n integer)').exec, ['postgres', 'service_role']);
  assert.equal(eff['sbiq_audit_benchmark(p_n integer)'].anon, false);
  assert.equal(eff['sbiq_audit_benchmark(p_n integer)'].authenticated, false);
});

test('Correction 4: postgres default privileges are opt-in (global PUBLIC-EXECUTE revoked; no anon/auth/service auto-grant)', () => {
  const defacl = LINES.filter((l) => l.startsWith('defacl|'));
  assert.ok(defacl.includes('defacl|postgres|GLOBAL|f|postgres=EXECUTE'), 'global function default = owner only (PUBLIC revoked)');
  // No postgres default (global or public) may auto-grant to anon/authenticated/service_role/PUBLIC.
  for (const l of defacl) {
    assert.ok(!/(anon|authenticated|service_role)=/.test(l), `no non-owner auto-grant: ${l}`);
    assert.ok(!/PUBLIC=/.test(l), `no PUBLIC auto-grant: ${l}`);
  }
});

test('post-apply hardening: exactly the Decision 3 revokes + Correction 4 default revokes, no grants', () => {
  const s = txt('pilot_post_apply_grants.sql').toLowerCase();
  assert.ok(!/^\s*grant\s/m.test(s), 'post-apply grants nothing');
  for (const r of [
    'revoke all on table public.sbiq_financial_rollup_checkpoint from anon;',
    'revoke all on table public.sbiq_financial_rollup_checkpoint from authenticated;',
    'revoke execute on function public.sbiq_may_access_chain_scope(p_scope text) from anon;',
    'revoke execute on function public.sbiq_may_access_chain_scope(p_scope text) from public;',
    'revoke execute on function public.sbiq_audit_benchmark(p_n integer) from anon;',
    'revoke execute on function public.sbiq_audit_benchmark(p_n integer) from authenticated;',
    'revoke execute on function public.sbiq_audit_benchmark(p_n integer) from public;',
    'alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated, service_role;',
    'alter default privileges for role postgres revoke execute on functions from public;',
  ]) assert.ok(s.includes(r), r);
});

test('pre-apply hardening: revokes every Supabase/PostgreSQL auto-grant path and grants nothing', () => {
  const s = txt('pilot_pre_apply_security.sql').toLowerCase();
  for (const t of ['tables', 'sequences', 'functions']) {
    assert.ok(s.includes(`alter default privileges for role postgres in schema public revoke all on ${t}`), `schema ${t}`);
    assert.ok(s.includes(`alter default privileges for role postgres revoke all on ${t}`), `global ${t}`);
  }
  assert.ok(s.includes('alter default privileges for role postgres revoke execute on functions from public;'));
  assert.ok(!/^\s*grant\s/m.test(s), 'preamble grants nothing');
  assert.ok(s.includes('rollback to savepoint probe'), 'probe objects never persist');
});

test('verify invariants present and tightened (empty allowlists + Correction 4 future-default check)', () => {
  const s = txt('pilot_privilege_verify.sql');
  for (const k of ['VERIFY A1', 'VERIFY A2', 'VERIFY A3', 'VERIFY A4', 'VERIFY A5', 'VERIFY A6', 'VERIFY A7']) assert.ok(s.includes(k), k);
  assert.match(s, /secdef_public_or_anon_ok constant text\[\] := array\[\]::text\[\]/);
  assert.match(s, /public_exec_ok constant text\[\] := array\[\]::text\[\]/);
  assert.match(s, /anon_no_rls_ok constant text\[\] := array\[\]::text\[\]/);
});

test('preflight: hard-stops present; supabase_admin membership is NOT required (Correction 1)', () => {
  const s = txt('pilot_preflight.sql');
  for (const k of ['PREFLIGHT A1', 'PREFLIGHT A2', 'PREFLIGHT A3', 'PREFLIGHT A4', 'PREFLIGHT A5', 'PREFLIGHT A6', 'PREFLIGHT A7', 'PREFLIGHT A8']) assert.ok(s.includes(k), k);
  assert.ok(!/is not a member of supabase_admin/.test(s), 'must not fail on non-membership');
  assert.ok(!/if not pg_has_role\(current_user, 'supabase_admin'/.test(s), 'membership must not be a hard-stop requirement');
  assert.match(s, /PREFLIGHT A7 \(informational\)/, 'A7 is detect-and-report only');
  assert.ok(s.includes('default_transaction_read_only = on'));
  assert.ok(!/\b(create|alter|drop|grant|revoke|insert|update|delete)\b/i.test(s.replace(/--.*$/gm, '').replace(/raise (exception|notice) '[^']*'/g, '').replace(/'[^']*'/g, '')), 'preflight performs no DDL/DML');
});
