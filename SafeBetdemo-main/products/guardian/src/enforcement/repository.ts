// ─── SafeBet Guardian — orchestration persistence contract (ARCH-V4-C9) ───────
// Bounded, deterministic, idempotent. References only. Provider-originated states are written
// only from a provider_response row; verification only from an enforcement_verification row.

import type { OrchestrationWorkerOutput } from './worker.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface OrchestrationPersistencePlan {
  jurisdiction: string;
  orchestrationId: string;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function deriveOrchestrationIds(idempotencyKey: string) {
  const k = idempotencyKey;
  return { orchestrationId: `ORCH-${k}`, requestId: `PREQ-${k}-1`, responseId: `PRSP-${k}`, attemptId: `ATT-${k}-1`, historyId: `OSH-${k}-1` };
}

export function buildOrchestrationPersistencePlan(inp: { jurisdiction: string; correlationId: string; idempotencyKey: string; out: OrchestrationWorkerOutput }): OrchestrationPersistencePlan {
  const id = deriveOrchestrationIds(inp.idempotencyKey);
  const d = inp.out.decision!;
  const blocked = d.status === 'ORCHESTRATION_BLOCKED';
  const delivered = d.requestPayloadHash != null && !blocked && d.status !== 'READY';
  const rows: DomainPersistencePlanRow[] = [
    { table: 'enforcement_orchestration', id: id.orchestrationId, row: { orchestration_id: id.orchestrationId, authorisation_reference: d.authorisationReference, jurisdiction: inp.jurisdiction, action_type: d.actionType, target_type: 'DOMAIN', target_reference: d.targetReference, provider_channel: d.providerChannel, status: d.status, attempt_count: 1, request_payload_hash: d.requestPayloadHash, request_version: d.requestVersion, reason_codes: JSON.stringify(d.reasonCodes), correlation_id: inp.correlationId, is_real_provider: false, is_external_network_call: false, idempotency_key: inp.idempotencyKey } },
    { table: 'orchestration_status_history', id: id.historyId, row: { history_id: id.historyId, orchestration_id: id.orchestrationId, jurisdiction: inp.jurisdiction, previous_status: null, new_status: d.status, source: blocked ? 'GUARDIAN' : (delivered ? 'PROVIDER' : 'GUARDIAN'), actor: 'guardian-enforcement-worker', reason: blocked ? JSON.stringify(d.reasonCodes) : inp.out.guardianDispatchState } },
  ];
  if (!blocked && d.requestPayloadHash) {
    rows.push({ table: 'provider_request', id: id.requestId, row: { request_id: id.requestId, orchestration_id: id.orchestrationId, jurisdiction: inp.jurisdiction, request_version: d.requestVersion, request_payload_hash: d.requestPayloadHash, action_type: d.actionType, target_reference: d.targetReference, provider_channel: d.providerChannel, published_at: delivered ? 'now()' : null } });
    rows.push({ table: 'dispatch_attempt', id: id.attemptId, row: { attempt_id: id.attemptId, orchestration_id: id.orchestrationId, jurisdiction: inp.jurisdiction, attempt_no: 1, outcome: delivered ? 'PUBLISHED' : 'TECHNICAL_FAILURE', request_payload_hash: d.requestPayloadHash } });
  }
  if (delivered && ['ACKNOWLEDGED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'ACTIONED', 'DECLINED'].includes(d.status)) {
    rows.push({ table: 'provider_response', id: id.responseId, row: { response_id: id.responseId, orchestration_id: id.orchestrationId, jurisdiction: inp.jurisdiction, provider_channel: d.providerChannel, provider_state: d.status, provider_reference: `SYN-PRV-${(d.requestPayloadHash ?? '').slice(0, 12)}`, request_payload_hash: d.requestPayloadHash } });
  }
  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-orch`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: blocked ? 'ORCHESTRATION_BLOCKED' : (delivered ? 'PROVIDER_REQUEST_PUBLISHED' : 'ORCHESTRATION_CREATED'), actor_principal_id: 'guardian-enforcement-worker', correlation_id: inp.correlationId, case_reference: d.authorisationReference } },
  ];
  return { jurisdiction: inp.jurisdiction, orchestrationId: id.orchestrationId, rows, auditRows };
}
