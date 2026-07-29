// ─── National Policy Platform Extension — model, store, access, audit (v2.0)
//    ADR-006 · Milestone 3.6 · Regulator-plane, additive, policy-as-DATA.
//
// A configurable, jurisdiction-specific national policy capability that consumes
// authorised, explainable outputs from the Enterprise Correlation Layer (3.5) and
// evaluates responsible-gambling / regulatory policies into DETERMINISTIC,
// versioned, auditable, regulator-plane OUTCOMES. It never modifies operator
// runtime, SB-PLR, SB-NAT, the Registry, or the Correlation Layer, and it does
// NOT replace the operator Policy Platform.
//
// Policies are DECLARATIVE DATA (never executable scripts): definition,
// evaluation, outcome, approval and enforcement are separated; this milestone
// implements definition, evaluation, outcome and regulator approval models only.

import type { JurisdictionCode, SbNatId } from '../types.ts';
import { type AccessContext, authorise, AccessDeniedError } from '../correlation/index.ts';
import type { CorrelationProvenance } from '../correlation/index.ts';

// ── Vocabularies (closed, deterministic) ─────────────────────────────────────

export const POLICY_CATEGORIES = [
  'national-self-exclusion', 'national-cooling-off', 'cross-operator-harm-escalation',
  'national-investigation-trigger', 'regulator-notification', 'cross-operator-intervention-threshold',
] as const;
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export const POLICY_OUTCOMES = [
  'No Action', 'Continue Monitoring', 'Regulator Review Required',
  'National Investigation Recommended', 'National Cooling-Off Recommended',
  'National Self-Exclusion Confirmed', 'Cross-Operator Escalation Required',
  'Operator Notification Required', 'Intervention Review Required',
  'Policy Conflict Detected', 'Insufficient Evidence', 'Data Integrity Failure',
] as const;
export type PolicyOutcome = (typeof POLICY_OUTCOMES)[number];

export const POLICY_STATUSES = ['draft', 'active', 'retired'] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const CONDITION_OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists', 'isTrue', 'isFalse'] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const POLICY_REVIEW_STATES = ['not-required', 'pending-review', 'under-review', 'approved', 'rejected', 'returned', 'escalated', 'closed'] as const;
export type PolicyReviewState = (typeof POLICY_REVIEW_STATES)[number];

export const POLICY_APPEAL_STATES = ['open', 'under-review', 'upheld', 'dismissed', 'returned', 'closed'] as const;
export type PolicyAppealState = (typeof POLICY_APPEAL_STATES)[number];

export type PolicyOverrideStatus = 'none' | 'overridden';

export const POLICY_ROLES = ['evaluator', 'reviewer', 'override-authority', 'appeal-reviewer'] as const;
export type PolicyRole = (typeof POLICY_ROLES)[number];

export type PolicyFactValue = number | boolean | string | null;

// ── Policy-as-data definition (immutable once activated) ─────────────────────

export interface PolicyCondition {
  id: string;
  description: string;
  input: string;                 // a fact key (never code)
  operator: ConditionOperator;
  value?: PolicyFactValue | PolicyFactValue[];
}

export interface PolicyOutcomeRule {
  id: string;
  requires: string[];            // condition ids that must ALL pass
  outcome: PolicyOutcome;
  reason: string;
}

export interface PolicyDefinition {
  policyId: string;
  name: string;
  jurisdiction: JurisdictionCode;
  category: PolicyCategory;
  policyVersion: string;
  ruleSetVersion: string;
  effectiveDate: string;
  expiryDate: string | null;
  status: PolicyStatus;
  requiredInputs: string[];      // fact keys that must be present, else Insufficient Evidence
  requiredEvidence: string[];
  conditions: PolicyCondition[];
  thresholds: Record<string, number>;
  outcomeRules: PolicyOutcomeRule[];
  defaultOutcome: PolicyOutcome;
  manualReview: { requiredWhen: string[]; outcomesRequiringReview: PolicyOutcome[] };
  approvalRequirements: { requiresApproval: boolean; role: PolicyRole | null };
  overridePermissions: { allowed: boolean; roles: PolicyRole[] };
  appealPermissions: { allowed: boolean; roles: PolicyRole[] };
  auditRetention: string;
  legalReference: string;
  requiresIntegrity: boolean;
  allowedOutcomes: PolicyOutcome[];
}

