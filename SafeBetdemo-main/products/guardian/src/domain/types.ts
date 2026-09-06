// ─── SafeBet Guardian — Domain & Website Intelligence types (ARCH-V4-C2) ──────
//
// Guardian's first external-subject intelligence domain. SYNTHETIC ONLY. Produces
// a STRUCTURED, NON-LEGAL intelligence result. It never produces an enforceable
// legal finding and never returns illegal=true.
//
// SAFETY INVARIANTS (encoded + tested):
//   DOMAIN DISCOVERED != ILLEGAL DOMAIN
//   NO LEGAL REGISTRY MATCH != ILLEGAL OPERATOR
//   HIGH-RISK SIGNAL != LEGAL FINDING ; DETECTION != ENFORCEMENT AUTHORISATION

import type { ProductTag } from '../product.ts';
import type { MatchState, ResolutionState, FreshnessStatus } from '../registry/types.ts';

/** Investigation-priority — NOT legal-illegality probability. */
export type ReviewPriority = 'LOW_REVIEW_PRIORITY' | 'MEDIUM_REVIEW_PRIORITY' | 'HIGH_REVIEW_PRIORITY';

/** Explicit reason codes. They support review; they never create a legal finding. */
export type ReasonCode =
  | 'NO_AUTHORITATIVE_REGISTRY_MATCH'
  | 'LICENCE_RECORD_STALE'
  | 'BRAND_OPERATOR_MISMATCH'
  | 'LICENCE_REFERENCE_MISMATCH'
  | 'SOURCE_CONFLICT'
  | 'CONTENT_GAMBLING_SIGNAL'
  | 'REDIRECT_CHANGED'
  | 'DOMAIN_FINGERPRINT_CHANGED'
  | 'UNKNOWN_OPERATOR_REFERENCE';

export type DomainReviewState = 'NEW' | 'TRIAGED' | 'REQUIRES_REVIEW' | 'VERIFIED_REFERENCE' | 'UNRESOLVED' | 'CLOSED';
export type DomainReviewDecision =
  | 'REFERENCE_MATCH_CONFIRMED' | 'NO_REFERENCE_FOUND' | 'SOURCE_DATA_INSUFFICIENT'
  | 'REQUIRES_FURTHER_INVESTIGATION' | 'FALSE_POSITIVE' | 'DUPLICATE_SUBJECT';

export interface DomainSubject {
  domainId: string;               // immutable Guardian id (NOT the hostname)
  product: ProductTag;
  canonicalHostname: string;
  displayHostname: string;
  jurisdiction: string;
  status: string;
  isSynthetic: boolean;
}

/** A SYNTHETIC website capture fixture (no live network access — ever). */
export interface WebsiteFixture {
  hostname: string;
  jurisdiction: string;
  pageTitle: string;
  visibleText: string;
  links: string[];
  resourceReferences: string[];
  httpStatus: number;
  tlsPresent: boolean;
  redirectTarget?: string | null;
  contentHash: string;
  evidenceReference: string;
  // optional explicit synthetic metadata the operator embedded (brand/licence claims)
  claimedBrand?: string | null;
  claimedLicenceReference?: string | null;
  claimedOperatorName?: string | null;
}

export interface TechnicalSignal { signalType: string; value: string }
export interface ContentSignal { signalType: string; present: boolean; detail?: string }

export interface DomainIntelligenceResult {
  product: 'GUARDIAN';
  jurisdiction: string;
  domainId: string;
  canonicalHostname: string;
  observationId: string;
  registryMatchState: MatchState | 'NO_MATCH';
  resolutionState: ResolutionState;
  candidateOperatorId: string | null;
  candidateBrandId: string | null;
  licenceReference: string | null;
  licenceVerificationState: string | null;
  registryFreshness: FreshnessStatus;
  technicalSignals: TechnicalSignal[];
  contentSignals: ContentSignal[];
  reviewPriority: ReviewPriority;
  reviewRequired: boolean;
  reasonCodes: ReasonCode[];
  provenance: { evidenceReferences: string[]; sourceRecordIds: string[] };
  /** ALWAYS false at C2 — encoded so no caller reads an automated illegality determination. */
  isIllegalDetermination: false;
  classification: 'POTENTIALLY_UNAUTHORISED_REQUIRES_VERIFICATION' | 'REFERENCE_MATCHED' | 'REQUIRES_HUMAN_REVIEW' | 'INSUFFICIENT_DATA';
  note: string;
}
