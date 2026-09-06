// ─── SafeBet Guardian — Payment observation persistence contract (ARCH-V4-C4) ─
// Bounded, deterministic, idempotent. No generic execute(sql). No PAN/CVV/raw data.

import type { PaymentIntelligenceResult } from './types.ts';
import type { DomainPersistencePlanRow } from '../domain/repository.ts';

export interface PaymentPersistencePlan {
  jurisdiction: string;
  merchantSubjectId: string;
  paymentSubjectId: string;
  observationId: string;
  rows: DomainPersistencePlanRow[];
  auditRows: DomainPersistencePlanRow[];
}

export function derivePaymentIds(idempotencyKey: string, merchantSubjectId: string, paymentSubjectId: string) {
  const k = idempotencyKey;
  return { merchantSubjectId, paymentSubjectId, observationId: `POBS-${k}`, comparisonId: `PCMP-${k}`, reviewId: `PREV-${k}`, historyId: `PCH-${k}` };
}

export interface PaymentPersistInput {
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  evidenceReference: string;
  contentHash: string;
  descriptor: string;
  providerReference: string;
  amountAggregate: number | null;
  currency: string | null;
  result: PaymentIntelligenceResult;
}

export function buildPaymentPersistencePlan(inp: PaymentPersistInput): PaymentPersistencePlan {
  const r = inp.result;
  const id = derivePaymentIds(inp.idempotencyKey, r.merchantSubjectId, r.paymentSubjectId);
  const rows: DomainPersistencePlanRow[] = [
    { table: 'merchant_subject', id: r.merchantSubjectId, row: { merchant_subject_id: r.merchantSubjectId, merchant_reference: r.merchantSubjectId.replace(/^MER-/, ''), merchant_descriptor: inp.descriptor, provider_reference: inp.providerReference, jurisdiction: inp.jurisdiction, status: 'OBSERVED', source_reference: 'SyntheticPaymentSourceAdapter' } },
    { table: 'payment_subject', id: r.paymentSubjectId, row: { payment_subject_id: r.paymentSubjectId, merchant_subject_id: r.merchantSubjectId, channel_type: r.channel, jurisdiction: inp.jurisdiction, status: 'OBSERVED', source_reference: 'SyntheticPaymentSourceAdapter' } },
    { table: 'payment_observation', id: id.observationId, row: { observation_id: id.observationId, payment_subject_id: r.paymentSubjectId, merchant_subject_id: r.merchantSubjectId, channel_type: r.channel, jurisdiction: inp.jurisdiction, provider_reference: inp.providerReference, descriptor: inp.descriptor, amount_aggregate: inp.amountAggregate, currency: inp.currency, evidence_reference: inp.evidenceReference, content_hash: inp.contentHash, idempotency_key: inp.idempotencyKey, status: 'PROCESSED' } },
    { table: 'payment_registry_comparison', id: id.comparisonId, row: { comparison_id: id.comparisonId, observation_id: id.observationId, payment_subject_id: r.paymentSubjectId, merchant_subject_id: r.merchantSubjectId, jurisdiction: inp.jurisdiction, match_state: r.registryMatchState, resolution_state: r.resolutionState, candidate_operator_id: r.candidateOperatorId, licence_reference: r.licenceReference, licence_verification_state: r.licenceVerificationState, review_priority: r.reviewPriority, review_required: r.reviewRequired, reason_codes: JSON.stringify(r.reasonCodes), is_illegal_determination: false, is_enforcement_authorised: false } },
    { table: 'payment_change_history', id: id.historyId, row: { history_id: id.historyId, payment_subject_id: r.paymentSubjectId, merchant_subject_id: r.merchantSubjectId, jurisdiction: inp.jurisdiction, change_type: 'OBSERVATION_RECORDED', new_hash: inp.contentHash, observation_id: id.observationId } },
  ];
  // Governed reference links (operator/brand/licence/domain/app).
  r.referenceLinks.forEach((l, i) => rows.push({ table: 'payment_entity_link', id: `PEL-${inp.idempotencyKey}-${i}`, row: { link_id: `PEL-${inp.idempotencyKey}-${i}`, payment_subject_id: r.paymentSubjectId, merchant_subject_id: r.merchantSubjectId, jurisdiction: inp.jurisdiction, link_type: l.linkType, target_reference: l.targetReference, confidence: l.confidence, source: 'SyntheticPaymentSourceAdapter' } }));
  if (r.reviewRequired) {
    rows.push({ table: 'payment_review_item', id: id.reviewId, row: { review_id: id.reviewId, payment_subject_id: r.paymentSubjectId, merchant_subject_id: r.merchantSubjectId, jurisdiction: inp.jurisdiction, state: 'REQUIRES_REVIEW', review_priority: r.reviewPriority, reason_codes: JSON.stringify(r.reasonCodes), assigned_role: 'INVESTIGATOR', correlation_id: inp.correlationId } });
  }
  const auditRows: DomainPersistencePlanRow[] = [
    { table: 'audit_context', id: `${inp.idempotencyKey}-pay`, row: { product: 'GUARDIAN', jurisdiction: inp.jurisdiction, chain_scope: `guardian:${inp.jurisdiction}`, event_type: 'PAYMENT_OBSERVATION_PROCESSED', actor_principal_id: 'guardian-payment-worker', correlation_id: inp.correlationId, case_reference: id.observationId } },
  ];
  return { jurisdiction: inp.jurisdiction, merchantSubjectId: r.merchantSubjectId, paymentSubjectId: r.paymentSubjectId, observationId: id.observationId, rows, auditRows };
}
