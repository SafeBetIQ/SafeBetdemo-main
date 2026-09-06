// ─── SafeBet Guardian — Domain observation persistence contract (ARCH-V4-C2.1) ─
//
// A GOVERNED, bounded persistence contract. There is deliberately NO generic
// `execute(sql)` method. The pg-backed implementation (worker Lambda) executes only
// the fixed, parameterised statements derived from this plan. Deterministic ids make
// re-processing the same idempotency key a no-op (idempotent; no duplicate state).

import type { DomainIntelligenceResult } from './types.ts';

export interface DomainPersistencePlanRow { table: string; id: string; row: Record<string, unknown> }
export interface DomainPersistencePlan {
  jurisdiction: string;
  domainId: string;
  observationId: string;
  rows: DomainPersistencePlanRow[];   // insert order respects FKs
  auditRows: DomainPersistencePlanRow[];
}

/** Deterministic ids from the idempotency key → duplicate delivery cannot duplicate state. */
export function deriveIds(idempotencyKey: string, canonicalHostname: string) {
  const k = idempotencyKey;
  return {
    domainId: `DOM-${canonicalHostname}`,
    observationId: `OBS-${k}`,
    snapshotId: `SNAP-${k}`,
    comparisonId: `CMP-${k}`,
    reviewId: `DREV-${k}`,
    historyId: `DCH-${k}`,
  };
}

export interface PersistInput {
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  evidenceReference: string;
  contentHash: string;
  pageTitle: string;
  result: DomainIntelligenceResult;
}

/** Build the exact (parameterised) rows the worker will persist. Pure + testable. */
export function buildPersistencePlan(inp: PersistInput): DomainPersistencePlan {
  const r = inp.result;
  const id = deriveIds(inp.idempotencyKey, r.canonicalHostname);
  const rows: DomainPersistencePlanRow[] = [
    { table: 'domain_subject', id: id.domainId, row: { domain_id: id.domainId, canonical_hostname: r.canonicalHostname, display_hostname: r.canonicalHostname, jurisdiction: inp.jurisdiction, status: 'OBSERVED', source_reference: 'SyntheticDomainSourceAdapter' } },
    { table: 'domain_observation', id: id.observationId, row: { observation_id: id.observationId, domain_id: id.domainId, jurisdiction: inp.jurisdiction, capture_method: 'SYNTHETIC_FIXTURE', content_hash: inp.contentHash, idempotency_key: inp.idempotencyKey, status: 'PROCESSED' } },
    { table: 'website_snapshot', id: id.snapshotId, row: { snapshot_id: id.snapshotId, observation_id: id.observationId, jurisdiction: inp.jurisdiction, page_title: inp.pageTitle, evidence_reference: inp.evidenceReference, content_hash: inp.contentHash, http_status: 200 } },
    { table: 'domain_registry_comparison', id: id.comparisonId, row: { comparison_id: id.comparisonId, observation_id: id.observationId, domain_id: id.domainId, jurisdiction: inp.jurisdiction, match_state: r.registryMatchState, resolution_state: r.resolutionState, candidate_operator_id: r.candidateOperatorId, licence_reference: r.licenceReference, licence_verification_state: r.licenceVerificationState, review_priority: r.reviewPriority, review_required: r.reviewRequired, reason_codes: JSON.stringify(r.reasonCodes), is_illegal_determination: false } },
    { table: 'domain_change_history', id: id.historyId, row: { history_id: id.historyId, domain_id: id.domainId, jurisdiction: inp.jurisdiction, change_type: 'OBSERVATION_RECORDED', new_hash: inp.contentHash, observation_id: id.observationId } },
  ];
  // Signals (deterministic ids).
  r.technicalSignals.forEach((s, i) => rows.push({ table: 'domain_technical_signal', id: `TSIG-${inp.idempotencyKey}-${i}`, row: { signal_id: `TSIG-${inp.idempotencyKey}-${i}`, observation_id: id.observationId, jurisdiction: inp.jurisdiction, signal_type: s.signalType, value: s.value } }));
  r.contentSignals.forEach((s, i) => rows.push({ table: 'domain_content_signal', id: `CSIG-${inp.idempotencyKey}-${i}`, row: { signal_id: `CSIG-${inp.idempotencyKey}-${i}`, observation_id: id.observationId, jurisdiction: inp.jurisdiction, signal_type: s.signalType, present: s.present, detail: s.detail ?? null } }));
  // Review item only when required.
  if (r.reviewRequired) {
    rows.push({ table: 'domain_review_item', id: id.reviewId, row: { review_id: id.reviewId, domain_id: id.domainId, jurisdiction: inp.jurisdiction, state: 'REQUIRES_REVIEW', review_priority: r.reviewPriority, reason_codes: JSON.stringify(r.reasonCodes), assigned_role: 'INVESTIGATOR', correlation_id: inp.correlationId } });
  }
  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-processed`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: 'DOMAIN_OBSERVATION_PROCESSED', actor_principal_id: 'guardian-domain-worker', correlation_id: inp.correlationId, case_reference: id.observationId } },
  ];
  return { jurisdiction: inp.jurisdiction, domainId: id.domainId, observationId: id.observationId, rows, auditRows };
}
