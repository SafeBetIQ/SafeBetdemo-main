// ─── SafeBet Guardian — source authority, conflict & freshness (ARCH-V4-C1) ───
//
// Not all sources are equal; conflicting records must NOT be silently resolved by
// "last write wins"; stale data must NOT be presented as currently verified.

import type { RegistrySourceRecord, SourceAuthorityLevel, FreshnessStatus } from './types.ts';

/** Source-authority precedence (higher = more authoritative). Policy/configuration —
 *  recorded here, not hidden in call sites. C1 seeds SYNTHETIC_TEST only. */
export const AUTHORITY_PRECEDENCE: Record<SourceAuthorityLevel, number> = {
  REGULATOR_AUTHORITATIVE: 60,
  REGULATOR_SUPPLIED: 50,
  VERIFIED_OFFICIAL_PUBLIC_RECORD: 40,
  OPERATOR_SUPPLIED: 20,
  THIRD_PARTY_REFERENCE: 10,
  SYNTHETIC_TEST: 1,
};

export interface ConflictResult {
  conflict: boolean;
  assertedStates: string[];
  records: string[];
  /** true when the disagreement cannot be resolved by authority precedence alone. */
  requiresHumanReview: boolean;
}

/** Detect conflicting authoritative assertions for one subject. Records that assert
 *  different states are a CONFLICT. It is resolvable ONLY if exactly one record has
 *  strictly higher authority than all others; otherwise → human review. C1 never
 *  auto-resolves synthetic conflicts (all SYNTHETIC_TEST = equal authority). */
export function detectConflict(records: RegistrySourceRecord[]): ConflictResult {
  const active = records.filter((r) => r.verificationStatus === 'APPROVED' && r.assertedState);
  const states = unique(active.map((r) => String(r.assertedState)));
  if (states.length <= 1) {
    return { conflict: false, assertedStates: states, records: active.map((r) => r.recordId), requiresHumanReview: false };
  }
  // Conflict. Can authority precedence pick a single winner?
  const maxAuthority = Math.max(...active.map((r) => AUTHORITY_PRECEDENCE[r.authorityLevel]));
  const topRecords = active.filter((r) => AUTHORITY_PRECEDENCE[r.authorityLevel] === maxAuthority);
  const topStates = unique(topRecords.map((r) => String(r.assertedState)));
  return {
    conflict: true,
    assertedStates: states,
    records: active.map((r) => r.recordId),
    // A single unambiguous top authority resolves it; otherwise a human must decide.
    requiresHumanReview: topStates.length > 1,
  };
}

export interface FreshnessPolicy { freshDays: number; agingDays: number; }
/** Default DEMO thresholds. Configurable/policy-driven — NOT a regulatory threshold. */
export const DEFAULT_FRESHNESS: FreshnessPolicy = { freshDays: 30, agingDays: 180 };

/** Freshness of a verified fact. Stale data is never presented as currently verified. */
export function freshness(lastVerifiedAt: string | null | undefined, now: Date, policy: FreshnessPolicy = DEFAULT_FRESHNESS): FreshnessStatus {
  if (!lastVerifiedAt) return 'UNKNOWN';
  const ageDays = (now.getTime() - new Date(lastVerifiedAt).getTime()) / 86_400_000;
  if (Number.isNaN(ageDays)) return 'UNKNOWN';
  if (ageDays <= policy.freshDays) return 'FRESH';
  if (ageDays <= policy.agingDays) return 'AGING';
  return 'STALE';
}

function unique(a: string[]): string[] { return a.filter((v, i) => a.indexOf(v) === i); }
