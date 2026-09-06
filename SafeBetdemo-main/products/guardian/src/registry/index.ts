// ─── SafeBet Guardian — registry module surface (ARCH-V4-C1) ──────────────────

export * from './types.ts';
export * from './matching.ts';
export * from './sources.ts';
export * from './resolve.ts';
export * from './snapshot.ts';

import type { GuardianPrincipal } from '../identity.ts';
import { GuardianIdentityError } from '../identity.ts';

/** Registry publication is a controlled status change. Ingestion/staging is NOT
 *  authoritative acceptance — a synthetic Registry Analyst (INVESTIGATOR) who staged
 *  a record may NOT also authorise its publication; that requires a distinct
 *  AUTHORISING_OFFICER. Reuses the C0 SoD principle. Synthetic principals only. */
export interface RegistryPublicationRequest {
  batchId: string;
  jurisdiction: string;
  stagedBy: GuardianPrincipal;       // INVESTIGATOR / registry analyst
  authorisedBy: GuardianPrincipal;   // AUTHORISING_OFFICER
}

export interface PublicationResult { ok: boolean; violations: string[] }

export function authorisePublication(req: RegistryPublicationRequest): PublicationResult {
  const violations: string[] = [];
  if (req.stagedBy.role !== 'INVESTIGATOR') violations.push(`stagedBy must be INVESTIGATOR (registry analyst), got ${req.stagedBy.role}`);
  if (req.authorisedBy.role !== 'AUTHORISING_OFFICER') violations.push(`authorisedBy must be AUTHORISING_OFFICER, got ${req.authorisedBy.role}`);
  if (req.stagedBy.principalId === req.authorisedBy.principalId) {
    violations.push(`separation of duties: ${req.stagedBy.principalId} cannot both stage and authorise publication of ${req.batchId}`);
  }
  if (req.stagedBy.jurisdiction !== req.jurisdiction || req.authorisedBy.jurisdiction !== req.jurisdiction) {
    violations.push(`publication principals must be scoped to jurisdiction ${req.jurisdiction}`);
  }
  return { ok: violations.length === 0, violations };
}

/** Throwing guard for API/worker paths. */
export function assertPublicationAuthorised(req: RegistryPublicationRequest): void {
  const r = authorisePublication(req);
  if (!r.ok) throw new GuardianIdentityError(`registry publication denied: ${r.violations.join('; ')}`, 403);
}
