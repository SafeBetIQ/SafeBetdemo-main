// ─── SafeBet Guardian — synthetic payment fixtures (ARCH-V4-C4) ───────────────
// Provider-neutral synthetic references only. NO PAN/CVV/real bank/card/customer data.

import type { PaymentFixture } from './types.ts';

export const SYNTHETIC_PAYMENT_FIXTURES: Record<string, PaymentFixture> = {
  // Scenario 1/2/7: merchant → licensed operator + declares known domain + app.
  'MER-REF-0001': {
    merchantReference: 'MER-REF-0001', merchantDescriptor: 'SAFE EXAMPLE BETTING', jurisdiction: 'ZA-GP',
    channel: 'CARD', providerReference: 'PSP-SYNTH-001', providerType: 'PAYMENT_SERVICE_PROVIDER',
    declaredOperatorName: null, declaredBrand: 'Safe Example Betting', declaredLicenceReference: 'LIC-ZA-GP-TEST-0001',
    declaredWebsite: 'licensed-example-003.test', declaredAppIdentifier: 'com.safebet.synthetic.bet003',
    amountAggregate: 12345, currency: 'ZAR', contentHash: '1'.repeat(64), evidenceReference: 'evref:pobs-0001-a',
  },
  // Scenario 3: unknown merchant, gambling payment page, no registry ref → NO_MATCH → review.
  'MER-REF-0004': {
    merchantReference: 'MER-REF-0004', merchantDescriptor: 'UNKNOWN CASINO PAY', jurisdiction: 'ZA-GP',
    channel: 'EFT', providerReference: 'PSP-SYNTH-001', providerType: 'PAYMENT_SERVICE_PROVIDER',
    declaredOperatorName: null, declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null,
    amountAggregate: 6789, currency: 'ZAR', contentHash: '4'.repeat(64), evidenceReference: 'evref:pobs-0004-a',
  },
  // Scenario 4: merchant/operator mismatch (brand vs different operator's expired licence).
  'MER-REF-0005': {
    merchantReference: 'MER-REF-0005', merchantDescriptor: 'SAFE EXAMPLE MIRROR PAY', jurisdiction: 'ZA-GP',
    channel: 'CARD', providerReference: 'PSP-SYNTH-001', providerType: 'PAYMENT_SERVICE_PROVIDER',
    declaredOperatorName: null, declaredBrand: 'Safe Example Betting', declaredLicenceReference: 'LIC-ZA-GP-TEST-0009',
    declaredWebsite: null, declaredAppIdentifier: null,
    amountAggregate: 999, currency: 'ZAR', contentHash: '5'.repeat(64), evidenceReference: 'evref:pobs-0005-a',
  },
  // Scenario 5: stale licence.
  'MER-REF-0009': {
    merchantReference: 'MER-REF-0009', merchantDescriptor: 'LAPSED PLAY PAY', jurisdiction: 'ZA-GP',
    channel: 'WALLET', providerReference: 'PSP-SYNTH-001', providerType: 'WALLET_PROVIDER',
    declaredOperatorName: 'Lapsed Play Synthetic Ltd', declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null,
    amountAggregate: 100, currency: 'ZAR', contentHash: '9'.repeat(64), evidenceReference: 'evref:pobs-0009-a',
  },
  // Scenario 6: source conflict.
  'MER-REF-0002': {
    merchantReference: 'MER-REF-0002', merchantDescriptor: 'CONFLICTED PAY', jurisdiction: 'ZA-GP',
    channel: 'BANK_TRANSFER', providerReference: 'ACQ-SYNTH-001', providerType: 'ACQUIRER',
    declaredOperatorName: 'Conflicted Operator Synthetic (Pty) Ltd', declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null,
    amountAggregate: 200, currency: 'ZAR', contentHash: '2'.repeat(64), evidenceReference: 'evref:pobs-0002-a',
  },
  // Scenario 8: wrong-jurisdiction (ZA-WC).
  'MER-REF-0100': {
    merchantReference: 'MER-REF-0100', merchantDescriptor: 'WESTERN SYNTH PAY', jurisdiction: 'ZA-WC',
    channel: 'CARD', providerReference: 'PSP-SYNTH-001', providerType: 'PAYMENT_SERVICE_PROVIDER',
    declaredOperatorName: 'Western Synthetic Betting (Pty) Ltd', declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null,
    amountAggregate: 500, currency: 'ZAR', contentHash: 'c'.repeat(64), evidenceReference: 'evref:pobs-0100-a',
  },
  // Scenario 12: unknown provider reference.
  'MER-REF-0012': {
    merchantReference: 'MER-REF-0012', merchantDescriptor: 'NO PROVIDER PAY', jurisdiction: 'ZA-GP',
    channel: 'UNKNOWN', providerReference: '', providerType: 'PAYMENT_SERVICE_PROVIDER',
    declaredOperatorName: 'Synthetic Gaming Holdings (Pty) Ltd', declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null,
    amountAggregate: 1, currency: 'ZAR', contentHash: 'e'.repeat(64), evidenceReference: 'evref:pobs-0012-a',
  },
};
