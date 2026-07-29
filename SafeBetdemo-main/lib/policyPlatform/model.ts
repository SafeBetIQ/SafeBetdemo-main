// ─── Enterprise Policy & Rules Platform — policy & decision model (3.6) ──────
//
// A PolicyRule is CONFIGURATION: plain JSON-serializable data naming what it
// applies to, when it fires (declarative condition over the enriched twin),
// and the decision it returns. Jurisdictions, operators and tenants change
// behaviour by supplying different rule sets — never by changing code.
//
// A PolicyDecision is the platform's ONLY output. It is advice with
// provenance — the platform never executes it, never persists it, never
// enriches the twin with it. Execution belongs to Enterprise Consumers
// (Phase 3.7).

import { validateCondition, type Condition } from './conditions.ts';

export const POLICY_SCOPES = [
  'jurisdiction',            // regulator-defined, selected by jurisdiction code
  'operator',                // casino-operator-defined, selected by casino/tenant
  'responsible-gambling',    // platform-wide RG baseline
  'compliance',              // platform-wide compliance baseline
  'platform',                // SafeBet IQ feature/tenant configuration
] as const;
export type PolicyScope = (typeof POLICY_SCOPES)[number];

export const POLICY_SUBJECTS = ['player', 'session', 'machine', 'floor', 'casino'] as const;
export type PolicySubject = (typeof POLICY_SUBJECTS)[number];

export const DECISION_ACTIONS = [
  'INTERVENTION_REQUIRED',
  'MONITORING_REQUIRED',
  'REGULATOR_NOTIFICATION_REQUIRED',
  'MACHINE_REVIEW_REQUIRED',
  'COMPLIANCE_REVIEW_REQUIRED',
  'RESPONSIBLE_GAMBLING_ACTION_REQUIRED',
  'OPERATIONAL_RECOMMENDATION',
] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const DECISION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type DecisionPriority = (typeof DECISION_PRIORITIES)[number];

export interface PolicyRule {
  /** Stable policy identifier, e.g. 'ZA-RG-001'. */
  policyId: string;
  scope: PolicyScope;
  /** ISO-ish jurisdiction code; rule applies only there. Omit = all. */
  jurisdiction?: string;
  /** Operator scoping; rule applies only to this casino. Omit = all. */
  casinoId?: string;
  /** Which runtime objects this rule is evaluated against. */
  appliesTo: PolicySubject;
  /** Declarative predicate over the enriched twin facts. */
  when: Condition;
  action: DecisionAction;
  priority: DecisionPriority;
  /** Human reason returned verbatim on the decision. */
  reason: string;
  /** Regulation / policy-document citation, e.g. 'ZA National Gambling Act 7/2004 s.16'. */
  policyReference: string;
  /** Whether a consumer MUST act (vs advisory). */
  executionRequired: boolean;
  /**
   * Where to READ decision confidence from (a fact path, typically
   * 'intelligence.risk.riskConfidence'). Omit = 1 (deterministic rule).
   * Read, never computed.
   */
  confidenceFrom?: string;
  enabled?: boolean; // default true
}

export interface DecisionSubject {
  kind: PolicySubject;
  id: string;
  casinoId: string;
}

export interface PolicyDecision {
  decisionId: string;
  policyId: string;
  scope: PolicyScope;
  jurisdiction: string | null;
  subject: DecisionSubject;
  action: DecisionAction;
  priority: DecisionPriority;
  reason: string;
  policyReference: string;
  confidence: number;
  executionRequired: boolean;
  evaluatedAt: string;
}

/** One evaluation pass over one casino's enriched twin. */
export interface DecisionSet {
  casinoId: string;
  jurisdiction: string;
  evaluatedAt: string;
  policiesEvaluated: number;
  subjectsEvaluated: number;
  decisions: PolicyDecision[];
}

/** Structural rule validation — reject, never repair. */
export function validateRule(rule: unknown): PolicyRule {
  if (rule === null || typeof rule !== 'object') throw new Error('policy rule must be an object');
  const r = rule as Record<string, unknown>;
  const id = typeof r.policyId === 'string' && r.policyId.length > 0 ? r.policyId : null;
  if (!id) throw new Error('policy rule requires a policyId');
  const where = `policy '${id}'`;
  if (POLICY_SCOPES.indexOf(r.scope as PolicyScope) === -1) throw new Error(`${where}: unknown scope '${String(r.scope)}'`);
  if (POLICY_SUBJECTS.indexOf(r.appliesTo as PolicySubject) === -1) throw new Error(`${where}: unknown subject '${String(r.appliesTo)}'`);
  if (DECISION_ACTIONS.indexOf(r.action as DecisionAction) === -1) throw new Error(`${where}: unknown action '${String(r.action)}'`);
  if (DECISION_PRIORITIES.indexOf(r.priority as DecisionPriority) === -1) throw new Error(`${where}: unknown priority '${String(r.priority)}'`);
  if (typeof r.reason !== 'string' || r.reason.length === 0) throw new Error(`${where}: requires a reason`);
  if (typeof r.policyReference !== 'string' || r.policyReference.length === 0) throw new Error(`${where}: requires a policyReference`);
  if (typeof r.executionRequired !== 'boolean') throw new Error(`${where}: requires executionRequired`);
  validateCondition(r.when, `${where}.when`);
  return rule as PolicyRule;
}

const PRIORITY_RANK: Record<DecisionPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function byPriority(a: PolicyDecision, b: PolicyDecision): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || a.policyId.localeCompare(b.policyId);
}
