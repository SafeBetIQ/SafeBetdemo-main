// ─── SafeBet Guardian — synthetic evidence fixtures (ARCH-V4-C7) ──────────────
// Hash + reference only. SYNTHETIC. No real illegal-gambling evidence, no real
// customer/player/bank/regulator data. Source references are governed C1–C6 references.

import type { EvidenceFixture } from './types.ts';

export const SYNTHETIC_EVIDENCE_FIXTURES: Record<string, EvidenceFixture> = {
  // Scenario 1: synthetic web evidence → register → hash → store → verify.
  'EV-REF-0001': {
    evidenceReference: 'EV-REF-0001', jurisdiction: 'ZA-GP', evidenceType: 'WEB_CAPTURE', sourceDomain: 'C2_DOMAIN',
    sourceReference: 'licensed-example-003.test', classification: 'RESTRICTED', purpose: 'CASE_INVESTIGATION',
    captureMethod: 'SYNTHETIC_WEB_CAPTURE', captureActor: 'SyntheticEvidenceSourceAdapter', mediaType: 'text/html',
    syntheticBody: 'synthetic-web-capture:licensed-example-003.test:v1', sizeBytes: 1024,
  },
  // Scenario 2: synthetic screenshot → integrity verified.
  'EV-REF-0002': {
    evidenceReference: 'EV-REF-0002', jurisdiction: 'ZA-GP', evidenceType: 'SCREENSHOT', sourceDomain: 'C3_APP',
    sourceReference: 'com.safebet.synthetic.bet003', classification: 'INTERNAL', purpose: 'CASE_INVESTIGATION',
    captureMethod: 'SYNTHETIC_SCREENSHOT', captureActor: 'SyntheticEvidenceSourceAdapter', mediaType: 'image/png',
    syntheticBody: 'synthetic-screenshot:com.safebet.synthetic.bet003:v1', sizeBytes: 2048,
  },
  // Scenario 3/9: payment reference evidence (parent for a derived extraction).
  'EV-REF-0003': {
    evidenceReference: 'EV-REF-0003', jurisdiction: 'ZA-GP', evidenceType: 'PAYMENT_REFERENCE', sourceDomain: 'C4_PAYMENT',
    sourceReference: 'MER-REF-0001', classification: 'RESTRICTED', purpose: 'CASE_INVESTIGATION',
    captureMethod: 'SYNTHETIC_PAYMENT_REFERENCE', captureActor: 'SyntheticEvidenceSourceAdapter', mediaType: 'application/json',
    syntheticBody: 'synthetic-payment-reference:MER-REF-0001:v1', sizeBytes: 256,
  },
  // Scenario 11: HIGHLY_RESTRICTED — an Investigator must be denied by classification.
  'EV-REF-0009': {
    evidenceReference: 'EV-REF-0009', jurisdiction: 'ZA-GP', evidenceType: 'DOCUMENT', sourceDomain: 'C6_CASE',
    sourceReference: 'GC-INTAKE-0001', classification: 'HIGHLY_RESTRICTED', purpose: 'LEGAL_REVIEW_PREPARATION',
    captureMethod: 'SYNTHETIC_DOCUMENT', captureActor: 'SyntheticEvidenceSourceAdapter', mediaType: 'application/pdf',
    syntheticBody: 'synthetic-legal-document:GC-INTAKE-0001:v1', sizeBytes: 4096,
  },
  // Scenario 4: wrong-jurisdiction (ZA-WC) — a ZA-GP worker must DENY.
  'EV-REF-0100': {
    evidenceReference: 'EV-REF-0100', jurisdiction: 'ZA-WC', evidenceType: 'DOCUMENT', sourceDomain: 'C1_REGISTRY',
    sourceReference: 'LIC-ZA-WC-TEST-0100', classification: 'RESTRICTED', purpose: 'CASE_INVESTIGATION',
    captureMethod: 'SYNTHETIC_DOCUMENT', captureActor: 'SyntheticEvidenceSourceAdapter', mediaType: 'application/pdf',
    syntheticBody: 'synthetic-western-document:LIC-ZA-WC-TEST-0100:v1', sizeBytes: 512,
  },
};
