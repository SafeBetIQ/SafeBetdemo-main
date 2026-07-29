// ─── National Identity Federation — core types (v2.0, ADR-006) ───────────────
//
// Phase 3.1 Foundation. Implements ONLY the type framework for the frozen
// architecture (ADR-006 §Phase-2.1). NO matching, NO decision, NO SB-NAT
// minting, NO merge — those are Milestones 3.2 / 3.3 / 3.4.
//
// Governance: every file references ADR-006. `SB-NAT` is an Enterprise
// Correlation Identity (NOT customer/operator/casino/system-of-record/runtime).
// `SB-PLR` remains the canonical operational identity, unchanged.

/** Matching attributes an operator may contribute (as salted hashes, never PII). */
export const ATTRIBUTE_TYPES = [
  'national_id', 'passport', 'phone', 'email',
  'loyalty_number', 'device_fingerprint', 'payment_instrument',
] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

/** Sovereign jurisdiction codes (extensible; each isolated — ADR-006 §Phase-2(5)). */
export const JURISDICTION_CODES = ['ZA', 'NA', 'BW', 'KE'] as const;
export type JurisdictionCode = (typeof JURISDICTION_CODES)[number];

/** Attribute strength band → weight (jurisdiction-configurable). */
export type AttributeStrength = 'strong' | 'medium' | 'soft';

/** Explainable confidence tier of a federation link (Design §5). */
export const CONFIDENCE_TIERS = ['confirmed', 'probable', 'possible', 'rejected'] as const;
export type ConfidenceTier = (typeof CONFIDENCE_TIERS)[number];