// ── Evaluation model (immutable, fully explainable) ──────────────────────────

export interface PolicyVersions {
  nationalPolicyEngineVersion: string;
  policyVersion: string;
  ruleSetVersion: string;
  jurisdictionVersion: string;
  correlationEngineVersion: string;
  federationAlgorithmVersion: string;
  matchingEngineVersion: string;
  decisionEngineVersion: string;
  sourceDataFreshness: string | null;
}

export interface ConditionResult {
  id: string; description: string; input: string; operator: ConditionOperator;
  value: PolicyFactValue | PolicyFactValue[] | undefined;
  result: 'passed' | 'failed' | 'skipped';
  reason: string;
}

export interface PolicyHistoryEntry { at: string; actor: string; action: string; from: string; to: string; reason: string; }

export interface PolicyInput {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  facts: Record<string, PolicyFactValue>;
  provenance: CorrelationProvenance;
  integrityOk: boolean;
  dataFreshness: string | null;
  correlationEngineVersion: string;
  inputRefs: string[];
}

export interface PolicyEvaluation {
  evaluationId: string;
  policyId: string;
  policyVersion: string;
  jurisdiction: JurisdictionCode;
  sbNat: SbNatId;
  category: PolicyCategory;
  outcome: PolicyOutcome;
  outcomeReason: string;
  conditionsEvaluated: ConditionResult[];
  conditionsPassed: string[];
  conditionsFailed: string[];
  conditionsSkipped: string[];
  thresholdsUsed: Record<string, number>;
  evidenceAccepted: string[];
  evidenceExcluded: { ref: string; reason: string }[];
  dataFreshness: string | null;
  integrityStatus: boolean;
  inputRefs: string[];
  reviewState: PolicyReviewState;
  appealState: PolicyAppealState | null;
  overrideStatus: PolicyOverrideStatus;
  reviewer: string;
  timestamp: string;
  versions: PolicyVersions;
  provenance: CorrelationProvenance;
  limitations: string[];
  decisionHistory: PolicyHistoryEntry[];
  overrideHistory: PolicyHistoryEntry[];
  appealHistory: PolicyHistoryEntry[];
}

export interface PolicyConflict {
  kind: string;
  detail: string;
  policyIds: string[];
  outcomes: PolicyOutcome[];
  recommendedOutcome: PolicyOutcome;
}

export interface PolicyIntegrityCheck { name: string; passed: boolean; detail: string; }
export interface PolicyIntegrityReport { sbNat: SbNatId; jurisdiction: JurisdictionCode; policyId: string; ok: boolean; checks: PolicyIntegrityCheck[]; reproducible: boolean; }

export interface PolicyDiagnostics {
  jurisdiction: JurisdictionCode | 'all';
  activePolicies: number;
  evaluations: number;
  outcomeCounts: Record<string, number>;
  pendingReviews: number;
  overridden: number;
  appealsOpen: number;
  conflicts: number;
}

// ── Access control (deny-by-default + role enforcement, boundary-enforced) ───

export interface PolicyAccessContext extends AccessContext { roles: PolicyRole[]; }

/** Enforce regulator-plane + jurisdiction sovereignty + the required role. */
export function authorisePolicy(ctx: PolicyAccessContext | undefined, jurisdiction: JurisdictionCode, role: PolicyRole): void {
  authorise(ctx, jurisdiction);                                    // plane + sovereignty (throws AccessDeniedError)
  if (!ctx || !Array.isArray(ctx.roles) || !ctx.roles.includes(role)) {
    throw new AccessDeniedError(`role '${role}' is required for this policy action`);
  }
}

