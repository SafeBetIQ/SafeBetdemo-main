// ─── SafeBet Guardian — evidence access + hold + export policy (ARCH-V4-C7) ───
// Deterministic, synthetic policy. Access decisions combine role × jurisdiction ×
// classification × purpose. Holds have their own bounded place/review/release SoD.
// Export manifests are hashed (SHA-256). No legal determination, no enforcement.

import { sha256Hex } from './custody.ts';
import type { EvidenceClassification, EvidenceRole, AccessPurpose } from './types.ts';

const CLASS_RANK: Record<EvidenceClassification, number> = {
  PUBLIC_REFERENCE: 0, INTERNAL: 1, RESTRICTED: 2, HIGHLY_RESTRICTED: 3,
};

/** Max classification each synthetic role may read (least-privilege; not service-role wide). */
const ROLE_MAX_CLASS: Record<EvidenceRole, number> = {
  INVESTIGATOR: CLASS_RANK.RESTRICTED,          // up to RESTRICTED
  LEGAL_REVIEWER: CLASS_RANK.HIGHLY_RESTRICTED, // bounded higher profile
  AUTHORISING_OFFICER: CLASS_RANK.RESTRICTED,
  SYSTEM_SERVICE: CLASS_RANK.HIGHLY_RESTRICTED, // only for approved automated operations
};

export interface AccessRequest {
  role: EvidenceRole;
  principalJurisdiction: string;
  evidenceJurisdiction: string;
  classification: EvidenceClassification;
  purpose: AccessPurpose | null;
}
export interface AccessDecision { decision: 'ALLOW' | 'DENY'; reason: string }

/** Evidence access decision: jurisdiction hard boundary, then classification ceiling,
 *  then purpose requirement (no arbitrary browsing). */
export function evaluateEvidenceAccess(req: AccessRequest): AccessDecision {
  if (req.principalJurisdiction !== req.evidenceJurisdiction) return { decision: 'DENY', reason: 'CROSS_JURISDICTION' };
  if (!req.purpose) return { decision: 'DENY', reason: 'PURPOSE_REQUIRED' };
  if (CLASS_RANK[req.classification] > ROLE_MAX_CLASS[req.role]) return { decision: 'DENY', reason: 'CLASSIFICATION_ABOVE_ROLE' };
  return { decision: 'ALLOW', reason: 'POLICY_SATISFIED' };
}

// ── Preservation/legal hold SoD: place/review/release bounded to roles. ───────
export type HoldAction = 'PLACE' | 'REVIEW' | 'RELEASE';
const HOLD_ROLE_MATRIX: Record<HoldAction, EvidenceRole[]> = {
  PLACE: ['INVESTIGATOR', 'LEGAL_REVIEWER'],
  REVIEW: ['LEGAL_REVIEWER', 'AUTHORISING_OFFICER'],
  RELEASE: ['LEGAL_REVIEWER'], // release requires a Legal Reviewer — not any evidence consumer
};
export function mayPerformHoldAction(action: HoldAction, role: EvidenceRole): boolean {
  return HOLD_ROLE_MATRIX[action].includes(role);
}
/** Destructive disposition is blocked while a preservation hold is ACTIVE. */
export function dispositionBlockedByHold(holdState: 'NONE' | 'HELD' | 'ACTIVE' | 'RELEASED'): boolean {
  return holdState === 'HELD' || holdState === 'ACTIVE';
}

// ── Export manifest (regulator/legal review prep; NOT enforcement). ───────────
export interface ExportManifestItem { evidenceId: string; evidenceReference: string; contentHash: string; classification: EvidenceClassification; integrityStatus: string; capturedAt: string | null; sourceReference: string; custodyHead: string }
export interface ExportManifest {
  product: 'GUARDIAN';
  jurisdiction: string;
  caseReference: string | null;
  exportedAt: string;
  exportActor: string;
  items: ExportManifestItem[];
  manifestHash: string;
  hashAlgorithm: 'SHA-256';
  isLegalDetermination: false;
  isEnforcementAuthorised: false;
  note: string;
}

/** Build a synthetic export manifest and hash it (SHA-256 over the canonical item list). */
export function buildExportManifest(inp: { jurisdiction: string; caseReference: string | null; exportActor: string; exportedAt: string; items: ExportManifestItem[] }): ExportManifest {
  const canonical = inp.items.map((i) => `${i.evidenceId}:${i.contentHash}:${i.integrityStatus}:${i.custodyHead}`).join('|');
  const manifestHash = sha256Hex(`${inp.jurisdiction}|${inp.caseReference ?? ''}|${inp.exportedAt}|${canonical}`);
  return {
    product: 'GUARDIAN', jurisdiction: inp.jurisdiction, caseReference: inp.caseReference,
    exportedAt: inp.exportedAt, exportActor: inp.exportActor, items: inp.items,
    manifestHash, hashAlgorithm: 'SHA-256', isLegalDetermination: false, isEnforcementAuthorised: false,
    note: 'Synthetic evidence export manifest for regulator/legal review preparation — NOT a legal determination, NOT an enforcement authorisation, NOT a legally recognised digital signature.',
  };
}
