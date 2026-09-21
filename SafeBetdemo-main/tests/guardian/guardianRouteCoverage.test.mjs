// SafeBet Guardian — privileged-route authentication coverage (ARCH-V4-PR1.1 route close-out).
// Structural proof that EVERY privileged Guardian API route is gated (jwt: token+capability+MFA+
// jurisdiction; synthetic harness: capability+jurisdiction). Only /health,/version,/foundation are public.
//   node --test tests/guardian/guardianRouteCoverage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hasCapability, mayReachC8AuthorisationGate,
} from '../../products/guardian/src/identity-auth/index.ts';

const SRC = readFileSync('products/guardian/bin/guardian-lambda.ts', 'utf8');
const LINES = SRC.split('\n');

// A "route decision" line either matches `if (path ... && method === '...')` or `if (<name>Route/Sub && method ...)`.
const isRouteLine = (l) => /if \((path (===|\.startsWith|\.match)|[a-zA-Z]+ ?&& method|ev[A-Za-z]+ ?&& method|caseSub ?&& method|orchestrateRoute|reentry(Review|Route)Route ?&&|paSub ?&&)/.test(l) && /method ===/.test(l);
const PUBLIC = ["path === '/health'", "path === '/version'", "path === '/foundation'"];

function gatedWithin(idx) {
  // Scan from the route opener until the next route decision (or a 14-line cap), which bounds the block.
  for (let j = idx + 1; j < LINES.length && j <= idx + 14; j++) {
    if (isRouteLine(LINES[j])) break;
    if (/await gate\(|\bg[A-Za-z0-9]*\.deny\b|authenticateGuardianRequest/.test(LINES[j])) return true;
  }
  return false;
}

test('every privileged route is gated; only health/version/foundation are public', () => {
  const ungated = [];
  for (let i = 0; i < LINES.length; i++) {
    const l = LINES[i];
    if (!isRouteLine(l)) continue;
    if (PUBLIC.some((p) => l.includes(p))) continue;
    // /auth/whoami has its own gate on the next line; everything else must be gated too.
    if (!gatedWithin(i)) ungated.push(`${i + 1}: ${l.trim().slice(0, 70)}`);
  }
  assert.deepEqual(ungated, [], `ungated privileged routes:\n${ungated.join('\n')}`);
});

test('the router still exposes public posture routes (no over-gating)', () => {
  assert.ok(/path === '\/health'/.test(SRC));
  assert.ok(/path === '\/version'/.test(SRC));
  assert.ok(/path === '\/foundation'/.test(SRC));
});

test('gate() count covers the privileged surface', () => {
  const gateCalls = (SRC.match(/await gate\(/g) || []).length;
  assert.ok(gateCalls >= 40, `expected >=40 gate() calls, found ${gateCalls}`);
});

// Capability/SoD matrix the routes rely on (mirrors authorize.ts) — a privileged human can only do
// what its role permits; a GUARDIAN_ADMINISTRATOR cannot read business data; only an officer authorises.
const P = (role) => ({ product: 'GUARDIAN', principalKind: 'HUMAN', role, jurisdiction: 'ZA-GP', mfaSatisfied: true });
test('capability matrix: SoD is enforced by role', () => {
  assert.equal(hasCapability(P('INVESTIGATOR'), 'AUTHORISE_ACTION'), false);
  assert.equal(hasCapability(P('LEGAL_REVIEWER'), 'AUTHORISE_ACTION'), false);
  assert.equal(hasCapability(P('AUTHORISING_OFFICER'), 'AUTHORISE_ACTION'), true);
  assert.equal(hasCapability(P('POLICY_ADMINISTRATOR'), 'EVIDENCE_ACCESS'), false);
  assert.equal(hasCapability(P('GUARDIAN_ADMINISTRATOR'), 'CASE_VIEW'), false);   // admin != business read
  assert.equal(hasCapability(P('INVESTIGATOR'), 'EVIDENCE_ACCESS'), true);
  assert.equal(hasCapability(P('INVESTIGATOR'), 'CASE_REVIEW'), true);
  assert.equal(hasCapability(P('LEGAL_REVIEWER'), 'CASE_REVIEW'), false);         // legal reviewer is not an ingester
  assert.equal(mayReachC8AuthorisationGate(P('AUTHORISING_OFFICER')), true);
  assert.equal(mayReachC8AuthorisationGate({ ...P('AUTHORISING_OFFICER'), mfaSatisfied: false }), false);
  assert.equal(mayReachC8AuthorisationGate({ ...P('AUTHORISING_OFFICER'), principalKind: 'SERVICE' }), false);
});