// ── Immutable, append-only policy audit ──────────────────────────────────────

export const POLICY_AUDIT_ACTIONS = [
  'policy-evaluated', 'review-opened', 'review-decision', 'outcome-overridden',
  'appeal-opened', 'appeal-updated', 'appeal-concluded', 'policy-version-changed',
  'policy-retired', 'integrity-failure',
] as const;
export type PolicyAuditAction = (typeof POLICY_AUDIT_ACTIONS)[number];

export interface PolicyAuditRecord {
  auditId: string;
  at: string;
  action: PolicyAuditAction;
  jurisdiction: JurisdictionCode;
  sbNat: SbNatId | null;
  policyId: string;
  policyVersion: string;
  evaluationId: string | null;
  outcome: PolicyOutcome | null;
  reviewer: string;
  reason: string;
  versions: PolicyVersions;
}

/** Append-only policy audit sink (no update/delete surface). */
export interface PolicyAuditSink {
  append(record: PolicyAuditRecord): void;
  list(): readonly PolicyAuditRecord[];
  count(): number;
}

let policyAuditCounter = 0;
export function sealPolicyAudit(input: Omit<PolicyAuditRecord, 'auditId'> & Partial<Pick<PolicyAuditRecord, 'auditId'>>): PolicyAuditRecord {
  return deepFreeze({ ...input, auditId: input.auditId ?? `pol-audit-${++policyAuditCounter}` }) as PolicyAuditRecord;
}

export class InMemoryPolicyAuditSink implements PolicyAuditSink {
  private readonly records: PolicyAuditRecord[] = [];
  append(record: PolicyAuditRecord): void { this.records.push(deepFreeze(record)); }
  list(): readonly PolicyAuditRecord[] { return Object.freeze(this.records.slice()); }
  count(): number { return this.records.length; }
}

// ── Policy schema validation (strict; declarative data only) ─────────────────

export class PolicyValidationError extends Error {
  readonly code = 'policy-invalid';
  constructor(message: string) { super(`invalid policy definition: ${message}`); this.name = 'PolicyValidationError'; }
}

/** Strictly validate a policy definition as declarative data. Throws on any violation. */
export function validatePolicyDefinition(def: PolicyDefinition): void {
  const req = (cond: boolean, msg: string) => { if (!cond) throw new PolicyValidationError(msg); };
  req(!!def && typeof def === 'object', 'not an object');
  req(!!def.policyId, 'policyId is required');
  req(!!def.name, 'name is required');
  req((POLICY_CATEGORIES as readonly string[]).includes(def.category), `unknown category '${def.category}'`);
  req(!!def.policyVersion, 'policyVersion is required');
  req(!!def.ruleSetVersion, 'ruleSetVersion is required');
  req(isIsoDate(def.effectiveDate), 'effectiveDate must be an ISO date');
  req(def.expiryDate === null || isIsoDate(def.expiryDate), 'expiryDate must be null or an ISO date');
  req(Array.isArray(def.conditions), 'conditions must be an array');
  for (const c of def.conditions) {
    req(!!c.id && !!c.input, 'each condition needs an id and input');
    req((CONDITION_OPERATORS as readonly string[]).includes(c.operator), `condition '${c.id}': unknown operator '${c.operator}'`);
    req(typeof (c as unknown) !== 'function' && typeof c.input === 'string', `condition '${c.id}': input must be a fact key`);
    // No executable code permitted anywhere in the schema.
    for (const v of [c.value]) req(typeof v !== 'function', `condition '${c.id}': value must not be executable`);
  }
  req(Array.isArray(def.outcomeRules), 'outcomeRules must be an array');
  const condIds = new Set(def.conditions.map((c) => c.id));
  for (const r of def.outcomeRules) {
    req(!!r.id, 'each outcome rule needs an id');
    req((POLICY_OUTCOMES as readonly string[]).includes(r.outcome), `outcome rule '${r.id}': unknown outcome '${r.outcome}'`);
    for (const need of r.requires) req(condIds.has(need), `outcome rule '${r.id}': references unknown condition '${need}'`);
  }
  req((POLICY_OUTCOMES as readonly string[]).includes(def.defaultOutcome), `unknown defaultOutcome '${def.defaultOutcome}'`);
  req(Array.isArray(def.allowedOutcomes) && def.allowedOutcomes.every((o) => (POLICY_OUTCOMES as readonly string[]).includes(o)), 'allowedOutcomes must be valid outcomes');
}

