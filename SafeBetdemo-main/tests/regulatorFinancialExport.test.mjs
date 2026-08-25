// Certified regulator financial EXPORT (FIN-UI-2A2).
// Proves Report ↔ Export reconciliation (export serializes the SAME certified
// FinancialPostureView the Report renders — no new arithmetic), null-not-zero,
// sign preservation, CSV escaping + formula-injection safety, status fidelity,
// and server-authoritative scope reuse.
//   node --test tests/regulatorFinancialExport.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeFinancial } from '../lib/consumerPlatform/shaping.ts';
import { principalMayAccessCasino } from '../lib/security/principal.ts';
import {
  FINANCIAL_PERIODS, ggrForPeriod, stakesForPeriod, winningsForPeriod,
} from '../lib/certifiedFinancial.ts';
import {
  regulatorFinancialCsv, REGULATOR_FINANCIAL_EXPORT_COLUMNS,
} from '../lib/regulatorFinancialExport.ts';

// Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, commas, newlines).
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}
const col = (i) => REGULATOR_FINANCIAL_EXPORT_COLUMNS.indexOf(i);

const row = {
  financial_data_status: 'healthy', financial_currency: 'ZAR', financial_timezone: 'Africa/Johannesburg',
  ggr_current_shift: 1200, ggr_today: 4200, ggr_last_24_hours: 5000, ggr_month_to_date: 91000,
  stakes_current_shift: 3000, stakes_today: 10000, stakes_last_24_hours: 12000, stakes_month_to_date: 210000,
  player_winnings_current_shift: 1800, player_winnings_today: 5800, player_winnings_last_24_hours: 7000, player_winnings_month_to_date: 119000,
  settled_bets_today: 340, voided_bets_today: null, reversed_transactions_today: null,
  voids_supported: false, reversals_supported: false, combined_wager_settlement: true,
  financial_data_mode: 'synthetic', contains_synthetic_data: true, synthetic_event_count: 1200, non_synthetic_event_count: 0,
};
const meta = { operatorName: 'Sun City', jurisdiction: 'ZA', currency: 'ZAR', timezone: 'Africa/Johannesburg', generatedAt: '2026-08-25T10:00:00Z', evidenceRef: 'regulator-financial:export:abc#deadbeef00000000' };

test('Report ↔ Export: exported value equals the certified Report value for every period', () => {
  const fp = shapeFinancial(row);
  const csv = parseCsv(regulatorFinancialCsv(fp, meta));
  const header = csv[0];
  assert.deepEqual(header, [...REGULATOR_FINANCIAL_EXPORT_COLUMNS]);
  // one data row per certified period, same order.
  FINANCIAL_PERIODS.forEach((p, idx) => {
    const r = csv[1 + idx];
    assert.equal(r[col('period')], p.label);
    assert.equal(r[col('ggr')], String(ggrForPeriod(fp, p.key)));
    assert.equal(r[col('settled_stakes')], String(stakesForPeriod(fp, p.key)));
    assert.equal(r[col('player_winnings')], String(winningsForPeriod(fp, p.key)));
    // GGR = stakes − winnings holds in the exported cells (no divergent arithmetic).
    assert.equal(Number(r[col('ggr')]), Number(r[col('settled_stakes')]) - Number(r[col('player_winnings')]));
  });
});

test('Operator ↔ Regulator ↔ Export all read the same certified figure', () => {
  const fp = shapeFinancial(row);                 // operator gateway + regulator endpoint use this
  const csv = parseCsv(regulatorFinancialCsv(fp, meta));
  const todayRow = csv[1 + FINANCIAL_PERIODS.findIndex((p) => p.key === 'TODAY')];
  assert.equal(Number(todayRow[col('ggr')]), ggrForPeriod(fp, 'TODAY')); // export == report == operator
  assert.equal(Number(todayRow[col('ggr')]), 4200);
});

test('null certified value exports as EMPTY, never a false 0', () => {
  const csv = parseCsv(regulatorFinancialCsv(null, meta));   // no certified posture
  for (let i = 0; i < FINANCIAL_PERIODS.length; i++) {
    const r = csv[1 + i];
    assert.equal(r[col('ggr')], '');                 // empty, NOT "0"
    assert.equal(r[col('settled_stakes')], '');
    assert.equal(r[col('player_winnings')], '');
    assert.equal(r[col('status')], 'UNAVAILABLE');
  }
});

test('a genuine certified zero exports as 0', () => {
  const zeroRow = { ...row, ggr_today: 0, stakes_today: 0, player_winnings_today: 0 };
  const fp = shapeFinancial(zeroRow);
  const csv = parseCsv(regulatorFinancialCsv(fp, meta));
  const todayRow = csv[1 + FINANCIAL_PERIODS.findIndex((p) => p.key === 'TODAY')];
  assert.equal(todayRow[col('ggr')], '0');
  assert.equal(todayRow[col('settled_stakes')], '0');
});

test('negative certified GGR keeps its sign and is NOT quoted as injection', () => {
  const negRow = { ...row, ggr_current_shift: -1500 };  // house net-loss for the shift
  const fp = shapeFinancial(negRow);
  const raw = regulatorFinancialCsv(fp, meta);
  const csv = parseCsv(raw);
  const shiftRow = csv[1 + FINANCIAL_PERIODS.findIndex((p) => p.key === 'SHIFT')];
  assert.equal(shiftRow[col('ggr')], '-1500');
  // Must NOT have been prefixed with a quote (formula-injection guard is for TEXT).
  assert.ok(!raw.includes("'-1500"), 'negative numeric must not be neutralised as a formula');
});

test('CSV escaping: operator names with commas/quotes are safely quoted', () => {
  const fp = shapeFinancial(row);
  const csv = parseCsv(regulatorFinancialCsv(fp, { ...meta, operatorName: 'Sun City, Ltd "North"' }));
  assert.equal(csv[1][col('operator')], 'Sun City, Ltd "North"');   // parsed back intact
});

test('formula injection in a TEXT field is neutralised', () => {
  const fp = shapeFinancial(row);
  const raw = regulatorFinancialCsv(fp, { ...meta, operatorName: '=cmd|calc' });
  const csv = parseCsv(raw);
  assert.equal(csv[1][col('operator')], "'=cmd|calc");            // leading quote inserted
});

test('PARTIAL certified status is preserved in the export', () => {
  const fp = shapeFinancial({ ...row, financial_data_status: 'partial' });
  const csv = parseCsv(regulatorFinancialCsv(fp, meta));
  assert.equal(csv[1][col('status')], 'PARTIAL');
});

test('export authorization reuses server-authoritative scope (no client trust)', () => {
  const P = (o) => ({ userId: 'u', role: 'regulator', casinoId: null, jurisdiction: 'ZA', province: null, isServiceRole: false, ...o });
  assert.equal(principalMayAccessCasino(P(), { id: 'c', jurisdiction: 'ZA', province: null }), true);
  assert.equal(principalMayAccessCasino(P(), { id: 'c', jurisdiction: 'UK', province: null }), false);
  assert.equal(principalMayAccessCasino(P({ role: 'casino_admin', casinoId: 'x' }), { id: 'c', jurisdiction: 'ZA', province: null }), false);
});
