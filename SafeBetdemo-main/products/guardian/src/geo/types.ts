// ─── SafeBet Guardian — Geo & Jurisdiction Intelligence types (ARCH-V4-C5) ────
//
// Property / service / jurisdiction-level intelligence. SYNTHETIC ONLY. Produces a
// STRUCTURED result that is NEITHER a legal finding NOR an enforcement authorisation.
//
// CORE PRIVACY BOUNDARY:  GEO INTELLIGENCE != INDIVIDUAL SURVEILLANCE.
//   The default data unit is PROPERTY / SERVICE / DOMAIN / APP / OPERATOR / AGGREGATE
//   REGION — never a PERSON. There is deliberately NO person-level field (no playerId /
//   customerId / subscriberId / deviceAdId / mobileNumber / individual ip history /
//   browsing history / precise persistent personal geolocation) in this model.
//
// SERVICE OBSERVED IN REGION != ILLEGAL · SERVICE AVAILABLE ACROSS JURISDICTION !=
// LEGAL VIOLATION · LICENCE JURISDICTION MISMATCH != FINAL LEGAL FINDING · UNKNOWN GEO
// SIGNAL != ILLEGAL · HIGH REVIEW PRIORITY != ENFORCEMENT. No geo-block / service-block.

import type { MatchState, ResolutionState, FreshnessStatus } from '../registry/types.ts';
// ReviewPriority is shared vocabulary — import for internal use, not re-exported.
import type { ReviewPriority } from '../domain/types.ts';

/** Geo subject references a SERVICE / PROPERTY, never a person. */
export type GeoSubjectType = 'DOMAIN' | 'MOBILE_APP' | 'OPERATOR' | 'BRAND' | 'PAYMENT_CHANNEL' | 'SERVICE' | 'INFRASTRUCTURE_REFERENCE';

/** Only lawful/public/regulator-approved synthetic signal classes. */
export type GeoSignalClass =
  | 'DECLARED_SERVICE_JURISDICTION'
  | 'LICENCE_JURISDICTION'
  | 'DOMAIN_REGIONAL_AVAILABILITY'
  | 'APP_DECLARED_TERRITORY'
  | 'PAYMENT_CHANNEL_JURISDICTION'
  | 'HOSTING_SERVICE_REGION'
  | 'REGULATOR_AGGREGATE_REGIONAL_OBSERVATION'
  | 'SYNTHETIC_NETWORK_LOCATION_METADATA'
  | 'SYNTHETIC_ACCESSIBILITY_OBSERVATION'
  | 'AGGREGATE_REGION_VISIBILITY_METRIC';

/** Neutral OBSERVATIONAL availability states. Note: NO 'ILLEGAL_IN_REGION'. */
export type GeoAvailabilityState = 'AVAILABLE' | 'NOT_OBSERVED' | 'RESTRICTED_BY_FIXTURE' | 'UNKNOWN' | 'INCONSISTENT' | 'REQUIRES_REVIEW';

export type GeoReasonCode =
  | 'NO_AUTHORITATIVE_REGISTRY_MATCH'
  | 'SERVICE_REGION_MISMATCH'
  | 'LICENCE_JURISDICTION_MISMATCH'
  | 'DECLARED_REGION_MISMATCH'
  | 'REGISTRY_REFERENCE_STALE'
  | 'DOMAIN_REGION_INCONSISTENCY'
  | 'APP_REGION_INCONSISTENCY'
  | 'PAYMENT_REGION_INCONSISTENCY'
  | 'SOURCE_CONFLICT'
  | 'UNKNOWN_REGION_REFERENCE'
  | 'REGIONAL_AVAILABILITY_CHANGED';

export type GeoReviewState = 'NEW' | 'TRIAGED' | 'REQUIRES_REVIEW' | 'VERIFIED_REFERENCE' | 'UNRESOLVED' | 'CLOSED';
export type GeoLinkType = 'OPERATOR' | 'BRAND' | 'LICENCE' | 'DOMAIN' | 'APP' | 'PAYMENT';

export interface GeoRegionRef { regionId: string; regionCode: string; regionType: string; country: string; jurisdiction: string }

/** SYNTHETIC geo fixture — property/service/region references only (no person data). */
export interface GeoFixture {
  geoReference: string;                    // service/property reference (hostname/app id/etc.)
  subjectType: GeoSubjectType;
  jurisdiction: string;                    // the OBSERVING Guardian jurisdiction
  region: GeoRegionRef;                    // observed region
  observationType: string;
  availabilityState: GeoAvailabilityState;
  signalClass: GeoSignalClass;
  declaredServiceJurisdiction?: string | null;
  declaredOperatorName?: string | null;
  declaredBrand?: string | null;
  declaredLicenceReference?: string | null;
  declaredWebsite?: string | null;         // resolved via the Domain Reference Contract
  declaredAppIdentifier?: string | null;   // resolved via the App Reference Contract
  declaredMerchantReference?: string | null; // resolved via the Payment Reference Contract
  aggregateVisibilityMetric?: number | null; // region-level aggregate only
  sourceAsOf?: string | null;
  contentHash: string;
  evidenceReference: string;
}

export interface GeoReferenceLink { linkType: GeoLinkType; targetReference: string; referenceMatchState: string; confidence: 'LOW' | 'MEDIUM' | 'HIGH' }

export interface GeoIntelligenceResult {
  product: 'GUARDIAN';
  jurisdiction: string;
  geoSubjectId: string;
  observationId: string;
  subjectType: GeoSubjectType;
  region: GeoRegionRef;
  expectedRegulatoryJurisdiction: string | null;
  observedAvailabilityState: GeoAvailabilityState;
  registryMatchState: MatchState | 'NO_MATCH';
  resolutionState: ResolutionState;
  candidateOperatorId: string | null;
  licenceReference: string | null;
  licenceJurisdiction: string | null;
  domainReferenceState: string | null;
  appReferenceState: string | null;
  paymentReferenceState: string | null;
  registryFreshness: FreshnessStatus;
  referenceLinks: GeoReferenceLink[];       // operator/brand/licence/domain/app/payment links
  reviewPriority: ReviewPriority;
  reviewRequired: boolean;
  reasonCodes: GeoReasonCode[];
  provenance: { evidenceReferences: string[]; sourceRecordIds: string[] };
  freshness: { geoObservedAt: string | null; sourceAsOf: string | null; registryLastVerified: string | null };
  isIllegalDetermination: false;            // ALWAYS false
  isEnforcementAuthorised: false;           // ALWAYS false
  classification: 'REGION_REFERENCE_MATCHED' | 'REGIONAL_INCONSISTENCY_REQUIRES_REVIEW' | 'REQUIRES_HUMAN_REVIEW' | 'INSUFFICIENT_DATA';
  note: string;
}
