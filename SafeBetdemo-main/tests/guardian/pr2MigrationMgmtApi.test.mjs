// SafeBet Guardian — PR2 Option-B (Management API) migration mechanism: safety unit tests.
//   node --test tests/guardian/pr2MigrationMgmtApi.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IQ_PRODUCTION_REF, GUARDIAN_SCHEMA,
  assertMigrationTargets, assertWritableTarget, assertSelectOnly, assertGuardianTable,
  sqlJsonLiteral, buildInsertStatement, reconcileCounts,
} from '../../scripts/guardian/pr2/pr2-migration-mgmtapi.mjs';

const SRC = 'uexdjngogzunjxkpxwll';   // IQ Demo
const TGT = 'druuskabkgyotslcgnys';   // Guardian Demo

// ── project-ref guards ──
test('requires both refs; accepts a valid distinct non-prod pair', () => {
  assert.deepEqual(assertMigrationTargets(SRC, TGT), { source: SRC, target: TGT });
  assert.throws(() => assertMigrationTargets('', TGT), /required/);
  assert.throws(() => assertMigrationTargets(SRC, ''), /required/);
});
test('rejects identical source and target', () => {
  assert.throws(() => assertMigrationTargets(SRC, SRC), /must differ/);
});
test('rejects IQ Production as source OR target', () => {
  assert.equal(IQ_PRODUCTION_REF, 'ilibvipqbkugqkppzdmh');
  assert.throws(() => assertMigrationTargets(IQ_PRODUCTION_REF, TGT), /Production must never be a migration SOURCE/);
  assert.throws(() => assertMigrationTargets(SRC, IQ_PRODUCTION_REF), /Production must never be a migration TARGET/);
});
test('rejects malformed refs', () => {
  assert.throws(() => assertMigrationTargets('SHORT', TGT), /invalid source/);
  assert.throws(() => assertMigrationTargets(SRC, 'has-dashes-and-caps'), /invalid target/);
});

// ── write-path guard (P2-2) ──
test('assertWritableTarget rejects Production + malformed refs, accepts a valid non-prod ref', () => {
  assert.equal(assertWritableTarget(TGT), TGT);
  assert.throws(() => assertWritableTarget(IQ_PRODUCTION_REF), /refusing to WRITE to IQ Production/);
  assert.throws(() => assertWritableTarget('bad-ref'), /invalid target/);
});

// ── source read-only assertion ──
test('assertSelectOnly accepts SELECT/WITH, rejects mutations, INTO, row-locks + multi-statement', () => {
  assert.ok(assertSelectOnly('select * from guardian.foo'));
  assert.ok(assertSelectOnly('WITH x as (select 1) select * from x'));
  for (const bad of [
    'insert into guardian.foo values (1)',
    'update guardian.foo set a=1',
    'delete from guardian.foo',
    'drop table guardian.foo',
    'truncate guardian.foo',
    'select 1; drop table guardian.foo',
    'grant all on guardian.foo to public',
    'select 1; delete from guardian.bar',
    'select * into guardian.copy from guardian.foo',   // SELECT…INTO = source mutation (P2-1)
    'select * from guardian.foo for update',            // row lock on live source (P2-1)
    'select * from guardian.foo for share',
  ]) assert.throws(() => assertSelectOnly(bad), undefined, `should reject: ${bad}`);
});

// ── guardian allow-list + identifier safety ──
test('assertGuardianTable enforces allow-list and safe identifiers', () => {
  const allow = ['guardian_case', 'guardian_evidence'];
  assert.equal(assertGuardianTable('guardian_case', allow), 'guardian_case');
  assert.throws(() => assertGuardianTable('players', allow), /not in the guardian allow-list/);
  assert.throws(() => assertGuardianTable('guardian_case; drop table x', allow), /unsafe table identifier/);
  assert.throws(() => assertGuardianTable('"evil"', allow), /unsafe table identifier/);
});

// ── injection-safe JSON literal ──
test('sqlJsonLiteral doubles single quotes (injection-safe)', () => {
  assert.equal(sqlJsonLiteral('[{"a":"o'+"'"+'brien"}]'), "'[{\"a\":\"o''brien\"}]'");
  // a payload trying to break out of the literal cannot
  const evil = JSON.stringify([{ note: "'); drop table guardian.x; --" }]);
  const lit = sqlJsonLiteral(evil);
  assert.ok(lit.startsWith("'") && lit.endsWith("'"));
  // every single-quote in the body is doubled → no odd-length run can terminate the literal early
  const body = lit.slice(1, -1);
  assert.doesNotMatch(body, /(^|[^'])'([^']|$)/);   // no lone (un-doubled) single quote survives
});

// ── idempotent, type-faithful insert builder ──
test('buildInsertStatement uses jsonb_populate_recordset + ON CONFLICT DO NOTHING, scoped to guardian', () => {
  const allow = ['guardian_case'];
  const s = buildInsertStatement('guardian_case', '[{"id":"x"}]', allow);
  assert.match(s, /^insert into guardian\.guardian_case /);
  assert.match(s, /jsonb_populate_recordset\(null::guardian\.guardian_case, '\[\{"id":"x"\}\]'::jsonb\)/);
  assert.match(s, /on conflict do nothing$/);           // idempotent: never overwrites a differing row
  assert.throws(() => buildInsertStatement('players', '[]', allow), /allow-list/);
});
test('buildInsertStatement neutralises quotes in the row payload', () => {
  const s = buildInsertStatement('guardian_case', JSON.stringify([{ a: "x'y" }]), ['guardian_case']);
  assert.ok(s.includes("x''y"));                         // the inner single quote is doubled
  // after removing doubled quotes, the only single quotes left are the literal + ::jsonb cast delimiters
  const singles = (s.replace(/''/g, '').match(/'/g) || []).length;
  assert.equal(singles, 2);                              // exactly the opening and closing literal quotes
});

// ── reconciliation (no silent skips) ──
test('reconcileCounts flags every mismatch and totals correctly', () => {
  const r = reconcileCounts([
    { table: 'a', source: 10, target: 10 },
    { table: 'b', source: 5, target: 4 },
    { table: 'c', source: 0, target: 0 },
  ]);
  assert.equal(r.tables, 3);
  assert.equal(r.sourceTotal, 15);
  assert.equal(r.targetTotal, 14);
  assert.equal(r.ok, false);
  assert.equal(r.mismatches.length, 1);
  assert.equal(r.mismatches[0].table, 'b');
  assert.equal(r.mismatches[0].delta, -1);
  assert.equal(reconcileCounts([{ table: 'a', source: 3, target: 3 }]).ok, true);
});

test('constants', () => {
  assert.equal(GUARDIAN_SCHEMA, 'guardian');
});
