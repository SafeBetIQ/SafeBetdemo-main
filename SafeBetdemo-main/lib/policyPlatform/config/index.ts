// ─── Default enterprise policy configuration (Phase 3.6) ─────────────────────
//
// The shipped configuration set: platform + RG + compliance + operator
// baselines and the jurisdiction packs. Hosts may replace or extend this
// through PolicyRulesPlatform.configure() with rules from ANY source
// (database, regulator feed, tenant settings) — the packs below are data,
// not behaviour.

import type { PolicyRule } from '../model.ts';
import { RESPONSIBLE_GAMBLING_POLICIES } from './responsibleGambling.ts';
import { COMPLIANCE_POLICIES } from './compliance.ts';
import { OPERATOR_POLICIES } from './operator.ts';
import { PLATFORM_POLICIES } from './platformPolicies.ts';
import { JURISDICTION_POLICIES } from './jurisdictions.ts';

export { JURISDICTION_EXTENSION_POINTS, ZA_POLICIES, BW_POLICIES, KE_POLICIES } from './jurisdictions.ts';
export { RESPONSIBLE_GAMBLING_POLICIES } from './responsibleGambling.ts';
export { COMPLIANCE_POLICIES } from './compliance.ts';
export { OPERATOR_POLICIES } from './operator.ts';
export { PLATFORM_POLICIES } from './platformPolicies.ts';

export function defaultConfiguration(): PolicyRule[] {
  return [
    ...RESPONSIBLE_GAMBLING_POLICIES,
    ...COMPLIANCE_POLICIES,
    ...OPERATOR_POLICIES,
    ...PLATFORM_POLICIES,
    ...JURISDICTION_POLICIES,
  ];
}
