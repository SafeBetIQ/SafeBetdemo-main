// ─── DEPRECATED SHIM (ARCH-V4-A4 strangler) ─────────────────────────────────
//
// The certified evidence framework moved to the SHARED PLATFORM FOUNDATION at
// `@/lib/platform/evidence`. It is a shared capability (SafeBet IQ + future
// Guardian + Regulator Suite), not an IQ-internal one.
//
// @deprecated Import from `@/lib/platform/evidence` instead. This shim re-exports
// the governed module unchanged so existing IQ consumers keep working during the
// strangler transition; it will be removed once all consumers are migrated.

export {
  EVIDENCE_DOMAINS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_EXPORT_ROWS,
  EvidenceError, validatePagination, narrowCasinoScope, buildEnvelope,
  reconcileSession, reconcilePlayer, reconcileMachine, reconcileFinancial,
  csvCell, toCsv,
} from '../platform/evidence/index.ts';
export type {
  EvidenceDomain, EvidenceScope, EvidenceSnapshot, EvidenceCheck,
  EvidenceReconciliation, EvidencePagination, EvidenceEnvelope,
} from '../platform/evidence/index.ts';
