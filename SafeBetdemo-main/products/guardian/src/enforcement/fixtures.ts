// ─── SafeBet Guardian — synthetic orchestration fixtures (ARCH-V4-C9) ─────────
// SYNTHETIC only. No real provider/authorisation/enforcement.

import type { AuthorisedActionSnapshot, ProviderChannel } from './types.ts';

export const SYNTHETIC_PROVIDER_CHANNELS: ProviderChannel[] = [
  { providerChannelId: 'PCH-SYNTH-DNS-ZAGP', providerType: 'SYNTHETIC_DNS_PROVIDER', jurisdiction: 'ZA-GP', supportedActionTypes: ['DOMAIN_BLOCK', 'DNS_POLICY'], deliveryMethod: 'SYNTHETIC_ADAPTER', isSynthetic: true },
  { providerChannelId: 'PCH-SYNTH-PAY-ZAGP', providerType: 'SYNTHETIC_PAYMENT_PROVIDER', jurisdiction: 'ZA-GP', supportedActionTypes: ['PAYMENT_REFERRAL'], deliveryMethod: 'SYNTHETIC_ADAPTER', isSynthetic: true },
  { providerChannelId: 'PCH-SYNTH-APP-ZAGP', providerType: 'SYNTHETIC_MOBILE_PLATFORM', jurisdiction: 'ZA-GP', supportedActionTypes: ['APP_PLATFORM_REFERRAL'], deliveryMethod: 'SYNTHETIC_ADAPTER', isSynthetic: true },
  { providerChannelId: 'PCH-SYNTH-DNS-ZAWC', providerType: 'SYNTHETIC_DNS_PROVIDER', jurisdiction: 'ZA-WC', supportedActionTypes: ['DOMAIN_BLOCK'], deliveryMethod: 'SYNTHETIC_ADAPTER', isSynthetic: true },
];

/** A canonical valid AUTHORISED action snapshot (as a C8 AuthorisedActionContract would supply). */
export function syntheticAuthorisedAction(over: Partial<AuthorisedActionSnapshot> = {}): AuthorisedActionSnapshot {
  return {
    authorisationReference: 'AUTH-SYNTH-0001', actionType: 'DOMAIN_BLOCK', targetType: 'DOMAIN',
    targetReference: 'licensed-example-003.test', jurisdiction: 'ZA-GP', policyReference: 'POLV-0001-1',
    authorityReference: 'SYN-AUTH-REF-0001', caseReference: 'GC-INTAKE-0001',
    evidenceManifestReference: 'EXPORT-SYNTH-0001', evidenceManifestHash: 'a'.repeat(64),
    authorisedAt: '2026-09-11T00:00:00Z', expiresAt: '2026-12-10T00:00:00Z', status: 'AUTHORISED', ...over,
  };
}
