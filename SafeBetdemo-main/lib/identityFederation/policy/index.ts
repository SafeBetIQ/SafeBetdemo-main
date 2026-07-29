// ─── National Policy Platform Extension — public API (v2.0, ADR-006 · 3.6) ───
//
// Regulator-plane, additive, policy-as-DATA. Consumes read-only Enterprise
// Correlation Layer outputs and evaluates jurisdiction-specific policies into
// deterministic, versioned, auditable outcomes. Never modifies operator runtime,
// SB-PLR, SB-NAT, the Registry, or the Correlation Layer.

export {
  NationalPolicyEngine, NATIONAL_POLICY_ENGINE_VERSION, PolicyEngineError, projectFacts,
  type PolicyEngineOptions,
} from './engine.ts';

export {
  // vocabularies
  POLICY_CATEGORIES, POLICY_OUTCOMES, POLICY_STATUSES, CONDITION_OPERATORS,
  POLICY_REVIEW_STATES, POLICY_APPEAL_STATES, POLICY_ROLES, POLICY_AUDIT_ACTIONS,
  type PolicyCategory, type PolicyOutcome, type PolicyStatus, type ConditionOperator,
  type PolicyReviewState, type PolicyAppealState, type PolicyOverrideStatus, type PolicyRole,
  type PolicyFactValue, type PolicyAuditAction,
  // definitions + evaluation
  type PolicyCondition, type PolicyOutcomeRule, type PolicyDefinition, type PolicyVersions,
  type ConditionResult, type PolicyHistoryEntry, type PolicyInput, type PolicyEvaluation,
  type PolicyConflict, type PolicyIntegrityCheck, type PolicyIntegrityReport, type PolicyDiagnostics,
  // access + audit + store + validation
  type PolicyAccessContext, authorisePolicy,
  type PolicyAuditRecord, type PolicyAuditSink, InMemoryPolicyAuditSink, sealPolicyAudit,
  PolicyValidationError, validatePolicyDefinition, isIsoDate, NationalPolicyStore,
} from './model.ts';
