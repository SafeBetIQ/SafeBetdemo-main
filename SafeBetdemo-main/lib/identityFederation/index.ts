// ─── National Identity Federation — public API (v2.0, ADR-006) ───────────────
//
// Phase 3.1 Foundation. THE only entry point to the federation framework. This
// is additive, regulator-plane, OFF BY DEFAULT, and not wired into any operator
// path. `SB-PLR` (system of record) and the certified operator flow are
// unchanged. Matching (3.2), decision (3.3), registry (3.4), correlation layer
// (3.5), national policy (3.6) are added by later milestones behind these seams.

export {
  ATTRIBUTE_TYPES, JURISDICTION_CODES, CONFIDENCE_TIERS, LIFECYCLE_STATES,
  type AttributeType, type JurisdictionCode, type AttributeStrength,
  type ConfidenceTier, type LifecycleState, type FederationVersionStamp,
  type AttributeHash, type FederationContribution, type AttributeEvidence,
  type FederationCandidate, type SbNatId, type FederationDecisionAudit,
  type SkippedRule, type MatchingVersions, type MatchingDiagnostics, type MatchingResult,
  DECISION_OUTCOMES, REVIEW_STATES, APPEAL_STATES,
  type DecisionOutcome, type ReviewState, type AppealState, type OverrideStatus,
  type DecisionRuleResult, type DecisionVersions, type DecisionHistoryEntry,
  type FederationDecision, type DecisionDiagnostics,
} from './types.ts';

export { IdentityMatchingEngine } from './matchingEngine.ts';
export { FederationDecisionEngine, isApprovedDecision, type DecisionResult } from './decisionEngine.ts';
export { MATCHING_ENGINE_VERSION, buildDecisionVersionStamp } from './version.ts';
export { type DecisionPolicy } from './jurisdictionProfiles.ts';

export {
  SbNatRegistry, REGISTRY_STATES, REGISTRY_ACTIONS, reconstructSbNatRegistry,
  type RegistryState, type RegistryAction, type RegistryHistoryEvent,
  type SbNatRecord, type AssignmentEvent, type IntegrityCheck, type IntegrityReport,
  type RegistryDiagnostics, type RegistryOptions, type RegistryJournal,
} from './registry.ts';

// Pilot Regulator-Plane Persistence (Milestone 4.1) — durable, pilot-only.
export * from './persistence/index.ts';

// Pilot Federation Cryptographic Operations (Milestone 4.2) — HMAC + pepper mgmt.
export * from './crypto/index.ts';

// Operator Federation Contribution + Event Platform wiring (Milestone 4.3).
export * from './contribution/index.ts';

// Operator Connector Sandbox (Milestone 4.4) — controlled, non-production.
export * from './connector/index.ts';

// Wagering & GGR Reconciliation (Milestone 4.5) — sandbox/pilot-path financial pipeline.
export * from './financial/index.ts';

// Deployed Runtime composition + smoke (Milestone 4.6) — in-process, non-production.
export * from './runtime/index.ts';

// Enterprise Correlation Layer (Milestone 3.5) — regulator-plane, read-only.
export * from './correlation/index.ts';

// National Policy Platform Extension (Milestone 3.6) — regulator-plane, policy-as-data.
export * from './policy/index.ts';

// National Demonstration Dataset v2.0 (Milestone 3.7) — deterministic, synthetic, demo-only.
export * from './demo/index.ts';

export {
  type FederationConfig, defaultFederationConfig, resolveFederationConfig, isFederationEnabled,
} from './config.ts';

export {
  type AttributeRule, type JurisdictionProfile,
  getJurisdictionProfile, isAttributeEnabled, listJurisdictions,
} from './jurisdictionProfiles.ts';

export {
  FEDERATION_ALGORITHM_VERSION, DECISION_ENGINE_VERSION, RULE_SET_VERSION,
  buildVersionStamp, describeVersionStamp,
} from './version.ts';

export {
  sealAuditRecord, type AuditSink, InMemoryAuditSink,
} from './audit.ts';

export {
  normaliseAttribute, type Digest, type PepperProvider, type AttributeHasher, HmacAttributeHasher,
} from './security.ts';

export { formatSbNat, isSbNat, jurisdictionOfSbNat } from './identifiers.ts';

export {
  NationalIdentityFederationService, getFederationService, __resetFederationService,
  type FederationDependencies, FederationNotEnabledError, MilestoneNotImplementedError,
} from './service.ts';
