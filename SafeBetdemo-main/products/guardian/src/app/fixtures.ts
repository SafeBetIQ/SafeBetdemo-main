// ─── SafeBet Guardian — synthetic app fixtures (ARCH-V4-C3) ───────────────────
// Provider-neutral synthetic identifiers only. NO real apps, NO platform access.

import type { AppFixture } from './types.ts';

export const SYNTHETIC_APP_FIXTURES: Record<string, AppFixture> = {
  // Scenario 1/2/11: licensed brand app + explicit licence + declares a KNOWN C2 domain.
  'com.safebet.synthetic.bet003': {
    appIdentifier: 'com.safebet.synthetic.bet003', jurisdiction: 'ZA-GP', displayName: 'Safe Example Betting App',
    platformType: 'MOBILE_APP', developer: 'Synthetic Gaming Holdings', version: '1.2.0',
    description: 'Bet online with Safe Example Betting. Licence LIC-ZA-GP-TEST-0001. Register and deposit.',
    declaredWebsite: 'licensed-example-003.test', privacyReference: 'licensed-example-003.test', supportReference: null,
    declaredLicenceReference: 'LIC-ZA-GP-TEST-0001', declaredOperatorName: null, declaredBrand: 'Safe Example Betting',
    contentHash: '3'.repeat(64), metadataHash: 'a'.repeat(64), evidenceReference: 'evref:asnap-0003-a',
  },
  // Scenario 3: unknown gambling app, no registry reference → NO_MATCH → review (not illegal).
  'app.synthetic.unknown004': {
    appIdentifier: 'app.synthetic.unknown004', jurisdiction: 'ZA-GP', displayName: 'Unknown Casino App',
    platformType: 'MOBILE_APP', developer: 'Unknown Synthetic Dev', version: '0.9.1',
    description: 'Casino and betting. Deposit now, big bonus. Register today.',
    declaredWebsite: 'unknown-app-004.test', privacyReference: null, supportReference: null,
    declaredLicenceReference: null, declaredOperatorName: null, declaredBrand: null,
    contentHash: '4'.repeat(64), metadataHash: 'b'.repeat(64), evidenceReference: 'evref:asnap-0004-a',
  },
  // Scenario 4: mismatch — claims Safe Example Betting brand but a different operator's expired licence.
  'app.synthetic.mismatch005': {
    appIdentifier: 'app.synthetic.mismatch005', jurisdiction: 'ZA-GP', displayName: 'Safe Example Betting Mirror',
    platformType: 'MOBILE_APP', developer: 'Mirror Synthetic Dev', version: '2.0.0',
    description: 'Safe Example Betting. Licence LIC-ZA-GP-TEST-0009. Bet and deposit.',
    declaredWebsite: null, privacyReference: null, supportReference: null,
    declaredLicenceReference: 'LIC-ZA-GP-TEST-0009', declaredOperatorName: null, declaredBrand: 'Safe Example Betting',
    contentHash: '5'.repeat(64), metadataHash: 'c'.repeat(64), evidenceReference: 'evref:asnap-0005-a',
  },
  // Scenario 5: stale licence reference.
  'app.synthetic.stale009': {
    appIdentifier: 'app.synthetic.stale009', jurisdiction: 'ZA-GP', displayName: 'Lapsed Play App',
    platformType: 'MOBILE_APP', developer: 'Lapsed Play Synthetic Ltd', version: '1.0.0',
    description: 'Lapsed Play Synthetic Ltd. Betting app.',
    declaredWebsite: null, privacyReference: null, supportReference: null,
    declaredLicenceReference: null, declaredOperatorName: 'Lapsed Play Synthetic Ltd', declaredBrand: null,
    contentHash: '9'.repeat(64), metadataHash: 'd'.repeat(64), evidenceReference: 'evref:asnap-0009-a',
  },
  // Scenario 6: source conflict.
  'app.synthetic.conflict002': {
    appIdentifier: 'app.synthetic.conflict002', jurisdiction: 'ZA-GP', displayName: 'Conflicted Operator App',
    platformType: 'MOBILE_APP', developer: 'Conflicted Operator Synthetic (Pty) Ltd', version: '1.0.0',
    description: 'Conflicted Operator Synthetic (Pty) Ltd. Casino.',
    declaredWebsite: null, privacyReference: null, supportReference: null,
    declaredLicenceReference: null, declaredOperatorName: 'Conflicted Operator Synthetic (Pty) Ltd', declaredBrand: null,
    contentHash: '2'.repeat(64), metadataHash: 'e'.repeat(64), evidenceReference: 'evref:asnap-0002-a',
  },
  // Scenario 7: wrong-jurisdiction (ZA-WC).
  'za.synthetic.western100': {
    appIdentifier: 'za.synthetic.western100', jurisdiction: 'ZA-WC', displayName: 'Western Synthetic App',
    platformType: 'MOBILE_APP', developer: 'Western Synthetic Betting', version: '1.0.0',
    description: 'Western Synthetic Betting (Pty) Ltd.',
    declaredWebsite: null, privacyReference: null, supportReference: null,
    declaredLicenceReference: null, declaredOperatorName: 'Western Synthetic Betting (Pty) Ltd', declaredBrand: null,
    contentHash: 'c'.repeat(64), metadataHash: 'f'.repeat(64), evidenceReference: 'evref:asnap-0100-a',
  },
  // Scenario 12: declares an UNKNOWN domain (recorded as a reference; no illegality inferred).
  'app.synthetic.unknowndomain012': {
    appIdentifier: 'app.synthetic.unknowndomain012', jurisdiction: 'ZA-GP', displayName: 'Synthetic App With Unknown Domain',
    platformType: 'MOBILE_APP', developer: 'Synthetic Gaming Holdings', version: '1.0.0',
    description: 'Safe Example Betting. Licence LIC-ZA-GP-TEST-0001.',
    declaredWebsite: 'never-seen-999.test', privacyReference: null, supportReference: null,
    declaredLicenceReference: 'LIC-ZA-GP-TEST-0001', declaredOperatorName: null, declaredBrand: 'Safe Example Betting',
    contentHash: 'e'.repeat(64), metadataHash: '1'.repeat(64), evidenceReference: 'evref:asnap-0012-a',
  },
};
