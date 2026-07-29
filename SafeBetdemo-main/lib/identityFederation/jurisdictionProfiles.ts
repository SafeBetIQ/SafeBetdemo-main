// ─── National Identity Federation — jurisdiction profiles (v2.0, ADR-006) ────
//
// Phase 3.1 Foundation. Matching is policy-driven per jurisdiction (Design §15)
// — these profiles are DATA, not code, and are versioned like policy packs
// (Constitution §4). Foundation ships the profile framework + the four sovereign
// profiles; it does NOT evaluate them for matching (that is Milestone 3.2).

import type { AttributeType, AttributeStrength, ConfidenceTier, JurisdictionCode } from './types.ts';

export interface AttributeRule {
  attributeType: AttributeType;
  strength: AttributeStrength;
  weight: number;
}

/** Decision policy (data, not code) — how the Federation Decision Engine (3.3) rules on a candidate. */
export interface DecisionPolicy {
  /** Score at/above which a candidate may be auto-approved (met by a strong match or ≥2 medium). */
  autoApproveMinScore: number;
  /** Score at/above which (and below auto) a candidate goes to manual review; below → rejected. */
  manualReviewMinScore: number;
  /** Minimum count of matched attributes (minimum-evidence requirement). */
  minMatchedAttributes: number;
  /** If every matched attribute is 'soft' strength, force manual review regardless of score. */
  mandatoryReviewIfOnlySoft: boolean;
}

export interface JurisdictionProfile {
  jurisdiction: JurisdictionCode;
  /** Immutable jurisdiction snapshot id, e.g. 'ZA-2027'. */
  jurisdictionVersion: string;
  /** The matching-policy pack version for this profile. */
  matchingPolicyVersion: string;
  /** Which attributes are enabled here, with strength + weight. */
  attributes: AttributeRule[];
  /** Combined-weight thresholds for each tier (evaluated by the Matching Engine, 3.2). */
  thresholds: { confirmed: number; probable: number; possible: number };
  /** Tiers at/above which the Decision Engine (3.3) may auto-confirm vs must manually review. */
  autoConfirmTier: ConfidenceTier;
  manualReviewTier: ConfidenceTier;
  /** Decision policy for the Federation Decision Engine (Milestone 3.3). */
  decision: DecisionPolicy;
  /** Audit retention (days) — never below the legal minimum. */
  auditRetentionDays: number;
}

// The four sovereign profiles (Design §15). Each isolated; no cross-border rules.
const PROFILES: Record<JurisdictionCode, JurisdictionProfile> = {
  ZA: {
    jurisdiction: 'ZA', jurisdictionVersion: 'ZA-2027', matchingPolicyVersion: '1.4',
    attributes: [
      { attributeType: 'national_id', strength: 'strong', weight: 1.0 },
      { attributeType: 'phone', strength: 'medium', weight: 0.6 },
      { attributeType: 'device_fingerprint', strength: 'soft', weight: 0.3 },
    ],
    thresholds: { confirmed: 1.0, probable: 0.6, possible: 0.3 },
    autoConfirmTier: 'confirmed', manualReviewTier: 'probable',
    decision: { autoApproveMinScore: 1.0, manualReviewMinScore: 0.3, minMatchedAttributes: 1, mandatoryReviewIfOnlySoft: true },
    auditRetentionDays: 3650,
  },
  NA: {
    jurisdiction: 'NA', jurisdictionVersion: 'NA-2027', matchingPolicyVersion: '1.0',
    attributes: [
      { attributeType: 'passport', strength: 'strong', weight: 1.0 },
      { attributeType: 'phone', strength: 'medium', weight: 0.6 },
    ],
    thresholds: { confirmed: 1.0, probable: 0.6, possible: 0.3 },
    autoConfirmTier: 'confirmed', manualReviewTier: 'probable',
    decision: { autoApproveMinScore: 1.0, manualReviewMinScore: 0.3, minMatchedAttributes: 1, mandatoryReviewIfOnlySoft: true },
    auditRetentionDays: 3650,
  },
  BW: {
    jurisdiction: 'BW', jurisdictionVersion: 'BW-2027', matchingPolicyVersion: '1.0',
    attributes: [
      { attributeType: 'national_id', strength: 'strong', weight: 1.0 },
      { attributeType: 'device_fingerprint', strength: 'soft', weight: 0.3 },
    ],
    thresholds: { confirmed: 1.0, probable: 0.6, possible: 0.3 },
    autoConfirmTier: 'confirmed', manualReviewTier: 'probable',
    decision: { autoApproveMinScore: 1.0, manualReviewMinScore: 0.3, minMatchedAttributes: 1, mandatoryReviewIfOnlySoft: true },
    auditRetentionDays: 3650,
  },
  KE: {
    jurisdiction: 'KE', jurisdictionVersion: 'KE-2027', matchingPolicyVersion: '1.0',
    attributes: [
      { attributeType: 'national_id', strength: 'strong', weight: 1.0 },
      { attributeType: 'phone', strength: 'medium', weight: 0.6 },
      { attributeType: 'email', strength: 'medium', weight: 0.6 },
    ],
    thresholds: { confirmed: 1.0, probable: 0.6, possible: 0.3 },
    autoConfirmTier: 'confirmed', manualReviewTier: 'probable',
    decision: { autoApproveMinScore: 1.0, manualReviewMinScore: 0.3, minMatchedAttributes: 1, mandatoryReviewIfOnlySoft: true },
    auditRetentionDays: 3650,
  },
};

/** Get the frozen profile for a jurisdiction (deep-frozen so callers cannot mutate policy). */
export function getJurisdictionProfile(j: JurisdictionCode): JurisdictionProfile {
  const p = PROFILES[j];
  if (!p) throw new Error(`no jurisdiction profile for '${j}'`);
  return deepFreeze(structuredCloneSafe(p));
}

/** Is an attribute type enabled (approved) in this jurisdiction? */
export function isAttributeEnabled(j: JurisdictionCode, t: AttributeType): boolean {
  return (PROFILES[j]?.attributes ?? []).some((a) => a.attributeType === t);
}

export function listJurisdictions(): JurisdictionCode[] {
  return Object.keys(PROFILES) as JurisdictionCode[];
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
function deepFreeze<T>(o: T): T {
  Object.freeze(o);
  for (const k of Object.keys(o as object)) {
    const v = (o as Record<string, unknown>)[k];
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return o;
}
