// ─── SafeBet Guardian — authorisation persistence contract (ARCH-V4-C8) ───────
// Bounded, deterministic, idempotent. The worker persists ONLY a proposed_action (+ history)
// — never legal_review or action_authorisation (those are human steps). References only.

import type { PreparedProposedAction } from './worker.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface AuthPersistencePlan {
  jurisdiction: string;
  proposedActionId: string;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function deriveAuthIds(idempotencyKey: string) {
  return { proposedActionId: `PA-${idempotencyKey}`, historyId: `PAH-${idempotencyKey}-1` };
}

export function buildAuthPersistencePlan(inp: { jurisdiction: string; correlationId: string; idempotencyKey: string; prepared: PreparedProposedAction }): AuthPersistencePlan {
  const id = deriveAuthIds(inp.idempotencyKey);
  const pa = inp.prepared.proposedAction;
  const rows: DomainPersistencePlanRow[] = [
    { table: 'proposed_action', id: id.proposedActionId, row: { proposed_action_id: id.proposedActionId, case_reference: pa.caseReference, jurisdiction: inp.jurisdiction, action_type: pa.actionType, target_type: pa.targetType, target_reference: pa.targetReference, version_id: pa.policyVersion?.versionId ?? null, evidence_package_reference: pa.evidenceManifestReference ?? null, evidence_manifest_hash: pa.evidenceManifestHash ?? null, proposed_by: pa.proposedBy, status: inp.prepared.preparedStatus, reason_codes: JSON.stringify(inp.prepared.gateReasonCodes), correlation_id: inp.correlationId, idempotency_key: inp.idempotencyKey } },
    { table: 'proposed_action_history', id: id.historyId, row: { history_id: id.historyId, proposed_action_id: id.proposedActionId, jurisdiction: inp.jurisdiction, previous_status: null, new_status: inp.prepared.preparedStatus, actor: 'guardian-authorisation-worker', reason_codes: JSON.stringify(inp.prepared.gateReasonCodes) } },
  ];
  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-auth`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: 'PROPOSED_ACTION_CREATED', actor_principal_id: 'guardian-authorisation-worker', correlation_id: inp.correlationId, case_reference: pa.caseReference } },
  ];
  return { jurisdiction: inp.jurisdiction, proposedActionId: id.proposedActionId, rows, auditRows };
}
