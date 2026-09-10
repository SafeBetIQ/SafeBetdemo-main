// ─── SafeBet Guardian — Digital Evidence Vault types (ARCH-V4-C7) ─────────────
//
// Regulator-grade evidence lifecycle ABOVE the Shared Evidence primitive. SYNTHETIC
// ONLY. Manages provenance + integrity; NEVER decides legal consequence, NEVER enforces,
// NEVER contacts providers.
//
// EVIDENCE EXISTS != LEGAL FINDING · EVIDENCE LINKED TO CASE != ILLEGAL OPERATOR · HASH
// VERIFIED != FACT LEGALLY PROVEN · HIGH-VALUE EVIDENCE != ENFORCEMENT AUTHORISATION.

export type EvidenceType = 'WEB_CAPTURE' | 'SCREENSHOT' | 'DOCUMENT' | 'REGISTRY_SOURCE_RECORD' | 'MOBILE_APP_METADATA' | 'PAYMENT_REFERENCE' | 'GEO_OBSERVATION' | 'STRUCTURED_DATA' | 'ANALYST_ATTACHMENT' | 'SYSTEM_GENERATED_REPORT' | 'OTHER';
export type EvidenceSourceDomain = 'C1_REGISTRY' | 'C2_DOMAIN' | 'C3_APP' | 'C4_PAYMENT' | 'C5_GEO' | 'C6_CASE' | 'ANALYST' | 'SYSTEM';
export type EvidenceClassification = 'PUBLIC_REFERENCE' | 'INTERNAL' | 'RESTRICTED' | 'HIGHLY_RESTRICTED';
export type VaultIntegrityStatus = 'VERIFIED' | 'INTEGRITY_FAILED' | 'UNVERIFIED';
export type LegalHoldState = 'NONE' | 'HELD';

export type CustodyEventType =
  | 'CAPTURED' | 'RECEIVED' | 'REGISTERED' | 'HASH_VERIFIED' | 'STORED' | 'ACCESSED'
  | 'LINKED_TO_CASE' | 'COPIED_FOR_EXPORT' | 'DERIVED' | 'CLASSIFICATION_CHANGED'
  | 'LEGAL_HOLD_APPLIED' | 'LEGAL_HOLD_RELEASED' | 'RETENTION_REVIEWED' | 'EXPORTED'
  | 'INTEGRITY_FAILED' | 'CORRECTION';

/** Synthetic roles (reuse C0 vocabulary). Evidence Vault actively uses Investigator /
 *  Legal Reviewer. AUTHORISING_OFFICER is modelled but C7 authorises no enforcement. */
export type EvidenceRole = 'INVESTIGATOR' | 'LEGAL_REVIEWER' | 'AUTHORISING_OFFICER' | 'SYSTEM_SERVICE';
export type AccessPurpose = 'CASE_INVESTIGATION' | 'INTEGRITY_VERIFICATION' | 'LEGAL_REVIEW_PREPARATION' | 'AUDIT' | 'EXPORT_PREPARATION' | 'SYSTEM_MAINTENANCE';

/** SYNTHETIC evidence registration fixture — a hash + reference, never a real body. */
export interface EvidenceFixture {
  evidenceReference: string;
  jurisdiction: string;
  evidenceType: EvidenceType;
  sourceDomain: EvidenceSourceDomain;
  sourceReference: string;
  classification: EvidenceClassification;
  purpose: string;
  captureMethod: string;
  captureActor: string;
  mediaType: string;
  syntheticBody: string;                 // synthetic bytes (used to compute + verify the hash)
  sizeBytes: number;
}

export interface CustodyEvent {
  custodyEventId: string;
  evidenceId: string;
  sequenceNumber: number;
  eventType: CustodyEventType;
  actor: string;
  actorRole: EvidenceRole;
  jurisdiction: string;
  occurredAt: string;
  reason?: string | null;
  previousEventHash: string;
  eventHash: string;
  correlationId?: string | null;
}

export interface EvidenceRegistrationResult {
  product: 'GUARDIAN';
  jurisdiction: string;
  evidenceId: string;
  evidenceReference: string;
  evidenceType: EvidenceType;
  sourceDomain: EvidenceSourceDomain;
  sourceReference: string;
  classification: EvidenceClassification;
  contentHash: string;
  hashAlgorithm: 'SHA-256';
  sizeBytes: number;
  mediaType: string;
  storageReference: string;
  integrityStatus: VaultIntegrityStatus;
  custodyChain: CustodyEvent[];
  provenance: { sourceReference: string; captureActor: string; captureMethod: string };
  isLegalDetermination: false;           // ALWAYS false
  isEnforcementAuthorised: false;        // ALWAYS false
  note: string;
}
