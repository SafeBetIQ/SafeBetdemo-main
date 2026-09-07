// ─── SafeBet Guardian — Geo observation persistence contract (ARCH-V4-C5) ─────
// Bounded, deterministic, idempotent. No generic execute(sql). No person-level data.

import type { GeoIntelligenceResult } from './types.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface GeoPersistencePlan {
  jurisdiction: string;
  geoSubjectId: string;
  observationId: string;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function deriveGeoIds(idempotencyKey: string, geoSubjectId: string) {
  const k = idempotencyKey;
  return { geoSubjectId, observationId: `GOBS-${k}`, comparisonId: `GCMP-${k}`, reviewId: `GREV-${k}`, historyId: `GCH-${k}` };
}

export interface GeoPersistInput {
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  evidenceReference: string;
  contentHash: string;
  result: GeoIntelligenceResult;
}

export function buildGeoPersistencePlan(inp: GeoPersistInput): GeoPersistencePlan {
  const r = inp.result;
  const id = deriveGeoIds(inp.idempotencyKey, r.geoSubjectId);
  const rows: DomainPersistencePlanRow[] = [
    { table: 'geo_subject', id: r.geoSubjectId, row: { geo_subject_id: r.geoSubjectId, subject_type: r.subjectType, subject_reference: r.geoSubjectId.replace(/^GEO-/, ''), jurisdiction: inp.jurisdiction, source_reference: 'SyntheticGeoSourceAdapter' } },
    { table: 'geo_observation', id: id.observationId, row: { observation_id: id.observationId, geo_subject_id: r.geoSubjectId, region_id: r.region.regionId, jurisdiction: inp.jurisdiction, observation_type: 'REGIONAL_AVAILABILITY', availability_state: r.observedAvailabilityState, source: 'SyntheticGeoSourceAdapter', confidence_category: 'MEDIUM', evidence_reference: inp.evidenceReference, content_hash: inp.contentHash, idempotency_key: inp.idempotencyKey, source_as_of: r.freshness.sourceAsOf, status: 'PROCESSED' } },
    { table: 'geo_service_availability', id: `GAVL-${inp.idempotencyKey}`, row: { availability_id: `GAVL-${inp.idempotencyKey}`, geo_subject_id: r.geoSubjectId, region_id: r.region.regionId, jurisdiction: inp.jurisdiction, availability_state: r.observedAvailabilityState, expected_regulatory_jurisdiction: r.expectedRegulatoryJurisdiction, source_as_of: r.freshness.sourceAsOf } },
    { table: 'geo_registry_comparison', id: id.comparisonId, row: { comparison_id: id.comparisonId, observation_id: id.observationId, geo_subject_id: r.geoSubjectId, region_id: r.region.regionId, jurisdiction: inp.jurisdiction, expected_regulatory_jurisdiction: r.expectedRegulatoryJurisdiction, observed_availability_state: r.observedAvailabilityState, registry_match_state: r.registryMatchState, resolution_state: r.resolutionState, candidate_operator_id: r.candidateOperatorId, licence_reference: r.licenceReference, licence_jurisdiction: r.licenceJurisdiction, domain_reference_state: r.domainReferenceState, app_reference_state: r.appReferenceState, payment_reference_state: r.paymentReferenceState, review_priority: r.reviewPriority, review_required: r.reviewRequired, reason_codes: JSON.stringify(r.reasonCodes), freshness: r.registryFreshness, is_illegal_determination: false, is_enforcement_authorised: false } },
    { table: 'geo_change_history', id: id.historyId, row: { history_id: id.historyId, geo_subject_id: r.geoSubjectId, region_id: r.region.regionId, jurisdiction: inp.jurisdiction, change_type: 'OBSERVATION_RECORDED', new_state: r.observedAvailabilityState, new_hash: inp.contentHash, observation_id: id.observationId } },
  ];
  // Governed reference links (operator/brand/licence/domain/app/payment).
  r.referenceLinks.forEach((l, i) => rows.push({ table: 'geo_entity_link', id: `GEL-${inp.idempotencyKey}-${i}`, row: { link_id: `GEL-${inp.idempotencyKey}-${i}`, geo_subject_id: r.geoSubjectId, jurisdiction: inp.jurisdiction, link_type: l.linkType, target_reference: l.targetReference, relationship_type: 'OBSERVED_REFERENCE', confidence: l.confidence, source: 'SyntheticGeoSourceAdapter' } }));
  if (r.reviewRequired) {
    rows.push({ table: 'geo_review_item', id: id.reviewId, row: { review_id: id.reviewId, geo_subject_id: r.geoSubjectId, jurisdiction: inp.jurisdiction, state: 'REQUIRES_REVIEW', review_priority: r.reviewPriority, reason_codes: JSON.stringify(r.reasonCodes), assigned_role: 'INVESTIGATOR', correlation_id: inp.correlationId } });
  }
  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-geo`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: 'GEO_OBSERVATION_PROCESSED', actor_principal_id: 'guardian-geo-worker', correlation_id: inp.correlationId, case_reference: id.observationId } },
  ];
  return { jurisdiction: inp.jurisdiction, geoSubjectId: r.geoSubjectId, observationId: id.observationId, rows, auditRows };
}
