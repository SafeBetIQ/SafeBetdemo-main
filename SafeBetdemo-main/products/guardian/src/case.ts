// ─── SafeBet Guardian — case primitive (ARCH-V4-C0) ──────────────────────────
//
// Minimal Guardian case sufficient to prove product independence. NOT the full
// investigation/enforcement lifecycle (C1+), and deliberately NOT the SafeBet IQ
// responsible-gambling case semantics. Synthetic only.

import { GUARDIAN_PRODUCT, type ProductTag } from './product.ts';

export type GuardianCaseStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';
export const GUARDIAN_CASE_STATUSES: readonly GuardianCaseStatus[] = ['OPEN', 'UNDER_REVIEW', 'CLOSED'];

export interface GuardianCase {
  caseId: string;
  product: ProductTag;          // GUARDIAN
  jurisdiction: string;
  status: GuardianCaseStatus;
  createdAt: string;            // ISO 8601
  actorPrincipalId: string;
  correlationId: string;
  evidenceReference?: string | null;
  auditReference?: string | null;
  isSynthetic: boolean;         // C0: always true
}

export class GuardianCaseError extends Error {
  constructor(message: string) { super(message); this.name = 'GuardianCaseError'; }
}

export function makeCase(input: Omit<GuardianCase, 'product' | 'status' | 'isSynthetic'> & { status?: GuardianCaseStatus; isSynthetic?: boolean }): GuardianCase {
  const c: GuardianCase = {
    caseId: input.caseId,
    product: GUARDIAN_PRODUCT,
    jurisdiction: input.jurisdiction,
    status: input.status ?? 'OPEN',
    createdAt: input.createdAt,
    actorPrincipalId: input.actorPrincipalId,
    correlationId: input.correlationId,
    evidenceReference: input.evidenceReference ?? null,
    auditReference: input.auditReference ?? null,
    isSynthetic: input.isSynthetic ?? true,
  };
  if (!c.caseId) throw new GuardianCaseError('caseId required');
  if (!c.jurisdiction) throw new GuardianCaseError('jurisdiction required');
  if (!GUARDIAN_CASE_STATUSES.includes(c.status)) throw new GuardianCaseError(`invalid status ${c.status}`);
  if (Number.isNaN(Date.parse(c.createdAt))) throw new GuardianCaseError('createdAt must be ISO 8601');
  if (!c.isSynthetic) throw new GuardianCaseError('C0 permits synthetic cases only');
  return c;
}
