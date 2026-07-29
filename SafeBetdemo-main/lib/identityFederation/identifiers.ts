// ─── National Identity Federation — SB-NAT identifier format (v2.0, ADR-006) ─
//
// Phase 3.1 Foundation. Format + validation ONLY. Minting an SB-NAT (assigning
// one to a cluster) is the Federation Decision Engine's authority (Milestone
// 3.3) via the SB-NAT Registry (3.4). Foundation never mints.

import type { JurisdictionCode, SbNatId } from './types.ts';

const SBNAT_RE = /^SB-NAT-(ZA|NA|BW|KE)-[0-9A-F]{6,24}$/;

/** Format a sovereign correlation id from a jurisdiction + uppercase hex cluster key. */
export function formatSbNat(jurisdiction: JurisdictionCode, hex: string): SbNatId {
  return `SB-NAT-${jurisdiction}-${hex.toUpperCase()}`;
}

/** Validate the SB-NAT format (does NOT assert existence in the registry). */
export function isSbNat(value: string): boolean {
  return SBNAT_RE.test(value);
}

/** Extract the jurisdiction from an SB-NAT, or null if malformed. */
export function jurisdictionOfSbNat(value: string): JurisdictionCode | null {
  const m = SBNAT_RE.exec(value);
  return m ? (m[1] as JurisdictionCode) : null;
}
