// PERF-REG-3 — fetchCertifiedPosture: the ONE certified-financial source helper.
// Proves it (a) calls the rollup RPC (never the slow view), (b) passes the
// authorised casino id, (c) extracts the single posture row from `setof`, and
// (d) returns null (never a fabricated row) when there is no certified data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCertifiedPosture } from '../lib/certifiedFinancialSource.ts';

function stubClient(data, capture = {}) {
  return {
    rpc(fn, args) {
      capture.fn = fn;
      capture.args = args;
      return Promise.resolve({ data, error: null });
    },
  };
}

test('calls the rollup RPC with the authorised casino id (never the view)', async () => {
  const cap = {};
  await fetchCertifiedPosture(stubClient([{ casino_id: 'c1' }], cap), 'c1');
  assert.equal(cap.fn, 'sbiq_certified_financial_posture_v2');
  assert.deepEqual(cap.args, { p_casino: 'c1' });
});

test('extracts the single row from a setof array', async () => {
  const row = { casino_id: 'c1', ggr_shift: 420, financial_data_status: 'certified' };
  const out = await fetchCertifiedPosture(stubClient([row]), 'c1');
  assert.deepEqual(out, row);
});

test('unwraps a single object (non-array) result', async () => {
  const row = { casino_id: 'c1', ggr_shift: 7 };
  const out = await fetchCertifiedPosture(stubClient(row), 'c1');
  assert.deepEqual(out, row);
});

test('empty setof → null (never a fabricated row)', async () => {
  assert.equal(await fetchCertifiedPosture(stubClient([]), 'c1'), null);
});

test('null data → null', async () => {
  assert.equal(await fetchCertifiedPosture(stubClient(null), 'c1'), null);
});

test('takes only the first row if the RPC ever returns several', async () => {
  const first = { casino_id: 'c1', tag: 'first' };
  const out = await fetchCertifiedPosture(stubClient([first, { casino_id: 'c1', tag: 'second' }]), 'c1');
  assert.equal(out.tag, 'first');
});
