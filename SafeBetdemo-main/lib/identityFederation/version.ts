// ─── National Identity Federation — version metadata framework (v2.0, ADR-006)
//
// Phase 3.1 Foundation. Every SB-NAT and every decision carries an immutable
// five-part version stamp (Design §20). Foundation owns the current component
// versions and assembles a stamp from a jurisdiction profile.

import type { FederationVersionStamp, DecisionVersions } from './types.ts';
import type { JurisdictionProfile } from './jurisdictionProfiles.ts';

/** Current component versions for this build of the federation architecture. */
export const FEDERATION_ALGORITHM_VERSION = '2.0';
export const MATCHING_ENGINE_VERSION = '2.0';
export const DECISION_ENGINE_VERSION = '2.0';
export const RULE_SET_VERSION = 'RG-01';

/**
 * Build the immutable version stamp for a decision under a jurisdiction profile.
 * The matching-policy and jurisdiction versions come from the profile (data);
 * the algorithm/engine/rule-set versions come from this build.
 */
export function buildVersionStamp(profile: JurisdictionProfile): FederationVersionStamp {
  return Object.freeze({
    federationAlgorithmVersion: FEDERATION_ALGORITHM_VERSION,
    matchingPolicyVersion: profile.matchingPolicyVersion,
    jurisdictionVersion: profile.jurisdictionVersion,
    decisionEngineVersion: DECISION_ENGINE_VERSION,
    ruleSetVersion: RULE_SET_VERSION,
  });
}

/** Human-readable stamp for audit/display (no PII). */
export function describeVersionStamp(s: FederationVersionStamp): string {
  return `Federation Algorithm v${s.federationAlgorithmVersion} · Decision Engine v${s.decisionEngineVersion} · Policy ${s.matchingPolicyVersion} · Jurisdiction ${s.jurisdictionVersion} · Rule Set ${s.ruleSetVersion}`;
}

/** Build the immutable SIX-part decision version stamp (version governance, Milestone 3.3). */
export function buildDecisionVersionStamp(profile: JurisdictionProfile): DecisionVersions {
  return Object.freeze({
    federationAlgorithmVersion: FEDERATION_ALGORITHM_VERSION,
    matchingEngineVersion: MATCHING_ENGINE_VERSION,
    decisionEngineVersion: DECISION_ENGINE_VERSION,
    matchingPolicyVersion: profile.matchingPolicyVersion,
    ruleSetVersion: RULE_SET_VERSION,
    jurisdictionVersion: profile.jurisdictionVersion,
  });
}
