// ─── Enterprise Correlation Layer — public API (v2.0, ADR-006 · Milestone 3.5)
//
// Regulator-plane, read-only, reference-based national intelligence. Consumes the
// SB-NAT Registry (3.4) + injected read-only providers; creates no identity,
// performs no matching/decision, and modifies no operator runtime.

export {
  EnterpriseCorrelationLayer, CORRELATION_ENGINE_VERSION, CorrelationError,
  type CorrelationEngineOptions,
} from './engine.ts';

export {
  // vocabularies
  EVENT_CATEGORIES, RISK_TIERS, riskRank, SELF_EXCLUSION_STATUSES, EXCLUSION_KINDS,
  type EventCategory, type RiskTier, type SelfExclusionStatus, type ExclusionKind,
  // providers (read-only contracts + in-memory reference provider)
  type CorrelationDataProvider, InMemoryCorrelationProvider,
  type OperatorReference, type PlayerReference, type EventReference, type RiskReference,
  type InterventionReference, type SelfExclusionReference, type ComplianceReference,
  type InvestigationReference, type TwinReference,
  // access (deny-by-default)
  ACCESS_PLANES, type AccessPlane, type AccessContext, authorise, AccessDeniedError,
  // provenance + domain models
  type ExcludedSource, type CorrelationProvenance,
  type TimelineEntry, type CrossOperatorTimeline, type OperatorParticipation,
  type RiskEvolutionEntry, type InterventionEntry, type SelfExclusionEntry, type ComplianceEntry,
  type NationalWellbeingSummary, type NationalPlayerTwin, type NationalBehaviourMetric,
  type OperatorSwitch, type CrossOperatorIntelligence, type NationalSelfExclusionView,
  type InvestigationView, type CorrelationDiagnostics,
  type CorrelationIntegrityCheck, type CorrelationIntegrityReport,
} from './model.ts';
