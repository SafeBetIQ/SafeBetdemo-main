// ─── SafeBet Guardian — App observation persistence contract (ARCH-V4-C3) ─────
// Bounded, deterministic, idempotent. No generic execute(sql). Deterministic ids →
// duplicate delivery cannot duplicate state.

import type { AppIntelligenceResult } from './types.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface AppPersistencePlan {
  jurisdiction: string;
  appSubjectId: string;
  observationId: string;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function deriveAppIds(idempotencyKey: string, canonicalAppIdentifier: string) {
  const k = idempotencyKey;
  return {
    appSubjectId: `APP-${canonicalAppIdentifier}`,
    observationId: `AOBS-${k}`,
    snapshotId: `ASNAP-${k}`,
    comparisonId: `ACMP-${k}`,
    reviewId: `AREV-${k}`,
    historyId: `ACH-${k}`,
  };
}

export interface AppPersistInput {
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  evidenceReference: string;
  contentHash: string;
  metadataHash: string;
  version: string;
  publisher: string;
  title: string;
  result: AppIntelligenceResult;
}

export function buildAppPersistencePlan(inp: AppPersistInput): AppPersistencePlan {
  const r = inp.result;
  const id = deriveAppIds(inp.idempotencyKey, r.canonicalAppIdentifier);
  const rows: DomainPersistencePlanRow[] = [
    { table: 'mobile_app_subject', id: id.appSubjectId, row: { app_subject_id: id.appSubjectId, canonical_app_identifier: r.canonicalAppIdentifier, display_name: inp.title, platform_type: r.platformType, developer_display_name: inp.publisher, jurisdiction: inp.jurisdiction, status: 'OBSERVED', source_reference: 'SyntheticAppSourceAdapter' } },
    { table: 'mobile_app_observation', id: id.observationId, row: { observation_id: id.observationId, app_subject_id: id.appSubjectId, jurisdiction: inp.jurisdiction, source_type: 'SYNTHETIC_FIXTURE', version_string: inp.version, publisher_text: inp.publisher, content_hash: inp.contentHash, metadata_hash: inp.metadataHash, evidence_reference: inp.evidenceReference, idempotency_key: inp.idempotencyKey, status: 'PROCESSED' } },
    { table: 'mobile_app_snapshot', id: id.snapshotId, row: { snapshot_id: id.snapshotId, observation_id: id.observationId, jurisdiction: inp.jurisdiction, title: inp.title, version: inp.version, developer: inp.publisher, declared_website: r.domainReferences.find((d) => d.linkType === 'APP_DECLARED_WEBSITE')?.declaredDomain ?? null, declared_licence_text: r.licenceReference, evidence_reference: inp.evidenceReference, content_hash: inp.contentHash } },
    { table: 'mobile_app_registry_comparison', id: id.comparisonId, row: { comparison_id: id.comparisonId, observation_id: id.observationId, app_subject_id: id.appSubjectId, jurisdiction: inp.jurisdiction, match_state: r.registryMatchState, resolution_state: r.resolutionState, candidate_operator_id: r.candidateOperatorId, licence_reference: r.licenceReference, licence_verification_state: r.licenceVerificationState, review_priority: r.reviewPriority, review_required: r.reviewRequired, reason_codes: JSON.stringify(r.reasonCodes), is_illegal_determination: false } },
    { table: 'mobile_app_change_history', id: id.historyId, row: { history_id: id.historyId, app_subject_id: id.appSubjectId, jurisdiction: inp.jurisdiction, change_type: 'OBSERVATION_RECORDED', new_hash: inp.contentHash, observation_id: id.observationId } },
  ];
  r.technicalSignals.forEach((s, i) => rows.push({ table: 'mobile_app_technical_signal', id: `ATSIG-${inp.idempotencyKey}-${i}`, row: { signal_id: `ATSIG-${inp.idempotencyKey}-${i}`, observation_id: id.observationId, jurisdiction: inp.jurisdiction, signal_type: s.signalType, value: s.value } }));
  r.contentSignals.forEach((s, i) => rows.push({ table: 'mobile_app_content_signal', id: `ACSIG-${inp.idempotencyKey}-${i}`, row: { signal_id: `ACSIG-${inp.idempotencyKey}-${i}`, observation_id: id.observationId, jurisdiction: inp.jurisdiction, signal_type: s.signalType, present: s.present, detail: s.detail ?? null } }));
  // Governed app→domain link rows.
  r.domainReferences.forEach((d, i) => rows.push({ table: 'mobile_app_domain_link', id: `ADL-${inp.idempotencyKey}-${i}`, row: { link_id: `ADL-${inp.idempotencyKey}-${i}`, app_subject_id: id.appSubjectId, jurisdiction: inp.jurisdiction, link_type: d.linkType, declared_domain: d.declaredDomain, matched_domain_id: d.matchedDomainId, confidence: d.confidence, source: 'SyntheticAppSourceAdapter' } }));
  if (r.reviewRequired) {
    rows.push({ table: 'mobile_app_review_item', id: id.reviewId, row: { review_id: id.reviewId, app_subject_id: id.appSubjectId, jurisdiction: inp.jurisdiction, state: 'REQUIRES_REVIEW', review_priority: r.reviewPriority, reason_codes: JSON.stringify(r.reasonCodes), assigned_role: 'INVESTIGATOR', correlation_id: inp.correlationId } });
  }
  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-app`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: 'APP_OBSERVATION_PROCESSED', actor_principal_id: 'guardian-app-worker', correlation_id: inp.correlationId, case_reference: id.observationId } },
  ];
  return { jurisdiction: inp.jurisdiction, appSubjectId: id.appSubjectId, observationId: id.observationId, rows, auditRows };
}
