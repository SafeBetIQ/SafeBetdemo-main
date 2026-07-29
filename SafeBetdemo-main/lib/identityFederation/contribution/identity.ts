// ─── Operator Federation Contribution — SB-PLR resolution (Milestone 4.3) ────
//
// Identity Resolution abstraction. SB-PLR remains the operator system-of-record
// identity and Identity Resolution is authoritative for it — the federation
// contribution path NEVER creates an SB-PLR; it only VALIDATES an existing,
// tenant-scoped SB-PLR. PILOT NON-PRODUCTION ONLY (synthetic identities).

import type { JurisdictionCode } from '../types.ts';
import { ContributionRejected } from './model.ts';

export type SbPlrStatus = 'active' | 'invalid' | 'deleted';

export interface SbPlrIdentity {
  sbPlr: string;
  tenantId: string;
  operatorId: string;
  jurisdiction: JurisdictionCode;
  status: SbPlrStatus;
}

/** Identity Resolution abstraction (read-only; authoritative for SB-PLR). */
export interface SbPlrResolver {
  resolve(sbPlr: string): SbPlrIdentity | undefined;
}

const SBPLR_RE = /^SB-PLR-[A-Za-z0-9._:-]{1,64}$/;

/** In-memory synthetic SB-PLR directory (pilot/test). Never mutated by federation. */
export class InMemorySbPlrDirectory implements SbPlrResolver {
  private readonly byId = new Map<string, SbPlrIdentity>();
  constructor(seed: SbPlrIdentity[] = []) { for (const s of seed) this.byId.set(s.sbPlr, Object.freeze({ ...s })); }
  register(identity: SbPlrIdentity): void { this.byId.set(identity.sbPlr, Object.freeze({ ...identity })); }
  resolve(sbPlr: string): SbPlrIdentity | undefined { const s = this.byId.get(sbPlr); return s ? { ...s } : undefined; }
}

/**
 * Validate a contribution's SB-PLR against Identity Resolution + the trusted
 * authenticated context. Rejects invalid format, unknown/deleted identities, and
 * any cross-tenant / cross-operator / cross-jurisdiction attachment.
 */
export function validateContributionSbPlr(
  resolver: SbPlrResolver,
  ev: { sbPlr: string; tenantId: string; sourceOperatorId: string; jurisdiction: JurisdictionCode },
  ctx: { tenantId: string; operatorId: string; jurisdiction: JurisdictionCode },
): SbPlrIdentity {
  if (typeof ev.sbPlr !== 'string' || !SBPLR_RE.test(ev.sbPlr)) throw new ContributionRejected('invalid-sbplr', 'malformed SB-PLR');
  const id = resolver.resolve(ev.sbPlr);
  if (!id) throw new ContributionRejected('invalid-sbplr', 'SB-PLR not found in Identity Resolution');
  if (id.status !== 'active') throw new ContributionRejected('invalid-sbplr', `SB-PLR is ${id.status}`);
  // ownership must match the SB-PLR's Identity Resolution record …
  if (id.tenantId !== ev.tenantId) throw new ContributionRejected('cross-tenant-sbplr', 'SB-PLR belongs to a different tenant');
  if (id.operatorId !== ev.sourceOperatorId) throw new ContributionRejected('unauthorised-operator', 'SB-PLR belongs to a different operator');
  if (id.jurisdiction !== ev.jurisdiction) throw new ContributionRejected('wrong-jurisdiction', 'SB-PLR jurisdiction mismatch');
  // … AND the trusted authenticated context (attribution never from payload alone)
  if (id.tenantId !== ctx.tenantId) throw new ContributionRejected('tenant-mismatch', 'SB-PLR tenant ≠ authenticated tenant');
  if (id.operatorId !== ctx.operatorId) throw new ContributionRejected('unauthorised-operator', 'SB-PLR operator ≠ authenticated operator');
  if (id.jurisdiction !== ctx.jurisdiction) throw new ContributionRejected('wrong-jurisdiction', 'SB-PLR jurisdiction ≠ authenticated jurisdiction');
  return id;
}
