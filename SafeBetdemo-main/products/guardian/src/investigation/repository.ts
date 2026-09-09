// ─── SafeBet Guardian — Case persistence contract (ARCH-V4-C6) ────────────────
// Bounded, deterministic, idempotent. No generic execute(sql). References only (no
// duplicated entity/evidence body). A system-recommended intake creates a DRAFT case —
// it never silently creates an authoritative/legal case state.

import type { CaseRecommendationResult } from './types.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface CasePersistencePlan {
  jurisdiction: string;
  caseId: string;
  caseReference: string;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function deriveCaseIds(idempotencyKey: string) {
  const k = idempotencyKey;
  return { caseId: `CASE-${k}`, evidenceLinkId: `CEL-${k}`, findingId: `CFND-${k}`, statusHistoryId: `CSH-${k}-1`, priorityHistoryId: `CPH-${k}-1` };
}

export interface CasePersistInput {
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  evidenceReference: string | null;
  evidenceIntegrityStatus: 'VERIFIED' | 'INTEGRITY_FAILED' | 'UNVERIFIED';
  createdBy: string;
  result: CaseRecommendationResult;
}

export function buildCasePersistencePlan(inp: CasePersistInput): CasePersistencePlan {
  const r = inp.result;
  const id = deriveCaseIds(inp.idempotencyKey);
  const rows: DomainPersistencePlanRow[] = [
    { table: 'investigation_case', id: id.caseId, row: { case_id: id.caseId, case_reference: r.caseReference, jurisdiction: inp.jurisdiction, title: r.title, case_type: r.caseType, status: 'DRAFT', priority: r.priority, intake_source: 'SYSTEM_RECOMMENDED_CASE', reason_codes: JSON.stringify(r.reasonCodes), purpose: 'synthetic demo investigation', created_by: inp.createdBy, assigned_to: null, correlation_id: inp.correlationId, is_legal_determination: false, is_enforcement_authorised: false, idempotency_key: inp.idempotencyKey } },
  ];
  r.subjects.forEach((s, i) => rows.push({ table: 'case_subject', id: `CSUB-${inp.idempotencyKey}-${i}`, row: { case_subject_id: `CSUB-${inp.idempotencyKey}-${i}`, case_id: id.caseId, jurisdiction: inp.jurisdiction, subject_type: s.subjectType, subject_reference: s.subjectReference, source: s.sourceDomain, relationship: 'SUBJECT_OF_INVESTIGATION' } }));
  r.intelligenceReferences.forEach((l, i) => rows.push({ table: 'case_intelligence_link', id: `CIL-${inp.idempotencyKey}-${i}`, row: { link_id: `CIL-${inp.idempotencyKey}-${i}`, case_id: id.caseId, jurisdiction: inp.jurisdiction, source_domain: l.sourceDomain, source_reference: l.sourceReference, reference_type: l.referenceType, reference_state: l.referenceState, source_as_of: l.sourceAsOf ?? null, reason: 'intake correlation', linked_by: inp.createdBy } }));
  if (inp.evidenceReference) {
    rows.push({ table: 'case_evidence_link', id: id.evidenceLinkId, row: { evidence_link_id: id.evidenceLinkId, case_id: id.caseId, jurisdiction: inp.jurisdiction, evidence_reference: inp.evidenceReference, source_domain: 'GUARDIAN_INTELLIGENCE', classification: 'RESTRICTED', purpose: 'synthetic demo', integrity_status: inp.evidenceIntegrityStatus, linked_by: inp.createdBy } });
  }
  if (r.reviewRequired) {
    rows.push({ table: 'case_finding', id: id.findingId, row: { finding_id: id.findingId, case_id: id.caseId, jurisdiction: inp.jurisdiction, finding_state: 'REQUIRES_FURTHER_INVESTIGATION', reason_codes: JSON.stringify(r.reasonCodes), recorded_by: inp.createdBy, reference: r.caseReference, is_legal_determination: false } });
  }
  // Append-only chronology + status/priority history.
  rows.push({ table: 'case_chronology', id: `CHR-${inp.idempotencyKey}-1`, row: { chronology_id: `CHR-${inp.idempotencyKey}-1`, case_id: id.caseId, jurisdiction: inp.jurisdiction, event_type: 'CASE_OPENED', actor: inp.createdBy, detail_reference: r.caseReference } });
  r.intelligenceReferences.forEach((l, i) => rows.push({ table: 'case_chronology', id: `CHR-${inp.idempotencyKey}-il${i}`, row: { chronology_id: `CHR-${inp.idempotencyKey}-il${i}`, case_id: id.caseId, jurisdiction: inp.jurisdiction, event_type: 'INTELLIGENCE_LINKED', actor: inp.createdBy, detail_reference: l.sourceReference } }));
  rows.push({ table: 'case_status_history', id: id.statusHistoryId, row: { status_history_id: id.statusHistoryId, case_id: id.caseId, jurisdiction: inp.jurisdiction, previous_status: null, new_status: 'DRAFT', changed_by: inp.createdBy, reason: 'system-recommended intake' } });
  rows.push({ table: 'case_priority_history', id: id.priorityHistoryId, row: { priority_history_id: id.priorityHistoryId, case_id: id.caseId, jurisdiction: inp.jurisdiction, previous_priority: null, new_priority: r.priority, changed_by: inp.createdBy, override_reason: 'initial correlation priority' } });

  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-case`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: 'CASE_CREATED', actor_principal_id: 'guardian-case-worker', correlation_id: inp.correlationId, case_reference: r.caseReference } },
  ];
  return { jurisdiction: inp.jurisdiction, caseId: id.caseId, caseReference: r.caseReference, rows, auditRows };
}
