// ─── Wagering & GGR Reconciliation — public API (Milestone 4.5) ──────────────
//
// SANDBOX / PILOT-PATH financial pipeline: certified-boundary-shaped Event
// Platform (authoritative) → Projection Platform (derived totals; rebuildable) →
// 4-level reconciliation + integrity. Integer minor units; documented GGR formula;
// deny-by-default; no direct total insertion. NON-PRODUCTION only.

export {
  FINANCIAL_EVENT_SCHEMA_VERSION, PROJECTION_VERSION, FINANCIAL_EVENT_TYPES, SETTLEMENT_RESULTS,
  WAGER_STATES, WAGER_TRANSITIONS, canWagerTransition, GGR_FORMULA,
  FIN_REJECTIONS, PERMANENT_FIN_REJECTIONS, FIN_AUDIT_ACTIONS,
  type FinancialEventType, type SettlementResult, type WagerState, type FinancialEvent,
  type AcceptedFinancialEvent, type FinRejection, type FinRejectionRecord,
  type FinancialPlane, type FinancialAccessContext, FinancialAccessError,
  type FinancialAuditRecord, type FinancialAuditSink, InMemoryFinancialAuditSink, sealFinancialAudit,
  FinancialRejected, validateFinancialSchema, finContentKey,
} from './model.ts';

export {
  FinancialEventPlatform, type FinancialEventPlatformOptions, type FinancialSubmitResult,
} from './eventPlatform.ts';

export {
  FinancialProjectionPlatform, type OperatorProjection, type NationalAggregate,
} from './projection.ts';

export {
  FinancialReconciler, type SourceCounts, type SubmissionLedger,
  type RecoCheck, type RecoLevel, type ReconciliationEquation, type ReconciliationOutput,
  type FinIntegrityCheck, type FinancialIntegrityReport, type ReconcileInput,
} from './reconciliation.ts';
