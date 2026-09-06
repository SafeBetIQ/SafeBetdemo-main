// ─── SafeBet Guardian — Mobile App Intelligence types (ARCH-V4-C3) ────────────
//
// Provider-neutral. SYNTHETIC ONLY. Produces a STRUCTURED NON-LEGAL result; never a
// legal finding, never illegal=true, never app-removal/enforcement.
//
// APP DISCOVERED != ILLEGAL · APP NOT IN REGISTRY != ILLEGAL · PLATFORM PRESENCE !=
// LEGAL AUTHORISATION · HIGH REVIEW PRIORITY != LEGAL FINDING · DETECTION != ENFORCEMENT.

import type { ProductTag } from '../product.ts';
import type { MatchState, ResolutionState, FreshnessStatus } from '../registry/types.ts';
// ReviewPriority is shared with the domain module (identical vocabulary) — import for
// internal use only (not re-exported) to avoid a duplicate star-export collision.
import type { ReviewPriority } from '../domain/types.ts';

export type AppReasonCode =
  | 'NO_AUTHORITATIVE_REGISTRY_MATCH'
  | 'DECLARED_LICENCE_MISMATCH'
  | 'DECLARED_OPERATOR_MISMATCH'
  | 'DECLARED_BRAND_MISMATCH'
  | 'LICENCE_RECORD_STALE'
  | 'SOURCE_CONFLICT'
  | 'PUBLISHER_CHANGED'
  | 'APP_IDENTIFIER_CHANGED'
  | 'DECLARED_WEBSITE_CHANGED'
  | 'METADATA_FINGERPRINT_CHANGED'
  | 'GAMBLING_CONTENT_SIGNAL'
  | 'UNKNOWN_PUBLISHER_REFERENCE';

export type PlatformType = 'MOBILE_APP' | 'MOBILE_WEB_WRAPPER' | 'PROGRESSIVE_WEB_APP_REFERENCE' | 'UNKNOWN_MOBILE_DISTRIBUTION';
export type AppReviewState = 'NEW' | 'TRIAGED' | 'REQUIRES_REVIEW' | 'VERIFIED_REFERENCE' | 'UNRESOLVED' | 'CLOSED';
export type AppDomainLinkType = 'APP_DECLARED_WEBSITE' | 'APP_SUPPORT_DOMAIN' | 'APP_PRIVACY_DOMAIN' | 'APP_OPERATOR_DOMAIN_CANDIDATE';

export interface AppSubject {
  appSubjectId: string;                 // immutable Guardian id (NOT the package id)
  product: ProductTag;
  canonicalAppIdentifier: string;
  displayName: string;
  platformType: PlatformType;
  developerDisplayName?: string | null;
  jurisdiction: string;
  isSynthetic: boolean;
}

/** SYNTHETIC app metadata fixture (no real platform access, ever). */
export interface AppFixture {
  appIdentifier: string;
  jurisdiction: string;
  displayName: string;
  platformType: PlatformType;
  developer: string;
  version: string;
  description: string;
  declaredWebsite?: string | null;
  privacyReference?: string | null;
  supportReference?: string | null;
  declaredLicenceReference?: string | null;
  declaredOperatorName?: string | null;
  declaredBrand?: string | null;
  contentHash: string;
  metadataHash: string;
  evidenceReference: string;
}

export interface AppContentSignal { signalType: string; present: boolean; detail?: string }
export interface AppTechnicalSignal { signalType: string; value: string }
export interface AppDomainRef { linkType: AppDomainLinkType; declaredDomain: string; matchedDomainId: string | null; confidence: 'LOW' | 'MEDIUM' | 'HIGH' }

export interface AppIntelligenceResult {
  product: 'GUARDIAN';
  jurisdiction: string;
  appSubjectId: string;
  canonicalAppIdentifier: string;
  observationId: string;
  platformType: PlatformType;
  registryMatchState: MatchState | 'NO_MATCH';
  resolutionState: ResolutionState;
  candidateOperatorId: string | null;
  candidateBrandId: string | null;
  licenceReference: string | null;
  licenceVerificationState: string | null;
  registryFreshness: FreshnessStatus;
  contentSignals: AppContentSignal[];
  technicalSignals: AppTechnicalSignal[];
  domainReferences: AppDomainRef[];
  reviewPriority: ReviewPriority;
  reviewRequired: boolean;
  reasonCodes: AppReasonCode[];
  provenance: { evidenceReferences: string[]; sourceRecordIds: string[] };
  isIllegalDetermination: false;         // ALWAYS false at C3
  classification: 'REFERENCE_MATCHED' | 'POTENTIALLY_UNAUTHORISED_REQUIRES_VERIFICATION' | 'REQUIRES_HUMAN_REVIEW' | 'INSUFFICIENT_DATA';
  note: string;
}
