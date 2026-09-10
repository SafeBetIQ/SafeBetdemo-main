// ─── SafeBet Guardian — synthetic case intake fixtures (ARCH-V4-C6) ───────────
// References only (governed C1–C5 references), no duplicated entity/evidence bodies.
// SYNTHETIC. No real cases, regulators, or illegal-gambling evidence.

import type { CaseIntakeFixture } from './types.ts';

export const SYNTHETIC_CASE_FIXTURES: Record<string, CaseIntakeFixture> = {
  // Scenario 1/3: multiple C1–C5 references (domain+app+payment+geo) → one multi-signal case.
  'GC-INTAKE-0001': {
    intakeReference: 'GC-INTAKE-0001', jurisdiction: 'ZA-GP', title: 'Multi-signal synthetic investigation (Safe Example Betting)',
    intelligenceReferences: [
      { sourceDomain: 'C2_DOMAIN', sourceReference: 'licensed-example-003.test', referenceType: 'DOMAIN_REFERENCE', referenceState: 'REFERENCED', sourceAsOf: '2026-09-01T00:00:00Z' },
      { sourceDomain: 'C3_APP', sourceReference: 'com.safebet.synthetic.bet003', referenceType: 'APP_REFERENCE', referenceState: 'REFERENCED', sourceAsOf: '2026-09-01T00:00:00Z' },
      { sourceDomain: 'C4_PAYMENT', sourceReference: 'MER-REF-0001', referenceType: 'PAYMENT_REFERENCE', referenceState: 'REFERENCED', sourceAsOf: '2026-09-01T00:00:00Z' },
      { sourceDomain: 'C5_GEO', sourceReference: 'licensed-example-003.test', referenceType: 'GEO_REFERENCE', referenceState: 'REFERENCED', sourceAsOf: '2026-09-01T00:00:00Z' },
    ],
    evidenceReference: 'evref:case-0001-a', evidenceIntegrityHash: null, contentHash: '1'.repeat(64),
  },
  // Scenario 2: unknown domain NO_MATCH → case opened for review → not illegal.
  'GC-INTAKE-0002': {
    intakeReference: 'GC-INTAKE-0002', jurisdiction: 'ZA-GP', title: 'Unknown domain review',
    intelligenceReferences: [
      { sourceDomain: 'C2_DOMAIN', sourceReference: 'never-seen-999.test', referenceType: 'DOMAIN_REFERENCE', referenceState: 'DOMAIN_REFERENCE_NOT_FOUND', sourceAsOf: '2026-09-05T00:00:00Z' },
      { sourceDomain: 'C1_REGISTRY', sourceReference: 'UNKNOWN', referenceType: 'REGISTRY_MATCH', referenceState: 'NO_MATCH', sourceAsOf: '2026-09-05T00:00:00Z' },
    ],
    evidenceReference: 'evref:case-0002-a', evidenceIntegrityHash: null, contentHash: '2'.repeat(64),
  },
  // Scenario 4: geo jurisdiction inconsistency → case finding → review required.
  'GC-INTAKE-0004': {
    intakeReference: 'GC-INTAKE-0004', jurisdiction: 'ZA-GP', title: 'Geo jurisdiction inconsistency review',
    intelligenceReferences: [
      { sourceDomain: 'C5_GEO', sourceReference: 'mismatch-region-005.test', referenceType: 'GEO_REFERENCE', referenceState: 'INCONSISTENT', sourceAsOf: '2026-09-01T00:00:00Z' },
    ],
    evidenceReference: 'evref:case-0004-a', evidenceIntegrityHash: null, contentHash: '4'.repeat(64),
  },
  // Scenario 5: conflicting registry source → review object → not silently resolved.
  'GC-INTAKE-0005': {
    intakeReference: 'GC-INTAKE-0005', jurisdiction: 'ZA-GP', title: 'Registry source conflict review',
    intelligenceReferences: [
      { sourceDomain: 'C1_REGISTRY', sourceReference: 'LIC-ZA-GP-TEST-0002', referenceType: 'REGISTRY_MATCH', referenceState: 'SOURCE_CONFLICT', sourceAsOf: '2026-08-02T00:00:00Z' },
    ],
    evidenceReference: 'evref:case-0005-a', evidenceIntegrityHash: null, contentHash: '5'.repeat(64),
  },
  // Scenario 10: wrong-jurisdiction (ZA-WC) intake — a ZA-GP worker must DENY.
  'GC-INTAKE-0100': {
    intakeReference: 'GC-INTAKE-0100', jurisdiction: 'ZA-WC', title: 'Western synthetic case',
    intelligenceReferences: [
      { sourceDomain: 'C5_GEO', sourceReference: 'western-region-100.test', referenceType: 'GEO_REFERENCE', referenceState: 'REFERENCED', sourceAsOf: '2026-09-01T00:00:00Z' },
    ],
    evidenceReference: 'evref:case-0100-a', evidenceIntegrityHash: null, contentHash: 'c'.repeat(64),
  },
};
