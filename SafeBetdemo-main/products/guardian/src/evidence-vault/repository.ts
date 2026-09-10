// ─── SafeBet Guardian — evidence persistence contract (ARCH-V4-C7) ────────────
// Bounded, deterministic, idempotent. No generic execute(sql). Content is a hash +
// storage reference — never the body. Custody events extend the append-only hash chain.

import type { EvidenceRegistrationResult } from './types.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface EvidencePersistencePlan {
  jurisdiction: string;
  evidenceId: string;
  evidenceReference: string;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function deriveEvidenceIds(idempotencyKey: string) {
  const k = idempotencyKey;
  return { evidenceId: `GEV-${k}`, versionId: `GEVV-${k}-1`, integrityCheckId: `GEIC-${k}` };
}

export interface EvidencePersistInput {
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  createdBy: string;
  result: EvidenceRegistrationResult;
}

export function buildEvidencePersistencePlan(inp: EvidencePersistInput): EvidencePersistencePlan {
  const r = inp.result;
  const id = deriveEvidenceIds(inp.idempotencyKey);
  const rows: DomainPersistencePlanRow[] = [
    { table: 'guardian_evidence', id: r.evidenceId, row: { evidence_id: r.evidenceId, evidence_reference: r.evidenceReference, jurisdiction: inp.jurisdiction, evidence_type: r.evidenceType, source_domain: r.sourceDomain, source_reference: r.sourceReference, classification: r.classification, purpose: 'CASE_INVESTIGATION', capture_method: r.provenance.captureMethod, capture_actor: r.provenance.captureActor, registered_at: 'now()', content_hash: r.contentHash, hash_algorithm: 'SHA-256', size_bytes: r.sizeBytes, media_type: r.mediaType, storage_reference: r.storageReference, integrity_status: r.integrityStatus, created_by: inp.createdBy, correlation_id: inp.correlationId, is_legal_determination: false, is_enforcement_authorised: false, idempotency_key: inp.idempotencyKey } },
    { table: 'guardian_evidence_version', id: id.versionId, row: { version_id: id.versionId, evidence_id: r.evidenceId, version_no: 1, content_hash: r.contentHash, storage_reference: r.storageReference, reason: 'initial registration', actor: inp.createdBy, jurisdiction: inp.jurisdiction } },
    { table: 'guardian_evidence_integrity_check', id: id.integrityCheckId, row: { check_id: id.integrityCheckId, evidence_id: r.evidenceId, jurisdiction: inp.jurisdiction, expected_hash: r.contentHash, computed_hash: r.contentHash, result: r.integrityStatus === 'INTEGRITY_FAILED' ? 'INTEGRITY_FAILED' : 'VERIFIED', actor: inp.createdBy, correlation_id: inp.correlationId } },
  ];
  // Append-only custody chain (deterministic hashes from the registration engine).
  r.custodyChain.forEach((c) => rows.push({ table: 'guardian_evidence_custody_event', id: c.custodyEventId, row: { custody_event_id: c.custodyEventId, evidence_id: c.evidenceId, sequence_number: c.sequenceNumber, event_type: c.eventType, actor: c.actor, actor_role: c.actorRole, jurisdiction: c.jurisdiction, reason: c.reason, previous_event_hash: c.previousEventHash, event_hash: c.eventHash, correlation_id: c.correlationId, audit_reference: r.evidenceReference } }));

  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-evidence`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: 'EVIDENCE_REGISTERED', actor_principal_id: 'guardian-evidence-worker', correlation_id: inp.correlationId, case_reference: r.evidenceReference } },
  ];
  return { jurisdiction: inp.jurisdiction, evidenceId: r.evidenceId, evidenceReference: r.evidenceReference, rows, auditRows };
}
