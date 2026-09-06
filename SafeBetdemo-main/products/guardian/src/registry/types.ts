// ─── SafeBet Guardian — Legal Operator Registry types (ARCH-V4-C1) ────────────
//
// Guardian's authoritative legal/reference model. SYNTHETIC ONLY. This layer
// answers WHO/WHICH/WHAT-STANDING/WHAT-SOURCE/WHEN — it NEVER decides whether a
// site/app/payment is illegal.
//
// CRITICAL LEGAL-INFERENCE RULE (encoded + tested):
//   ABSENCE FROM LEGAL OPERATOR REGISTRY  !=  ILLEGAL OPERATOR
// No `ILLEGAL` value exists in any result enum below. No AI creates licence/legal
// standing. Ambiguity routes to human review.

import { type ProductTag } from '../product.ts';

/** Deterministic registry match states (no fuzzy/AI resolution at C1). */
export type MatchState = 'EXACT_MATCH' | 'KNOWN_ALIAS_MATCH' | 'MULTIPLE_CANDIDATES' | 'NO_MATCH' | 'REQUIRES_REVIEW';

/** Legal-reference standing states. Deliberately NO `ILLEGAL`. `SUSPENDED`/`REVOKED`
 *  are only ever set from an authoritative regulator record. `NO_MATCH` means only
 *  "no authoritative registry match found", never "illegal". */
export type LegalStanding =
  | 'LICENSED'                 // authoritative licence, currently effective
  | 'NOT_CURRENTLY_VERIFIED'   // record exists but not currently verified
  | 'UNKNOWN'                  // insufficient authoritative information
  | 'EXPIRED'                  // authoritative source shows lapsed/expired
  | 'LAPSED'
  | 'SUSPENDED'                // authoritative regulator record only
  | 'REVOKED'                  // authoritative regulator record only
  | 'CONFLICTING_SOURCE_DATA'  // sources disagree — never silently resolved
  | 'REQUIRES_HUMAN_REVIEW'    // ambiguous — routed to a human
  | 'NO_MATCH';                // no authoritative registry match (NOT illegal)

/** The states a `resolveLegalReference` call may return to future intelligence modules. */
export type ResolutionState =
  | 'MATCHED_AUTHORITATIVE'
  | 'MATCHED_BUT_STALE'
  | 'MULTIPLE_MATCHES'
  | 'NO_MATCH'
  | 'SOURCE_CONFLICT'
  | 'REQUIRES_REVIEW';

/** Source authority classification — not all sources are equal. C1 seeds SYNTHETIC_TEST only. */
export type SourceAuthorityLevel =
  | 'REGULATOR_AUTHORITATIVE'
  | 'REGULATOR_SUPPLIED'
  | 'VERIFIED_OFFICIAL_PUBLIC_RECORD'
  | 'OPERATOR_SUPPLIED'
  | 'THIRD_PARTY_REFERENCE'
  | 'SYNTHETIC_TEST';

export type FreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

export type AccessScope = 'JURISDICTION_LOCAL' | 'NATIONAL_REFERENCE' | 'SHARED_REGULATORY_REFERENCE' | 'RESTRICTED';

export interface OperatorEntity {
  operatorId: string;               // immutable Guardian id (NOT the legal/brand/licence name)
  product: ProductTag;
  legalName: string;
  normalisedLegalName: string;
  registrationReference?: string | null;
  country?: string | null;
  entityType?: string | null;
  jurisdiction: string;
  accessScope: AccessScope;
  status: string;
  isSynthetic: boolean;
}

export interface OperatorAlias {
  aliasId: string;
  operatorId: string;
  jurisdiction: string;
  aliasName: string;
  normalisedAlias: string;
  aliasType: string;
}

export interface Brand {
  brandId: string;
  brandName: string;
  normalisedBrand: string;
  jurisdiction: string;
  status: string;
}

export interface OperatorBrandRelationship {
  relationshipId: string;
  operatorId: string;
  brandId: string;
  jurisdiction: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
}

export interface Licence {
  licenceId: string;
  licenceReference: string;
  operatorId: string;
  issuingAuthorityId?: string | null;
  jurisdiction: string;
  licenceType: string;
  status: 'LICENSED' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | 'LAPSED' | 'UNKNOWN';
  effectiveFrom?: string | null;
  expiryDate?: string | null;
  sourceRecordId?: string | null;
  recordedAt?: string | null;
  lastVerifiedAt?: string | null;
  verificationState: 'VERIFIED' | 'NOT_CURRENTLY_VERIFIED' | 'CONFLICTING_SOURCE_DATA' | 'REQUIRES_HUMAN_REVIEW' | 'UNKNOWN';
  accessScope: AccessScope;
}

export interface RegistrySourceRecord {
  recordId: string;
  sourceId: string;
  authorityLevel: SourceAuthorityLevel;
  subjectType: string;
  subjectReference: string;
  jurisdiction: string;
  evidenceReference?: string | null;
  contentHash?: string | null;
  retrievedAt?: string | null;
  effectiveAt?: string | null;
  verificationStatus: 'INGESTED' | 'VALIDATED' | 'APPROVED' | 'SUPERSEDED' | 'REJECTED';
  assertedState?: string | null;
  isSynthetic: boolean;
}

/** A read-only registry snapshot the resolver/matcher operate over (DB-backed store
 *  of record is proven separately via SQL; the runtime serves a synthetic snapshot). */
export interface RegistrySnapshot {
  operators: OperatorEntity[];
  aliases: OperatorAlias[];
  brands: Brand[];
  operatorBrands: OperatorBrandRelationship[];
  licences: Licence[];
  sourceRecords: RegistrySourceRecord[];
}
