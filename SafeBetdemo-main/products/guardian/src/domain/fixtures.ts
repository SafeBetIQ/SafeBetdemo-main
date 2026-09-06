// ─── SafeBet Guardian — synthetic domain fixtures (ARCH-V4-C2) ────────────────
//
// Reserved .test hostnames only. NO real domains, NO live capture. Mirrors the
// `guardian` schema seed. Used by the API/worker/tests.

import type { WebsiteFixture } from './types.ts';

export const SYNTHETIC_DOMAIN_FIXTURES: Record<string, WebsiteFixture> = {
  // Scenario 1/2: licensed brand domain with an explicit licence reference → matched.
  'licensed-example-003.test': {
    hostname: 'licensed-example-003.test', jurisdiction: 'ZA-GP',
    pageTitle: 'Safe Example Betting', visibleText: 'Bet online with Safe Example Betting. Licence LIC-ZA-GP-TEST-0001.',
    links: [], resourceReferences: ['script:app.js'], httpStatus: 200, tlsPresent: true, redirectTarget: null,
    contentHash: '3'.repeat(64), evidenceReference: 'evref:snap-0003-a',
    claimedBrand: 'Safe Example Betting', claimedLicenceReference: 'LIC-ZA-GP-TEST-0001', claimedOperatorName: null,
  },
  // Scenario 3: unknown gambling-themed domain → NO_MATCH → review (NOT illegal).
  'unknown-example-004.test': {
    hostname: 'unknown-example-004.test', jurisdiction: 'ZA-GP',
    pageTitle: 'Unknown Casino', visibleText: 'Deposit now, big bonus, casino and betting. Register today.',
    links: [], resourceReferences: [], httpStatus: 200, tlsPresent: true, redirectTarget: null,
    contentHash: '4'.repeat(64), evidenceReference: 'evref:snap-0004-a',
    claimedBrand: null, claimedLicenceReference: null, claimedOperatorName: null,
  },
  // Scenario 4: mismatch — claims Safe Example Betting brand but an expired licence of a DIFFERENT operator.
  'mismatch-example-005.test': {
    hostname: 'mismatch-example-005.test', jurisdiction: 'ZA-GP',
    pageTitle: 'Safe Example Betting Mirror', visibleText: 'Safe Example Betting. Licence LIC-ZA-GP-TEST-0009.',
    links: [], resourceReferences: [], httpStatus: 200, tlsPresent: true, redirectTarget: null,
    contentHash: '5'.repeat(64), evidenceReference: 'evref:snap-0005-a',
    claimedBrand: 'Safe Example Betting', claimedLicenceReference: 'LIC-ZA-GP-TEST-0009', claimedOperatorName: null,
  },
  // Scenario 5: stale — references an operator whose licence verification is stale.
  'stale-example-009.test': {
    hostname: 'stale-example-009.test', jurisdiction: 'ZA-GP',
    pageTitle: 'Lapsed Play', visibleText: 'Lapsed Play Synthetic Ltd. Betting.',
    links: [], resourceReferences: [], httpStatus: 200, tlsPresent: true, redirectTarget: null,
    contentHash: '9'.repeat(64), evidenceReference: 'evref:snap-0009-a',
    claimedBrand: null, claimedLicenceReference: null, claimedOperatorName: 'Lapsed Play Synthetic Ltd',
  },
  // Scenario 6: conflict — operator with conflicting synthetic source records.
  'conflict-example-002.test': {
    hostname: 'conflict-example-002.test', jurisdiction: 'ZA-GP',
    pageTitle: 'Conflicted Operator', visibleText: 'Conflicted Operator Synthetic (Pty) Ltd. Casino.',
    links: [], resourceReferences: [], httpStatus: 200, tlsPresent: true, redirectTarget: null,
    contentHash: '2'.repeat(64), evidenceReference: 'evref:snap-0002-a',
    claimedBrand: null, claimedLicenceReference: null, claimedOperatorName: 'Conflicted Operator Synthetic (Pty) Ltd',
  },
  // Scenario 7: wrong-jurisdiction (ZA-WC) subject.
  'western-example-100.test': {
    hostname: 'western-example-100.test', jurisdiction: 'ZA-WC',
    pageTitle: 'Western Synthetic Betting', visibleText: 'Western Synthetic Betting (Pty) Ltd.',
    links: [], resourceReferences: [], httpStatus: 200, tlsPresent: true, redirectTarget: null,
    contentHash: 'c'.repeat(64), evidenceReference: 'evref:snap-0100-a',
    claimedBrand: null, claimedLicenceReference: null, claimedOperatorName: 'Western Synthetic Betting (Pty) Ltd',
  },
};
