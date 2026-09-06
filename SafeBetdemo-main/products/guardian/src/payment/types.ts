// ─── SafeBet Guardian — Payment Intelligence types (ARCH-V4-C4) ───────────────
//
// Provider-neutral merchant / payment-channel intelligence. SYNTHETIC ONLY. Produces
// a STRUCTURED result that is NEITHER a legal finding NOR an enforcement authorisation.
//
// PAYMENT CHANNEL OBSERVED != ILLEGAL · MERCHANT NOT MATCHED != ILLEGAL · BANK/PSP
// ASSOCIATION != LEGAL FINDING · HIGH REVIEW PRIORITY != ENFORCEMENT · DETECTION !=
// PAYMENT ACTION. Never block/freeze/terminate. PRIVACY: no PAN/CVV/raw bank/card data.

import type { ProductTag } from '../product.ts';
import type { MatchState, ResolutionState, FreshnessStatus } from '../registry/types.ts';
// ReviewPriority is shared (identical vocabulary) — import for internal use, not re-exported.
import type { ReviewPriority } from '../domain/types.ts';

export type PaymentChannel = 'CARD' | 'BANK_TRANSFER' | 'EFT' | 'WALLET' | 'VOUCHER' | 'MOBILE_PAYMENT' | 'CRYPTO_REFERENCE' | 'OTHER' | 'UNKNOWN';
export type ProviderType = 'PAYMENT_SERVICE_PROVIDER' | 'BANKING_PROVIDER' | 'ACQUIRER' | 'PAYMENT_PLATFORM' | 'WALLET_PROVIDER';

export type PaymentReasonCode =
  | 'NO_AUTHORITATIVE_REGISTRY_MATCH'
  | 'MERCHANT_OPERATOR_MISMATCH'
  | 'MERCHANT_BRAND_MISMATCH'
  | 'LICENCE_RECORD_STALE'
  | 'SOURCE_CONFLICT'
  | 'UNKNOWN_PROVIDER_REFERENCE'
  | 'DOMAIN_REFERENCE_MISMATCH'
  | 'APP_REFERENCE_MISMATCH'
  | 'MERCHANT_DESCRIPTOR_CHANGED'
  | 'PAYMENT_CHANNEL_CHANGED'
  | 'UNVERIFIED_PAYMENT_REFERENCE';

export type PaymentReviewState = 'NEW' | 'TRIAGED' | 'REQUIRES_REVIEW' | 'VERIFIED_REFERENCE' | 'UNRESOLVED' | 'CLOSED';
export type PaymentLinkType = 'OPERATOR' | 'BRAND' | 'LICENCE' | 'DOMAIN' | 'APP';

/** SYNTHETIC payment/merchant fixture — provider-neutral aggregates only (no PAN/CVV). */
export interface PaymentFixture {
  merchantReference: string;
  merchantDescriptor: string;
  jurisdiction: string;
  channel: PaymentChannel;
  providerReference: string;              // provider-neutral token/reference (not a real credential)
  providerType: ProviderType;
  declaredOperatorName?: string | null;
  declaredBrand?: string | null;
  declaredLicenceReference?: string | null;
  declaredWebsite?: string | null;        // resolved via the Domain Reference Contract
  declaredAppIdentifier?: string | null;  // resolved via the App Reference Contract
  amountAggregate?: number | null;        // synthetic aggregate only
  currency?: string | null;
  contentHash: string;
  evidenceReference: string;
}

export interface PaymentReferenceLink { linkType: PaymentLinkType; targetReference: string; referenceMatchState: string; confidence: 'LOW' | 'MEDIUM' | 'HIGH' }

export interface PaymentIntelligenceResult {
  product: 'GUARDIAN';
  jurisdiction: string;
  paymentSubjectId: string;
  merchantSubjectId: string;
  observationId: string;
  channel: PaymentChannel;
  providerType: ProviderType;
  providerReferenceCategory: string;
  registryMatchState: MatchState | 'NO_MATCH';
  resolutionState: ResolutionState;
  candidateOperatorId: string | null;
  candidateBrandId: string | null;
  licenceReference: string | null;
  licenceVerificationState: string | null;
  registryFreshness: FreshnessStatus;
  referenceLinks: PaymentReferenceLink[];   // operator/brand/licence/domain/app links
  reviewPriority: ReviewPriority;
  reviewRequired: boolean;
  reasonCodes: PaymentReasonCode[];
  provenance: { evidenceReferences: string[]; sourceRecordIds: string[] };
  isIllegalDetermination: false;            // ALWAYS false
  isEnforcementAuthorised: false;           // ALWAYS false
  classification: 'REFERENCE_MATCHED' | 'POTENTIALLY_UNVERIFIED_REQUIRES_REVIEW' | 'REQUIRES_HUMAN_REVIEW' | 'INSUFFICIENT_DATA';
  note: string;
}