export function isIsoDate(s: unknown): boolean {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
}

// ── Immutable, versioned, jurisdiction-scoped policy store ───────────────────

export class NationalPolicyStore {
  private readonly byKey = new Map<string, PolicyDefinition>();   // `${policyId}@${version}`
  private readonly activeVersion = new Map<string, string>();     // policyId -> active version

  /** Add a policy version (validated, frozen, status 'draft'). Re-adding an existing version is rejected. */
  add(def: PolicyDefinition): PolicyDefinition {
    validatePolicyDefinition(def);
    const key = `${def.policyId}@${def.policyVersion}`;
    if (this.byKey.has(key)) throw new PolicyValidationError(`policy version already exists: ${key} (create a new version)`);
    const stored = deepFreeze({ ...def, status: 'draft' as PolicyStatus });
    this.byKey.set(key, stored);
    return stored;
  }

  /** Activate a policy version. Auto-retires the prior active version of the same policyId (version replacement). */
  activate(policyId: string, version: string): PolicyDefinition {
    const key = `${policyId}@${version}`;
    const def = this.byKey.get(key);
    if (!def) throw new PolicyValidationError(`unknown policy version: ${key}`);
    const prior = this.activeVersion.get(policyId);
    if (prior && prior !== version) {
      const priorKey = `${policyId}@${prior}`;
      this.byKey.set(priorKey, deepFreeze({ ...this.byKey.get(priorKey)!, status: 'retired' }));
    }
    const active = deepFreeze({ ...def, status: 'active' as PolicyStatus });
    this.byKey.set(key, active);
    this.activeVersion.set(policyId, version);
    return active;
  }

  retire(policyId: string): void {
    const v = this.activeVersion.get(policyId);
    if (!v) return;
    const key = `${policyId}@${v}`;
    this.byKey.set(key, deepFreeze({ ...this.byKey.get(key)!, status: 'retired' }));
    this.activeVersion.delete(policyId);
  }

  get(policyId: string, version: string): PolicyDefinition | undefined { return this.byKey.get(`${policyId}@${version}`); }

  /** The active version of a policy that is effective at `atDate`. */
  getActive(policyId: string, atDate?: string): PolicyDefinition | undefined {
    const v = this.activeVersion.get(policyId);
    if (!v) return undefined;
    const def = this.byKey.get(`${policyId}@${v}`);
    if (!def || def.status !== 'active') return undefined;
    return atDate && !this.effectiveAt(def, atDate) ? undefined : def;
  }

  /** All active, effective policies for a jurisdiction, optionally filtered by category. */
  listActive(jurisdiction: JurisdictionCode, category?: PolicyCategory, atDate?: string): PolicyDefinition[] {
    const out: PolicyDefinition[] = [];
    for (const v of Array.from(this.activeVersion.entries())) {
      const def = this.byKey.get(`${v[0]}@${v[1]}`);
      if (!def || def.status !== 'active' || def.jurisdiction !== jurisdiction) continue;
      if (category && def.category !== category) continue;
      if (atDate && !this.effectiveAt(def, atDate)) continue;
      out.push(def);
    }
    return out.sort((a, b) => a.policyId.localeCompare(b.policyId));
  }

  effectiveAt(def: PolicyDefinition, atDate: string): boolean {
    return def.effectiveDate <= atDate && (def.expiryDate === null || atDate < def.expiryDate);
  }
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}
