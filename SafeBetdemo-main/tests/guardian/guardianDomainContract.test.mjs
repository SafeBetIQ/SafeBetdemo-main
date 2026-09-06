// SafeBet Guardian — Domain Reference Contract (ARCH-V4-C3.1). Synthetic only.
// Proves consumers (Mobile App Intelligence) obtain bounded Domain references through
// the governed contract, jurisdiction-scoped, without raw Domain base tables.
//   node --test tests/guardian/guardianDomainContract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDomainReference } from '../../products/guardian/src/index.ts';

test('contract: known synthetic domain → REFERENCED, bounded fields only', () => {
  const r = resolveDomainReference({ hostname: 'licensed-example-003.test', jurisdiction: 'ZA-GP' });
  assert.equal(r.matchState, 'REFERENCED');
  assert.equal(r.canonicalHostname, 'licensed-example-003.test');
  assert.equal(r.jurisdiction, 'ZA-GP');
  assert.equal(r.referenceStatus, 'REFERENCED');
  // bounded: no full domain row is exposed
  assert.deepEqual(Object.keys(r).sort(), ['canonicalHostname', 'domainReferenceId', 'freshness', 'jurisdiction', 'matchState', 'referenceStatus']);
});

test('contract: unknown synthetic domain → bounded DOMAIN_REFERENCE_NOT_FOUND (NOT illegal)', () => {
  const r = resolveDomainReference({ hostname: 'never-seen-999.test', jurisdiction: 'ZA-GP' });
  assert.equal(r.matchState, 'DOMAIN_REFERENCE_NOT_FOUND');
  assert.equal(r.referenceStatus, 'NOT_FOUND');
  assert.equal(r.domainReferenceId, null);
});

test('contract: wrong-jurisdiction hostname → NOT_FOUND (no cross-jurisdiction data)', () => {
  // western-example-100.test exists ONLY in ZA-WC; a ZA-GP request must not see it.
  const gp = resolveDomainReference({ hostname: 'western-example-100.test', jurisdiction: 'ZA-GP' });
  assert.equal(gp.matchState, 'DOMAIN_REFERENCE_NOT_FOUND');
  const wc = resolveDomainReference({ hostname: 'western-example-100.test', jurisdiction: 'ZA-WC' });
  assert.equal(wc.matchState, 'REFERENCED');
});

// C4: App Reference Contract (owner App Intelligence).
import { resolveAppReference } from '../../products/guardian/src/index.ts';
test('app-contract: known app → REFERENCED; unknown → APP_REFERENCE_NOT_FOUND; wrong-jur denied', () => {
  const k = resolveAppReference({ appIdentifier: 'com.safebet.synthetic.bet003', jurisdiction: 'ZA-GP' });
  assert.equal(k.matchState, 'REFERENCED');
  assert.equal(resolveAppReference({ appIdentifier: 'com.unknown.app', jurisdiction: 'ZA-GP' }).matchState, 'APP_REFERENCE_NOT_FOUND');
  assert.equal(resolveAppReference({ appIdentifier: 'za.synthetic.western100', jurisdiction: 'ZA-GP' }).matchState, 'APP_REFERENCE_NOT_FOUND');
});