/** National Player Twin / SB-NAT lifecycle states (Design §13). */
export const LIFECYCLE_STATES = [
  'created', 'updated', 're-evaluated', 'split', 'merged', 'retired', 'archived',
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** The immutable five-part federation version stamp (Design §20). */
export interface FederationVersionStamp {
  federationAlgorithmVersion: string;   // e.g. '2.0'
  matchingPolicyVersion: string;        // e.g. '1.4'
  jurisdictionVersion: string;          // e.g. 'ZA-2027'
  decisionEngineVersion: string;        // e.g. '2.0'
  ruleSetVersion: string;               // e.g. 'RG-01'
}

/** A single hashed matching attribute contributed by an operator (never PII). */
export interface AttributeHash {
  attributeType: AttributeType;
  /** Non-reversible salted keyed hash of the normalised value. */
  hash: string;
  /** Pepper key version used, so rotation is auditable (Security). */
  pepperKeyVersion: string;
}

/** An operator's write-only federation contribution for one of its own players. */
export interface FederationContribution {
  jurisdiction: JurisdictionCode;
  casinoId: string;
  /** The operator's own canonical operational identity (unchanged). */
  sbPlr: string;
  attributes: AttributeHash[];
  contributedAt: string;
}

/** Evidence classification for a matched or ignored attribute (types only — no values). */
export interface AttributeEvidence {
  attributeType: AttributeType;
  strength: AttributeStrength;
  weight: number;
  /** Why it was ignored (present but excluded by the jurisdiction profile), if applicable. */
  ignoredReason?: string;
}

/** Which attribute-matching rule was skipped, and why (explainability, Design §17). */
export interface SkippedRule {
  ruleId: string;
  reason: string;
}

/** The immutable subset of the version stamp the Matching Engine can assert (no Decision Engine version). */
export interface MatchingVersions {
  federationAlgorithmVersion: string;
  matchingPolicyVersion: string;
  jurisdictionVersion: string;
  ruleSetVersion: string;
}

/**
 * Candidate match — PRODUCED by the Identity Matching Engine (Milestone 3.2).
 * A candidate is NEVER a decision: the engine returns a confidence *score* and
 * evidence, and does NOT interpret it into a tier, apply thresholds, or accept /
 * reject / merge. The Federation Decision Engine (3.3) does that.
 */
export interface FederationCandidate {
  candidateId: string;                    // deterministic; stable for the same pair + rule set
  jurisdiction: JurisdictionCode;
  sbPlrA: string;
  sbPlrB: string;
  casinoA: string;
  casinoB: string;
  /** Confidence SCORE only (sum of matched weights). NOT interpreted. */
  confidenceScore: number;
  /** Attributes that matched (type + strength + weight). No values/hashes. */
  evidenceUsed: AttributeEvidence[];
  /** Attributes present but not matched (different hash, one-sided, or profile-ignored). */
  evidenceNotMatched: AttributeEvidence[];
  matchingRulesApplied: string[];
  rulesEvaluated: string[];
  rulesSkipped: SkippedRule[];
  ruleEvaluationOrder: string[];
  versions: MatchingVersions;
}

/** Deterministic matching diagnostics/metrics (no timing in the deterministic fields). */
export interface MatchingDiagnostics {
  jurisdiction: JurisdictionCode;
  contributions: number;
  distinctPlayers: number;
  attributesIndexed: number;
  pairsConsidered: number;
  candidatesGenerated: number;
  rulesInProfile: number;
}

/** The full deterministic output of one matching run. */
export interface MatchingResult {
  candidates: FederationCandidate[];
  diagnostics: MatchingDiagnostics;
}

// ─── Federation Decision Engine (Milestone 3.3) ──────────────────────────────
// The governance authority. Consumes candidates; decides approve/review/reject
// by configurable policy. NEVER creates SB-NAT or merges identities (3.4).

/** The three governed decision outcomes. */
export const DECISION_OUTCOMES = ['auto-approved', 'manual-review', 'rejected'] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/** Manual-review workflow states (governance objects only; no UI). */
export const REVIEW_STATES = ['pending-review', 'approved', 'rejected', 'returned', 'escalated'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/** Appeal workflow states (governance objects only; no UI/notifications). */
export const APPEAL_STATES = ['open', 'under-review', 'upheld', 'dismissed', 'closed'] as const;
export type AppealState = (typeof APPEAL_STATES)[number];

export type OverrideStatus = 'none' | 'overridden';

/** A single evaluated policy rule and whether it passed (explainability). */
export interface DecisionRuleResult { ruleId: string; description: string; passed: boolean; }

/** Six-part version stamp permanently stored on every decision (version governance). */
export interface DecisionVersions {
  federationAlgorithmVersion: string;
  matchingEngineVersion: string;
  decisionEngineVersion: string;
  matchingPolicyVersion: string;
  ruleSetVersion: string;
  jurisdictionVersion: string;
}

/** Append-only history entry (decision / review / override / appeal transitions). */
export interface DecisionHistoryEntry { at: string; actor: string; action: string; from: string; to: string; reason: string; }

/**
 * An immutable federation DECISION about a candidate. It records whether the
 * candidate is approved/review/rejected, why, the full evidence and versions,
 * and the review/appeal/override governance state — but it is NOT an identity
 * and creates NO SB-NAT (that is the Registry, Milestone 3.4).
 */
export interface FederationDecision {
  decisionId: string;
  candidateId: string;
  jurisdiction: JurisdictionCode;
  sbPlrA: string;
  sbPlrB: string;
  casinoA: string;
  casinoB: string;
  outcome: DecisionOutcome;
  reason: string;
  confidenceScore: number;
  rulesEvaluated: DecisionRuleResult[];
  rulesPassed: string[];
  rulesFailed: string[];
  evidenceAccepted: AttributeEvidence[];
  evidenceRejected: AttributeEvidence[];
  versions: DecisionVersions;
  timestamp: string;
  reviewer: string;
  reviewState: ReviewState | null;
  appealState: AppealState | null;
  overrideStatus: OverrideStatus;
  decisionHistory: DecisionHistoryEntry[];
  overrideHistory: DecisionHistoryEntry[];
  appealHistory: DecisionHistoryEntry[];
}

/** Deterministic decision diagnostics over a batch of candidates. */
export interface DecisionDiagnostics {
  jurisdiction: JurisdictionCode;
  candidates: number;
  autoApproved: number;
  manualReview: number;
  rejected: number;
}

/** The anonymous Enterprise Correlation Identity. Format: SB-NAT-<CC>-<hex>. */
export type SbNatId = string;

/**
 * Immutable federation decision audit record (Design §22). Captures EVERYTHING
 * needed to reproduce an identity decision years later. NEVER contains PII.
 */
export interface FederationDecisionAudit {
  auditId: string;
  jurisdiction: JurisdictionCode;
  subjectSbNat: SbNatId | null;         // null before an SB-NAT is minted (3.3)
  affectedSbPlr: string[];
  evidenceUsed: AttributeEvidence[];
  evidenceIgnored: AttributeEvidence[];
  matchingRules: string[];
  decisionRule: string;
  confidence: { tier: ConfidenceTier; score: number };
  versions: FederationVersionStamp;
  reviewer: string;                     // 'system' | `regulator:<id>`
  timestamp: string;
  overrideHistory: { at: string; actor: string; from: string; to: string; reason: string }[];
  appealHistory: { at: string; actor: string; outcome: string; reason: string }[];
}
