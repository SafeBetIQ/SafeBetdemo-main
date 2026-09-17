// ─── SafeBet Guardian — re-entry persistence contract (ARCH-V4-C10 §37/§38/§39) ─
// Bounded, deterministic, idempotent. References only. A verification observation is ALWAYS
// appended (continuous verification). A re-entry candidate + its initial state history are
// appended only when a candidate is detected. No provider/authority/enforcement rows are ever
// written by C10. Historic verification is never mutated.

import type { ReentryWorkerOutput } from './worker.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface ReentryPersistencePlan {
  jurisdiction: string;
  reentryCandidateId: string | null;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function deriveReentryIds(idempotencyKey: string) {
  const k = idempotencyKey;
  return { observationId: `EVO-${k}`, candidateId: `REC-${k}`, historyId: `RCH-${k}-1` };
}

export function buildReentryPersistencePlan(inp: { jurisdiction: string; correlationId: string; idempotencyKey: string; out: ReentryWorkerOutput }): ReentryPersistencePlan {
  const id = deriveReentryIds(inp.idempotencyKey);
  const d = inp.out.decision!;
  const created = d.candidateCreated;

  // Continuous verification observation is ALWAYS recorded (append-only), re-entry or not.
  const rows: DomainPersistencePlanRow[] = [
    { table: 'enforcement_verification_observation', id: id.observationId, row: {
      verification_observation_id: id.observationId, orchestration_reference: d.originalOrchestrationReference,
      jurisdiction: inp.jurisdiction, target_type: d.candidateTargetType ?? d.originalTargetType,
      target_reference: d.candidateTargetReference ?? d.originalTargetReference, verification_type: d.verification.verificationType,
      observation_kind: d.verification.observationKind, observed_state: d.verification.observedState,
      result: d.verification.result, source_reference: null, evidence_reference: null, correlation_id: inp.correlationId,
      is_real_observation_source: false, is_external_network_call: false } },
  ];

  if (created) {
    rows.push({ table: 'reentry_candidate', id: id.candidateId, row: {
      reentry_candidate_id: id.candidateId, jurisdiction: inp.jurisdiction,
      original_orchestration_reference: d.originalOrchestrationReference, original_target_type: d.originalTargetType,
      original_target_reference: d.originalTargetReference, candidate_target_type: d.candidateTargetType,
      candidate_target_reference: d.candidateTargetReference, candidate_state: d.candidateState,
      relationship_type: d.relationshipType, reason_codes: JSON.stringify(d.reasonCodes), review_priority: d.reviewPriority,
      coverage_state: d.coverageState, human_review_state: d.humanReviewState, correlation_id: inp.correlationId,
      idempotency_key: inp.idempotencyKey, is_illegality_determined: false, is_authority_applied: false } });
    rows.push({ table: 'reentry_candidate_history', id: id.historyId, row: {
      history_id: id.historyId, reentry_candidate_id: id.candidateId, jurisdiction: inp.jurisdiction,
      previous_state: null, new_state: d.candidateState, source: 'REENTRY_WORKER',
      actor: 'guardian-reentry-worker', reason: JSON.stringify(d.reasonCodes) } });
  }

  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-reentry`, row: {
      product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`,
      event_type: created ? 'REENTRY_CANDIDATE_CREATED' : 'FOLLOWUP_VERIFICATION_COMPLETED',
      actor_principal_id: 'guardian-reentry-worker', correlation_id: inp.correlationId,
      case_reference: d.originalOrchestrationReference } },
  ];

  return { jurisdiction: inp.jurisdiction, reentryCandidateId: created ? id.candidateId : null, rows, auditRows };
}
