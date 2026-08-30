// UAT-OP-5 P1-2 — case timeline surfaces real evidence and is HONEST about gaps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseTimeline } from '../lib/workflow/timeline.ts';

const ref = (cls, r) => ({ evidenceClass: cls, ref: r, label: `${cls} ${r}` });

test('complete evidence chain: all platform stages available, no notes', () => {
  const wc = {
    evidenceRefs: [ref('recorded-fact', 'EV-1'), ref('derived-intelligence', 'EV-2'), ref('policy-decision', 'EV-3')],
    closedAt: '2026-08-20T00:00:00Z', status: 'closed', resolution: 'Resolved.',
  };
  const audit = [
    { at: '2026-08-10T00:00:00Z', action: 'opened', actor: 'a', detail: {} },
    { at: '2026-08-12T00:00:00Z', action: 'action-recorded', actor: 'a', detail: { action: 'contacted player' } },
    { at: '2026-08-15T00:00:00Z', action: 'outcome-recorded', actor: 'a', detail: { outcome: 'player set a limit' } },
  ];
  const t = buildCaseTimeline(wc, audit);
  const byId = Object.fromEntries(t.map((s) => [s.stage, s]));
  for (const id of ['recorded-fact', 'derived-intelligence', 'policy-decision', 'workflow-action', 'recorded-outcome', 'case-resolution']) {
    assert.equal(byId[id].available, true, `${id} should be available`);
    assert.equal(byId[id].unavailableNote, undefined, `${id} available -> no note`);
  }
});

test('missing Recorded Fact + Derived Intelligence -> honest note, NOT bare "unavailable"', () => {
  const wc = { evidenceRefs: [ref('policy-decision', 'EV-3')], closedAt: null, status: 'open', resolution: null };
  const t = buildCaseTimeline(wc, []);
  const rf = t.find((s) => s.stage === 'recorded-fact');
  const di = t.find((s) => s.stage === 'derived-intelligence');
  const pd = t.find((s) => s.stage === 'policy-decision');
  assert.equal(rf.available, false);
  assert.match(rf.unavailableNote, /No Recorded Fact evidence is linked/i);
  assert.equal(di.available, false);
  assert.match(di.unavailableNote, /No Derived Intelligence evidence is linked/i);
  assert.equal(pd.available, true); // policy decision present, as UAT observed
  assert.equal(pd.unavailableNote, undefined);
});

test('explainable-intelligence refs count as Derived Intelligence', () => {
  const wc = { evidenceRefs: [ref('explainable-intelligence', 'EV-9')], closedAt: null, status: 'open', resolution: null };
  const di = buildCaseTimeline(wc, []).find((s) => s.stage === 'derived-intelligence');
  assert.equal(di.available, true);
});

test('no fabrication: an empty case has honest notes on every stage, zero invented entries', () => {
  const wc = { evidenceRefs: [], closedAt: null, status: 'open', resolution: null };
  const t = buildCaseTimeline(wc, []);
  for (const s of t) {
    assert.equal(s.available, false);
    assert.equal(s.entries.length, 0);
    assert.ok(s.unavailableNote && s.unavailableNote.length > 0);
  }
});

test('timeline stage ordering is Recorded Fact -> … -> Case Resolution', () => {
  const t = buildCaseTimeline({ evidenceRefs: [], closedAt: null, status: 'open', resolution: null }, []);
  assert.deepEqual(t.map((s) => s.stage),
    ['recorded-fact', 'derived-intelligence', 'policy-decision', 'workflow-action', 'recorded-outcome', 'case-resolution']);
});
