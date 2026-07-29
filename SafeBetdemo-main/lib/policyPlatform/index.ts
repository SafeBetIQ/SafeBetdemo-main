// Enterprise Policy & Rules Platform — public API (Phase 3.6).
//
// Consumers obtain THE platform via getPolicyPlatform() and call
// evaluate(twin, { jurisdiction }) — the clean decision interface Phase 3.7
// Enterprise Consumers build on. Decisions are advice with provenance;
// executing them is the consumer's responsibility, never the platform's.

export {
  type Condition, type Comparison, type ComparisonOp, type FactPath,
} from './conditions.ts';
export {
  POLICY_SCOPES, POLICY_SUBJECTS, DECISION_ACTIONS, DECISION_PRIORITIES,
  validateRule,
  type PolicyRule, type PolicyScope, type PolicySubject,
  type PolicyDecision, type DecisionAction, type DecisionPriority,
  type DecisionSet, type DecisionSubject,
} from './model.ts';
export { type EvaluationContext } from './evaluation.ts';
export {
  defaultConfiguration, JURISDICTION_EXTENSION_POINTS,
  ZA_POLICIES, BW_POLICIES, KE_POLICIES,
  RESPONSIBLE_GAMBLING_POLICIES, COMPLIANCE_POLICIES,
  OPERATOR_POLICIES, PLATFORM_POLICIES,
} from './config/index.ts';
export { PolicyRulesPlatform, getPolicyPlatform } from './platform.ts';
export {
  type PolicyStoreClient, loadActivePolicyRules, toStoredRows,
} from './store.ts';
