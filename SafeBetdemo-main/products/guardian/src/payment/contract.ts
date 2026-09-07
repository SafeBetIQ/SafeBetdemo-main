// ─── SafeBet Guardian — Payment Reference Contract (ARCH-V4-C5) ───────────────
//
// The GOVERNED interface by which OTHER Guardian modules (e.g. Geo & Jurisdiction
// Intelligence) obtain a bounded Payment/merchant-channel reference — WITHOUT
// depending on Payment Intelligence's persistence implementation or base tables.
// Parallel to the Domain (C3.1) and App (C4) Reference Contracts.
//
//   Owner:     Payment Intelligence (C4)
//   Consumers: Geo & Jurisdiction Intelligence (C5), future modules
//   Returns:   ONLY the bounded fields below. Jurisdiction-scoped.
//
// Two aligned implementations: this pure TS function (over the synthetic payment
// fixtures) and the bounded DB view `guardian.payment_reference`. Neither exposes
// guardian.merchant_subject / guardian.payment_subject to the consumer.

import { SYNTHETIC_PAYMENT_FIXTURES } from './fixtures.ts';
import { normaliseMerchant } from './normalise.ts';

export type PaymentReferenceMatchState = 'REFERENCED' | 'PAYMENT_REFERENCE_NOT_FOUND';

export interface PaymentReferenceQuery { merchantReference: string; jurisdiction: string; correlationId?: string }

export interface PaymentReference {
  matchState: PaymentReferenceMatchState;
  paymentReferenceId: string | null;
  merchantReferenceState: 'REFERENCED' | 'NOT_FOUND';
  jurisdiction: string;
  channelType: string;
  freshness: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';
  referenceStatus: 'REFERENCED' | 'NOT_FOUND';
}

/** Resolve a bounded Payment reference for one merchant reference in one jurisdiction.
 *  Jurisdiction-scoped: a merchant known only in another jurisdiction returns
 *  PAYMENT_REFERENCE_NOT_FOUND (never cross-jurisdiction data). NOT_FOUND is a bounded
 *  no-match — it is NOT illegal. */
export function resolvePaymentReference(q: PaymentReferenceQuery): PaymentReference {
  const canonical = normaliseMerchant(q.merchantReference, '').canonicalReference;
  const known = Object.values(SYNTHETIC_PAYMENT_FIXTURES).find(
    (p) => p.jurisdiction === q.jurisdiction && normaliseMerchant(p.merchantReference, '').canonicalReference === canonical,
  );
  if (!known) {
    return { matchState: 'PAYMENT_REFERENCE_NOT_FOUND', paymentReferenceId: null, merchantReferenceState: 'NOT_FOUND', jurisdiction: q.jurisdiction, channelType: 'UNKNOWN', freshness: 'UNKNOWN', referenceStatus: 'NOT_FOUND' };
  }
  return { matchState: 'REFERENCED', paymentReferenceId: null, merchantReferenceState: 'REFERENCED', jurisdiction: q.jurisdiction, channelType: known.channel, freshness: 'FRESH', referenceStatus: 'REFERENCED' };
}
