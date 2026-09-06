// ─── SafeBet Guardian — synthetic registry snapshot (ARCH-V4-C1) ──────────────
//
// A read-only SYNTHETIC snapshot mirroring the `guardian` schema seed. The DB is the
// authoritative store of record (proven via SQL/RLS); the deployed runtime serves
// this build-time snapshot so it holds NO database credentials (strongest least-
// privilege for a synthetic Demo — the live DB-read path is designed for C2). All
// identifiers/names are clearly TEST/SYNTHETIC.

import type { RegistrySnapshot } from './types.ts';

export const SYNTHETIC_REGISTRY: RegistrySnapshot = {
  operators: [
    { operatorId: 'OP-SYNTH-0001', product: 'GUARDIAN', legalName: 'Synthetic Gaming Holdings (Pty) Ltd', normalisedLegalName: 'synthetic gaming', registrationReference: 'REG-ZA-TEST-0001', country: 'ZA', entityType: 'PRIVATE_COMPANY', jurisdiction: 'ZA-GP', accessScope: 'JURISDICTION_LOCAL', status: 'ACTIVE', isSynthetic: true },
    { operatorId: 'OP-SYNTH-0009', product: 'GUARDIAN', legalName: 'Lapsed Play Synthetic Ltd', normalisedLegalName: 'lapsed play synthetic', registrationReference: 'REG-ZA-TEST-0009', country: 'ZA', entityType: 'PRIVATE_COMPANY', jurisdiction: 'ZA-GP', accessScope: 'JURISDICTION_LOCAL', status: 'ACTIVE', isSynthetic: true },
    { operatorId: 'OP-SYNTH-0002', product: 'GUARDIAN', legalName: 'Conflicted Operator Synthetic (Pty) Ltd', normalisedLegalName: 'conflicted operator synthetic', registrationReference: 'REG-ZA-TEST-0002', country: 'ZA', entityType: 'PRIVATE_COMPANY', jurisdiction: 'ZA-GP', accessScope: 'JURISDICTION_LOCAL', status: 'ACTIVE', isSynthetic: true },
    { operatorId: 'OP-SYNTH-WC-0100', product: 'GUARDIAN', legalName: 'Western Synthetic Betting (Pty) Ltd', normalisedLegalName: 'western synthetic betting', registrationReference: 'REG-ZA-TEST-0100', country: 'ZA', entityType: 'PRIVATE_COMPANY', jurisdiction: 'ZA-WC', accessScope: 'JURISDICTION_LOCAL', status: 'ACTIVE', isSynthetic: true },
  ],
  aliases: [
    { aliasId: 'ALIAS-SYNTH-0001', operatorId: 'OP-SYNTH-0001', jurisdiction: 'ZA-GP', aliasName: 'SGH Betting', normalisedAlias: 'sgh betting', aliasType: 'TRADING_NAME' },
  ],
  brands: [
    { brandId: 'BRAND-SYNTH-0001', brandName: 'Safe Example Betting', normalisedBrand: 'safe example betting', jurisdiction: 'ZA-GP', status: 'ACTIVE' },
  ],
  operatorBrands: [
    { relationshipId: 'OBR-SYNTH-0001', operatorId: 'OP-SYNTH-0001', brandId: 'BRAND-SYNTH-0001', jurisdiction: 'ZA-GP', effectiveFrom: '2024-01-01T00:00:00Z', effectiveTo: null, status: 'ACTIVE' },
  ],
  licences: [
    { licenceId: 'LIC-SYNTH-0001', licenceReference: 'LIC-ZA-GP-TEST-0001', operatorId: 'OP-SYNTH-0001', issuingAuthorityId: 'AUTH-ZA-GP-PLA-TEST', jurisdiction: 'ZA-GP', licenceType: 'ONLINE_BETTING', status: 'LICENSED', effectiveFrom: '2024-01-01T00:00:00Z', expiryDate: '2027-12-31T00:00:00Z', sourceRecordId: 'REC-SYNTH-0001', lastVerifiedAt: '2026-09-01T00:00:00Z', verificationState: 'VERIFIED', accessScope: 'JURISDICTION_LOCAL' },
    { licenceId: 'LIC-SYNTH-0009', licenceReference: 'LIC-ZA-GP-TEST-0009', operatorId: 'OP-SYNTH-0009', issuingAuthorityId: 'AUTH-ZA-GP-PLA-TEST', jurisdiction: 'ZA-GP', licenceType: 'ONLINE_BETTING', status: 'EXPIRED', effectiveFrom: '2020-01-01T00:00:00Z', expiryDate: '2023-12-31T00:00:00Z', sourceRecordId: 'REC-SYNTH-0009', lastVerifiedAt: '2024-01-15T00:00:00Z', verificationState: 'VERIFIED', accessScope: 'JURISDICTION_LOCAL' },
    { licenceId: 'LIC-SYNTH-0002', licenceReference: 'LIC-ZA-GP-TEST-0002', operatorId: 'OP-SYNTH-0002', issuingAuthorityId: 'AUTH-ZA-GP-PLA-TEST', jurisdiction: 'ZA-GP', licenceType: 'ONLINE_BETTING', status: 'UNKNOWN', effectiveFrom: '2023-01-01T00:00:00Z', expiryDate: '2026-12-31T00:00:00Z', sourceRecordId: 'REC-SYNTH-0002A', lastVerifiedAt: null, verificationState: 'CONFLICTING_SOURCE_DATA', accessScope: 'JURISDICTION_LOCAL' },
    { licenceId: 'LIC-SYNTH-WC-0100', licenceReference: 'LIC-ZA-WC-TEST-0100', operatorId: 'OP-SYNTH-WC-0100', issuingAuthorityId: 'AUTH-ZA-WC-PLA-TEST', jurisdiction: 'ZA-WC', licenceType: 'ONLINE_BETTING', status: 'LICENSED', effectiveFrom: '2024-01-01T00:00:00Z', expiryDate: '2027-12-31T00:00:00Z', sourceRecordId: 'REC-SYNTH-0100', lastVerifiedAt: '2026-09-01T00:00:00Z', verificationState: 'VERIFIED', accessScope: 'JURISDICTION_LOCAL' },
  ],
  sourceRecords: [
    { recordId: 'REC-SYNTH-0001', sourceId: 'SRC-SYNTHETIC-REGISTRY', authorityLevel: 'SYNTHETIC_TEST', subjectType: 'LICENCE', subjectReference: 'LIC-ZA-GP-TEST-0001', jurisdiction: 'ZA-GP', evidenceReference: 'evref:syn-lic-0001', contentHash: '1'.repeat(64), retrievedAt: '2026-09-01T00:00:00Z', effectiveAt: '2026-09-01T00:00:00Z', verificationStatus: 'APPROVED', assertedState: 'LICENSED', isSynthetic: true },
    { recordId: 'REC-SYNTH-0009', sourceId: 'SRC-SYNTHETIC-REGISTRY', authorityLevel: 'SYNTHETIC_TEST', subjectType: 'LICENCE', subjectReference: 'LIC-ZA-GP-TEST-0009', jurisdiction: 'ZA-GP', evidenceReference: 'evref:syn-lic-0009', contentHash: '9'.repeat(64), retrievedAt: '2024-01-15T00:00:00Z', effectiveAt: '2024-01-01T00:00:00Z', verificationStatus: 'APPROVED', assertedState: 'EXPIRED', isSynthetic: true },
    { recordId: 'REC-SYNTH-0002A', sourceId: 'SRC-SYNTHETIC-CONFLICT-A', authorityLevel: 'SYNTHETIC_TEST', subjectType: 'LICENCE', subjectReference: 'LIC-ZA-GP-TEST-0002', jurisdiction: 'ZA-GP', evidenceReference: 'evref:syn-lic-0002a', contentHash: 'a'.repeat(64), retrievedAt: '2026-08-01T00:00:00Z', effectiveAt: '2026-08-01T00:00:00Z', verificationStatus: 'APPROVED', assertedState: 'LICENSED', isSynthetic: true },
    { recordId: 'REC-SYNTH-0002B', sourceId: 'SRC-SYNTHETIC-CONFLICT-B', authorityLevel: 'SYNTHETIC_TEST', subjectType: 'LICENCE', subjectReference: 'LIC-ZA-GP-TEST-0002', jurisdiction: 'ZA-GP', evidenceReference: 'evref:syn-lic-0002b', contentHash: 'b'.repeat(64), retrievedAt: '2026-08-02T00:00:00Z', effectiveAt: '2026-08-02T00:00:00Z', verificationStatus: 'APPROVED', assertedState: 'EXPIRED', isSynthetic: true },
    { recordId: 'REC-SYNTH-0100', sourceId: 'SRC-SYNTHETIC-REGISTRY', authorityLevel: 'SYNTHETIC_TEST', subjectType: 'LICENCE', subjectReference: 'LIC-ZA-WC-TEST-0100', jurisdiction: 'ZA-WC', evidenceReference: 'evref:syn-lic-0100', contentHash: 'c'.repeat(64), retrievedAt: '2026-09-01T00:00:00Z', effectiveAt: '2026-09-01T00:00:00Z', verificationStatus: 'APPROVED', assertedState: 'LICENSED', isSynthetic: true },
  ],
};
