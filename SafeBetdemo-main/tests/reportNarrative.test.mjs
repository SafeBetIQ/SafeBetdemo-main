// UAT-OP-1 P0-1 — the Reporting Centre may never contradict itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportNarrative, narrativeIsConsistent } from '../lib/reportNarrative.ts';

test('no observed risk + policy decisions -> labelled general guidance, not incidents', () => {
  const n = buildReportNarrative({ critical: 0, high: 0, monitoredCount: 0, decisionCount: 5 });
  assert.equal(n.hasObservedRisk, false);
  assert.equal(n.findingsAreObserved, false);
  assert.equal(n.findingsLabel, 'General policy guidance');
  assert.ok(n.guidanceDisclaimer && /general policy guidance/i.test(n.guidanceDisclaimer));
  assert.match(n.riskSummary, /no critical or high-risk players/i);
  assert.ok(narrativeIsConsistent(n));
});

test('the contradiction the UAT hit is now impossible (0 risk cannot be shown as observed incidents)', () => {
  const n = buildReportNarrative({ critical: 0, high: 0, monitoredCount: 0, decisionCount: 3 });
  // observed-incident presentation with zero observed risk == inconsistent
  assert.equal(n.findingsAreObserved, false);
  assert.ok(narrativeIsConsistent(n));
});

test('observed critical/high risk -> findings are observed incidents, summary agrees', () => {
  const n = buildReportNarrative({ critical: 2, high: 4, monitoredCount: 6, decisionCount: 3 });
  assert.equal(n.hasObservedRisk, true);
  assert.equal(n.findingsAreObserved, true);
  assert.equal(n.findingsLabel, 'Observed compliance findings');
  assert.equal(n.guidanceDisclaimer, null);
  assert.match(n.riskSummary, /2 critical-risk players/);
  assert.match(n.riskSummary, /4 high-risk players/);
  assert.ok(narrativeIsConsistent(n));
});

test('monitored players alone count as observed risk', () => {
  const n = buildReportNarrative({ critical: 0, high: 0, monitoredCount: 3, decisionCount: 0 });
  assert.equal(n.hasObservedRisk, true);
  assert.equal(n.findingsAreObserved, true);
});

test('singular grammar', () => {
  const n = buildReportNarrative({ critical: 1, high: 0, monitoredCount: 0, decisionCount: 0 });
  assert.match(n.riskSummary, /1 critical-risk player\b/);
});

test('narrativeIsConsistent rejects a hand-built contradiction', () => {
  assert.equal(narrativeIsConsistent({
    hasObservedRisk: false, riskSummary: 'x', findingsLabel: 'Observed compliance findings',
    findingsAreObserved: true, guidanceDisclaimer: null,
  }), false);
});
