// Enterprise Consumer Platform — public API (Phase 3.7).
//
// THE presentation gateway. Every consumer — casino dashboards, regulator
// views, executive summaries, compliance workspaces, mobile apps, REST
// clients, future GraphQL — obtains information ONLY through
// getConsumerGateway().serve() (hosted by the consumer-gateway edge
// function) plus the platform's published Realtime distribution
// (casino_event_log inserts / projection_machine_state changes), shaped
// client-side with the shapers exported here. Nobody reads platform
// internals directly.

export {
  CONTRACT_VERSIONS, CURRENT_VERSION, CONSUMER_PROFILES, CONSUMER_VIEWS,
  type ConsumerProfile, type ConsumerView, type ContractVersion,
  type ConsumerResponse,
  type LiveEventView, type LiveKpiView, type MachineStatusView,
  type PlayerView, type InterventionView, type DecisionView,
  type OperatorLiveFloorView, type ActivityFeedView,
  type RegulatorComplianceView, type ExecutiveSummaryView,
  type ComplianceActionsView,
  type IntegrationHealthView,
} from './contracts.ts';
export {
  VIEW_GRANTS, authorizeView, profileForRole, ConsumerAuthorizationError,
  resolveConsumerScope, ConsumerScopeError,
  type CasinoRegistryEntry, type ResolvedConsumerScope,
} from './authorization.ts';
export { shapeEventRow, shapeMachineRow, riskLevelFor } from './shaping.ts';
export {
  reconcileOperatorKpi, reconcileFinancialPosture,
  type ReconciliationResult, type ReconciliationCheck, type IntegrityStatus,
} from './integrity.ts';
export {
  AUDIT_CHAIN_SCHEMA, AUDIT_GENESIS_HASH, canonicalJson, canonicalTimestamp,
  auditEventHash, verifyChain,
  type Sha256Hex, type AuditEventFields, type ChainVerifyResult,
  // ARCH-V4-A3: consume the audit chain via the SHARED PLATFORM FOUNDATION
  // contract, not the (now-deprecated) IQ-local path.
} from '../platform/audit/index.ts';
export {
  EVIDENCE_DOMAINS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_EXPORT_ROWS,
  EvidenceError, validatePagination, narrowCasinoScope, buildEnvelope,
  reconcileSession, reconcilePlayer, reconcileMachine, reconcileFinancial,
  csvCell, toCsv,
  type EvidenceDomain, type EvidenceScope, type EvidenceSnapshot, type EvidenceEnvelope,
  type EvidenceReconciliation, type EvidencePagination,
} from './evidence.ts';
export {
  ConsumerGateway, getConsumerGateway, ConsumerRequestError,
  type ConsumerRequest, type ConsumerSources, type RegulatorSources,
} from './gateway.ts';
export {
  REGULATOR_VIEWS, REGULATOR_NATIONAL_VIEWS, REPORT_KINDS,
  type RegulatorView, type ReportKind, type InvestigationInput,
} from './regulator.ts';
