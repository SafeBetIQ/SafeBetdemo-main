// ─── SafeBet Guardian — evidence reference adapter (ARCH-V4-C0) ───────────────
//
// Guardian consumes the SHARED evidence framework (../../../lib/platform/evidence/index.ts)
// through the governed contract. C0 proves, with SYNTHETIC evidence only, the path:
//   Guardian → Shared Evidence interface → stored/referenced evidence → Shared Audit.
// No real illegal-gambling evidence is ingested. Evidence bodies are never carried
// inline — Guardian holds a REFERENCE (id + integrity hash), not the payload.

import { validatePagination, narrowCasinoScope } from '../../../lib/platform/evidence/index.ts';
import { GUARDIAN_PRODUCT, type ProductTag } from './product.ts';

export type GuardianEvidenceClassification = 'PUBLIC' | 'RESTRICTED' | 'SENSITIVE';

export interface GuardianEvidenceReference {
  evidenceId: string;
  product: ProductTag;            // GUARDIAN
  jurisdiction: string;
  caseReference: string;
  classification: GuardianEvidenceClassification;
  integrityHash: string;          // hash of the stored evidence (integrity ref, not the body)
  retentionUntil: string;         // ISO 8601 retention boundary (POPIA retention)
  accessPurpose: string;          // purpose/context for access (purpose limitation)
  isSynthetic: boolean;           // C0: always true
  createdAt: string;
}

export class GuardianEvidenceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'GuardianEvidenceError'; this.status = status; }
}

export function makeEvidenceReference(
  input: Omit<GuardianEvidenceReference, 'product' | 'isSynthetic'> & { isSynthetic?: boolean },
): GuardianEvidenceReference {
  const e: GuardianEvidenceReference = { ...input, product: GUARDIAN_PRODUCT, isSynthetic: input.isSynthetic ?? true };
  for (const f of ['evidenceId', 'jurisdiction', 'caseReference', 'integrityHash', 'retentionUntil', 'accessPurpose', 'createdAt'] as const) {
    if (!e[f]) throw new GuardianEvidenceError(`evidence.${f} required`);
  }
  if (!['PUBLIC', 'RESTRICTED', 'SENSITIVE'].includes(e.classification)) throw new GuardianEvidenceError('invalid classification');
  if (Number.isNaN(Date.parse(e.retentionUntil))) throw new GuardianEvidenceError('retentionUntil must be ISO 8601');
  if (!e.isSynthetic) throw new GuardianEvidenceError('C0 permits synthetic evidence only');
  return e;
}

/** Reuse the shared pagination validator so Guardian evidence listings inherit the
 *  same bounded-request guarantees (no unbounded/oversized reads). */
export function validateGuardianEvidencePage(page?: unknown, pageSize?: unknown) {
  return validatePagination(page, pageSize);
}

/** Guardian has no casino scope; this proves the shared narrow-only helper cannot
 *  be tricked into widening a Guardian jurisdiction into an IQ casino scope. */
export { narrowCasinoScope as sharedNarrowCasinoScope };
