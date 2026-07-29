// ─── National Policy Platform Extension — engine (v2.0, ADR-006 · Milestone 3.6)
//
// The deterministic, regulator-plane national policy evaluation engine. It
// consumes authorised, read-only Enterprise Correlation Layer outputs (3.5),
// projects them into explainable FACTS, and evaluates jurisdiction-specific
// POLICY-AS-DATA into versioned, auditable OUTCOMES with full manual-review,
// override and appeal governance. It performs NO matching / decision / SB-NAT
// creation, does NOT modify the Registry, keeps the Correlation Layer read-only,
// and NEVER mutates operator runtime. No ML, no hidden scoring, no hidden
// thresholds — every evaluated condition is visible in the explanation.

import type { JurisdictionCode, SbNatId } from '../types.ts';
import { jurisdictionOfSbNat } from '../identifiers.ts';
import { getJurisdictionProfile } from '../jurisdictionProfiles.ts';
import { FEDERATION_ALGORITHM_VERSION, MATCHING_ENGINE_VERSION, DECISION_ENGINE_VERSION, RULE_SET_VERSION } from '../version.ts';
import {
  type EnterpriseCorrelationLayer, CORRELATION_ENGINE_VERSION, AccessDeniedError,
  type NationalPlayerTwin, type CrossOperatorIntelligence,
  type NationalSelfExclusionView, type CorrelationIntegrityReport,
} from '../correlation/index.ts';
import {
  type PolicyDefinition, type PolicyCondition, type PolicyEvaluation, type PolicyInput,
  type PolicyOutcome, type PolicyVersions, type ConditionResult, type PolicyFactValue,
  type PolicyAccessContext, type PolicyReviewState, type PolicyAppealState,
  type PolicyConflict, type PolicyIntegrityReport, type PolicyIntegrityCheck,
  type PolicyDiagnostics, type PolicyHistoryEntry, type PolicyCategory,
  type PolicyAuditSink, type PolicyAuditAction, type PolicyAuditRecord,
  NationalPolicyStore, InMemoryPolicyAuditSink, sealPolicyAudit, authorisePolicy, deepFreeze,
} from './model.ts';

export const NATIONAL_POLICY_ENGINE_VERSION = '2.0';

export class PolicyEngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`[${code}] ${message}`); this.name = 'PolicyEngineError'; this.code = code; }
}

/** Outcomes that are always permitted regardless of a policy's allowedOutcomes. */
const UNIVERSAL_OUTCOMES: PolicyOutcome[] = ['Insufficient Evidence', 'Data Integrity Failure', 'Policy Conflict Detected'];
/** Deterministic incompatibility matrix for conflict detection (documented, jurisdiction-agnostic). */
const INCOMPATIBLE: [PolicyOutcome, PolicyOutcome][] = [
  ['National Self-Exclusion Confirmed', 'No Action'],
  ['National Self-Exclusion Confirmed', 'Continue Monitoring'],
  ['National Cooling-Off Recommended', 'No Action'],
  ['Cross-Operator Escalation Required', 'No Action'],
];

export interface PolicyEngineOptions {
  correlationLayer: EnterpriseCorrelationLayer;
  store: NationalPolicyStore;
  auditSink?: PolicyAuditSink;
  now?: () => string;
}

function containsLikelyPii(s: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s) || /\d{7,}/.test(s);
}

export class NationalPolicyEngine {
  private readonly correlationLayer: EnterpriseCorrelationLayer;
  private readonly store: NationalPolicyStore;
  private readonly auditSink: PolicyAuditSink;
  private readonly now: () => string;
  private evalCounter = 0;

  constructor(opts: PolicyEngineOptions) {
    this.correlationLayer = opts.correlationLayer;
    this.store = opts.store;
    this.auditSink = opts.auditSink ?? new InMemoryPolicyAuditSink();
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  auditTrail(): readonly PolicyAuditRecord[] { return this.auditSink.list(); }

  // ── Policy input (read-only, from the Correlation Layer) ────────────────────

  /** Build the read-only, reference-based policy input by projecting Correlation Layer outputs into facts. */
  buildPolicyInput(ctx: PolicyAccessContext, sbNat: SbNatId, asOf?: string): PolicyInput {
    const at = asOf ?? this.now();
    const twin = this.correlationLayer.getNationalPlayerTwin(ctx, sbNat);
    const intel = this.correlationLayer.getCrossOperatorIntelligence(ctx, sbNat);
    const se = this.correlationLayer.getNationalSelfExclusionView(ctx, sbNat);
    const integrity = this.correlationLayer.verifyCorrelationIntegrity(ctx, sbNat, { asOf: at });
    return {
      sbNat, jurisdiction: twin.jurisdiction,
      facts: projectFacts(twin, intel, se, integrity),
      provenance: twin.provenance,
      integrityOk: integrity.ok,
      dataFreshness: twin.dataFreshness,
      correlationEngineVersion: twin.correlationEngineVersion,
      inputRefs: ['national-player-twin', 'cross-operator-intelligence', 'national-self-exclusion-view', 'correlation-integrity'],
    };
  }

  // ── Evaluation ──────────────────────────────────────────────────────────────

  /** Evaluate one active policy for an SB-NAT (fetches its own read-only input). */
  evaluatePolicy(ctx: PolicyAccessContext, sbNat: SbNatId, policyId: string, asOf?: string): PolicyEvaluation {
    const at = asOf ?? this.now();
    const policy = this.store.getActive(policyId, at);
    if (!policy) throw new PolicyEngineError('policy-not-active', `no active policy '${policyId}' effective at ${at}`);
    const input = this.buildPolicyInput(ctx, sbNat, at);
    return this.evaluate(ctx, policy, input, at);
  }

  /** Evaluate every active policy in a category for an SB-NAT. */
  evaluateCategory(ctx: PolicyAccessContext, sbNat: SbNatId, category: PolicyCategory, asOf?: string): PolicyEvaluation[] {
    const at = asOf ?? this.now();
    const j = jurisdictionOfSbNat(sbNat);
    if (!j) throw new PolicyEngineError('malformed-sbnat', `malformed SB-NAT '${sbNat}'`);
    const input = this.buildPolicyInput(ctx, sbNat, at);
    return this.store.listActive(j, category, at).map((p) => this.evaluate(ctx, p, input, at));
  }

  /** Core deterministic evaluation of a policy against a policy input. */
  evaluate(ctx: PolicyAccessContext, policy: PolicyDefinition, input: PolicyInput, asOf?: string): PolicyEvaluation {
    authorisePolicy(ctx, policy.jurisdiction, 'evaluator');
    const sbNatJur = jurisdictionOfSbNat(input.sbNat);
    if (policy.jurisdiction !== input.jurisdiction || policy.jurisdiction !== sbNatJur) {
      throw new PolicyEngineError('jurisdiction-mismatch', `policy ${policy.jurisdiction} cannot evaluate ${sbNatJur ?? '?'} identity ${input.sbNat}`);
    }
    const at = asOf ?? this.now();

    // Deterministic condition evaluation (fully explainable).
    const results: ConditionResult[] = policy.conditions.map((c) => this.evalCondition(c, input.facts));
    const passed = results.filter((r) => r.result === 'passed').map((r) => r.id);
    const failed = results.filter((r) => r.result === 'failed').map((r) => r.id);
    const skipped = results.filter((r) => r.result === 'skipped').map((r) => r.id);
    const passedSet = new Set(passed);

    // Outcome determination (documented precedence; no hidden logic).
    const missingRequired = policy.requiredInputs.filter((k) => !(k in input.facts) || input.facts[k] === null);
    let outcome: PolicyOutcome;
    let reason: string;
    if (missingRequired.length > 0) {
      outcome = 'Insufficient Evidence';
      reason = `Insufficient evidence: required input(s) unavailable [${missingRequired.join(', ')}].`;
    } else if (policy.requiresIntegrity && !input.integrityOk) {
      outcome = 'Data Integrity Failure';
      reason = 'Data integrity failure: the correlation integrity check did not pass.';
    } else {
      const rule = policy.outcomeRules.find((r) => r.requires.every((id) => passedSet.has(id)));
      if (rule) { outcome = rule.outcome; reason = rule.reason; }
      else { outcome = policy.defaultOutcome; reason = `Default outcome: no outcome rule matched (${passed.length} condition(s) passed).`; }
    }

    // Manual-review determination.
    const reviewByCondition = policy.manualReview.requiredWhen.some((id) => passedSet.has(id));
    const reviewByOutcome = policy.manualReview.outcomesRequiringReview.includes(outcome);
    const reviewState: PolicyReviewState = (reviewByCondition || reviewByOutcome) ? 'pending-review' : 'not-required';

    const evidenceAccepted = Array.from(new Set(results.filter((r) => r.result !== 'skipped').map((r) => r.input))).sort();
    const evidenceExcluded = [
      ...input.provenance.excludedSources.map((e) => ({ ref: e.ref, reason: e.reason })),
      ...results.filter((r) => r.result === 'skipped').map((r) => ({ ref: `condition:${r.id}`, reason: r.reason })),
    ];
    const versions = this.versions(policy, input);
    const evaluationId = `eval:${policy.policyId}@${policy.policyVersion}:${input.sbNat}:${++this.evalCounter}`;

    const evaluation: PolicyEvaluation = deepFreeze({
      evaluationId, policyId: policy.policyId, policyVersion: policy.policyVersion,
      jurisdiction: policy.jurisdiction, sbNat: input.sbNat, category: policy.category,
      outcome, outcomeReason: reason,
      conditionsEvaluated: results, conditionsPassed: passed, conditionsFailed: failed, conditionsSkipped: skipped,
      thresholdsUsed: { ...policy.thresholds },
      evidenceAccepted, evidenceExcluded,
      dataFreshness: input.dataFreshness, integrityStatus: input.integrityOk,
      inputRefs: input.inputRefs.slice(),
      reviewState, appealState: null, overrideStatus: 'none',
      reviewer: 'system', timestamp: at, versions,
      provenance: input.provenance,
      limitations: [
        'Regulator-plane recommendation/decision; it does not mutate operator runtime.',
        ...(input.integrityOk ? [] : ['Correlation integrity did not pass; outcome reflects a data-integrity failure.']),
      ],
      decisionHistory: [{ at, actor: 'system', action: 'evaluate', from: '', to: outcome, reason }],
      overrideHistory: [], appealHistory: [],
    });

    this.audit(outcome === 'Data Integrity Failure' ? 'integrity-failure' : 'policy-evaluated', evaluation, 'system', reason);
    return evaluation;
  }

  // ── Governance transitions (immutable; new evaluation + audit each time) ────

  review(ctx: PolicyAccessContext, ev: PolicyEvaluation, action: 'open' | 'approve' | 'reject' | 'return' | 'escalate' | 'close', reviewer: string, reason: string): PolicyEvaluation {
    authorisePolicy(ctx, ev.jurisdiction, 'reviewer');
    if (ev.reviewState === 'not-required') throw new PolicyEngineError('review-not-applicable', 'this evaluation does not require review');
    const map: Record<string, PolicyReviewState> = { open: 'under-review', approve: 'approved', reject: 'rejected', return: 'returned', escalate: 'escalated', close: 'closed' };
    const to = map[action];
    if (!to) throw new PolicyEngineError('invalid-review-action', `invalid review action '${action}'`);
    const next = this.transition(ev, { reviewState: to }, { action: `review:${action}`, from: ev.reviewState, to, actor: reviewer, reason });
    this.audit('review-decision', next, reviewer, reason);
    return next;
  }

  override(ctx: PolicyAccessContext, ev: PolicyEvaluation, newOutcome: PolicyOutcome, reviewer: string, authority: string, reason: string, supportingRef: string): PolicyEvaluation {
    authorisePolicy(ctx, ev.jurisdiction, 'override-authority');
    const policy = this.store.get(ev.policyId, ev.policyVersion);
    if (!policy || !policy.overridePermissions.allowed) throw new PolicyEngineError('override-not-permitted', `policy ${ev.policyId} does not permit overrides`);
    const entry: PolicyHistoryEntry = { at: this.now(), actor: `${reviewer} (${authority})`, action: 'override', from: ev.outcome, to: newOutcome, reason: `${reason} [ref:${supportingRef}]` };
    const next = deepFreeze({
      ...ev, outcome: newOutcome, overrideStatus: 'overridden' as const,
      decisionHistory: [...ev.decisionHistory, entry],
      overrideHistory: [...ev.overrideHistory, entry],
    });
    this.audit('outcome-overridden', next, reviewer, reason);
    return next;
  }

  appeal(ctx: PolicyAccessContext, ev: PolicyEvaluation, action: 'open' | 'review' | 'uphold' | 'dismiss' | 'return' | 'close', reviewer: string, reason: string): PolicyEvaluation {
    authorisePolicy(ctx, ev.jurisdiction, 'appeal-reviewer');
    const policy = this.store.get(ev.policyId, ev.policyVersion);
    if (!policy || !policy.appealPermissions.allowed) throw new PolicyEngineError('appeal-not-permitted', `policy ${ev.policyId} does not permit appeals`);
    const map: Record<string, PolicyAppealState> = { open: 'open', review: 'under-review', uphold: 'upheld', dismiss: 'dismissed', return: 'returned', close: 'closed' };
    const to = map[action];
    if (!to) throw new PolicyEngineError('invalid-appeal-action', `invalid appeal action '${action}'`);
    const entry: PolicyHistoryEntry = { at: this.now(), actor: reviewer, action: `appeal:${action}`, from: String(ev.appealState), to, reason };
    const next = deepFreeze({ ...ev, appealState: to, decisionHistory: [...ev.decisionHistory, entry], appealHistory: [...ev.appealHistory, entry] });
    this.audit(action === 'open' ? 'appeal-opened' : (to === 'upheld' || to === 'dismissed' || to === 'closed' ? 'appeal-concluded' : 'appeal-updated'), next, reviewer, reason);
    return next;
  }

  // ── Conflict detection (never silently resolved) ────────────────────────────

  detectConflicts(evaluations: PolicyEvaluation[]): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];
    // Duplicate active policy versions applying to the same case (same policyId).
    const byPolicy = new Map<string, Set<string>>();
    for (const e of evaluations) {
      if (!byPolicy.has(e.policyId)) byPolicy.set(e.policyId, new Set());
      byPolicy.get(e.policyId)!.add(e.policyVersion);
    }
    for (const [pid, versions] of Array.from(byPolicy.entries())) {
      if (versions.size > 1) conflicts.push({ kind: 'duplicate-active-policy', detail: `policy ${pid} evaluated under multiple versions [${Array.from(versions).sort().join(', ')}]`, policyIds: [pid], outcomes: [], recommendedOutcome: 'Policy Conflict Detected' });
    }
    // Jurisdiction mismatch.
    for (const e of evaluations) {
      if (jurisdictionOfSbNat(e.sbNat) !== e.jurisdiction) conflicts.push({ kind: 'jurisdiction-mismatch', detail: `evaluation ${e.evaluationId} jurisdiction ${e.jurisdiction} ≠ SB-NAT jurisdiction`, policyIds: [e.policyId], outcomes: [e.outcome], recommendedOutcome: 'Policy Conflict Detected' });
    }
    // Stale or incomplete data.
    for (const e of evaluations) {
      if (!e.integrityStatus || e.dataFreshness === null) conflicts.push({ kind: 'stale-or-incomplete-data', detail: `evaluation ${e.evaluationId} rests on incomplete/stale data (integrity=${e.integrityStatus}, freshness=${e.dataFreshness})`, policyIds: [e.policyId], outcomes: [e.outcome], recommendedOutcome: 'Policy Conflict Detected' });
    }
    // Incompatible outcomes across policies for the same SB-NAT.
    for (const [a, b] of INCOMPATIBLE) {
      const ea = evaluations.find((e) => e.outcome === a);
      const eb = evaluations.find((e) => e.outcome === b);
      if (ea && eb) conflicts.push({ kind: 'incompatible-outcomes', detail: `'${a}' (${ea.policyId}) is incompatible with '${b}' (${eb.policyId})`, policyIds: [ea.policyId, eb.policyId], outcomes: [a, b], recommendedOutcome: 'Policy Conflict Detected' });
    }
    return conflicts;
  }

  // ── Integrity verifier ──────────────────────────────────────────────────────

  verifyPolicyIntegrity(ctx: PolicyAccessContext, ev: PolicyEvaluation): PolicyIntegrityReport {
    authorisePolicy(ctx, ev.jurisdiction, 'evaluator');
    const checks: PolicyIntegrityCheck[] = [];
    const push = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });
    const policy = this.store.get(ev.policyId, ev.policyVersion);

    push('policy-exists', !!policy, policy ? 'policy version found' : 'policy version not found');
    push('policy-active-for-date', !!policy && this.store.effectiveAt(policy, ev.timestamp), 'policy effective at evaluation timestamp');
    push('policy-jurisdiction-matches-sbnat', !!policy && policy.jurisdiction === jurisdictionOfSbNat(ev.sbNat), 'policy jurisdiction matches SB-NAT');
    push('required-inputs-exist', ev.outcome !== 'Insufficient Evidence', ev.outcome === 'Insufficient Evidence' ? 'required inputs were unavailable' : 'required inputs were available');
    push('input-integrity-passed', ev.integrityStatus, `correlation integrity = ${ev.integrityStatus}`);
    push('provenance-complete', ev.provenance.federationDecisionRefs.length > 0, `${ev.provenance.federationDecisionRefs.length} decision reference(s)`);
    push('policy-version-valid', !!policy && policy.policyVersion === ev.policyVersion, 'policy version stamp matches');
    push('rule-set-version-valid', !!policy && policy.ruleSetVersion === ev.versions.ruleSetVersion, 'rule-set version stamp matches');
    push('outcome-allowed', !!policy && (policy.allowedOutcomes.includes(ev.outcome) || UNIVERSAL_OUTCOMES.includes(ev.outcome)), `outcome '${ev.outcome}' permitted by policy`);
    push('no-plaintext-pii', !containsLikelyPii(JSON.stringify(ev)), 'no PII patterns in the evaluation');
    push('audit-record-exists', this.auditSink.list().some((a) => a.evaluationId === ev.evaluationId), 'an audit record references this evaluation');

    // Deterministic + historical reproduction (re-evaluate at the original timestamp).
    let reproducible = false;
    if (policy) {
      try {
        const input = this.buildPolicyInput(ctx, ev.sbNat, ev.timestamp);
        const before = JSON.stringify(this.correlationLayer.getNationalPlayerTwin(ctx, ev.sbNat));
        const a = this.reevaluatePure(policy, input, ev.timestamp);
        const b = this.reevaluatePure(policy, input, ev.timestamp);
        const after = JSON.stringify(this.correlationLayer.getNationalPlayerTwin(ctx, ev.sbNat));
        push('deterministic', a.outcome === b.outcome && JSON.stringify(a.conditionsEvaluated) === JSON.stringify(b.conditionsEvaluated), 'repeated evaluation is identical');
        push('no-runtime-mutation', before === after, 'no observable state changed by evaluation');
        reproducible = a.outcome === ev.outcome;
        push('historical-reproduction', reproducible, reproducible ? 'outcome reproduces from original references + versions' : `reproduced '${a.outcome}' ≠ recorded '${ev.outcome}'`);
      } catch (e) {
        push('deterministic', false, `re-evaluation failed: ${(e as Error).message}`);
        push('no-runtime-mutation', true, 'no mutation (re-evaluation aborted)');
        push('historical-reproduction', false, 'could not reproduce');
      }
    } else {
      push('deterministic', false, 'policy missing'); push('no-runtime-mutation', true, 'n/a'); push('historical-reproduction', false, 'policy missing');
    }

    return deepFreeze({ sbNat: ev.sbNat, jurisdiction: ev.jurisdiction, policyId: ev.policyId, ok: checks.every((c) => c.passed), checks, reproducible });
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────────

  diagnostics(jurisdiction: JurisdictionCode | undefined, evaluations: PolicyEvaluation[], conflicts: PolicyConflict[] = []): PolicyDiagnostics {
    const scoped = jurisdiction ? evaluations.filter((e) => e.jurisdiction === jurisdiction) : evaluations;
    const outcomeCounts: Record<string, number> = {};
    for (const e of scoped) outcomeCounts[e.outcome] = (outcomeCounts[e.outcome] ?? 0) + 1;
    return {
      jurisdiction: jurisdiction ?? 'all',
      activePolicies: jurisdiction ? this.store.listActive(jurisdiction).length : 0,
      evaluations: scoped.length,
      outcomeCounts,
      pendingReviews: scoped.filter((e) => e.reviewState === 'pending-review' || e.reviewState === 'under-review').length,
      overridden: scoped.filter((e) => e.overrideStatus === 'overridden').length,
      appealsOpen: scoped.filter((e) => e.appealState === 'open' || e.appealState === 'under-review').length,
      conflicts: conflicts.length,
    };
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /** Pure re-evaluation (no audit, no authorisation) for integrity reproduction. */
  private reevaluatePure(policy: PolicyDefinition, input: PolicyInput, at: string): { outcome: PolicyOutcome; conditionsEvaluated: ConditionResult[] } {
    const results = policy.conditions.map((c) => this.evalCondition(c, input.facts));
    const passedSet = new Set(results.filter((r) => r.result === 'passed').map((r) => r.id));
    const missingRequired = policy.requiredInputs.filter((k) => !(k in input.facts) || input.facts[k] === null);
    let outcome: PolicyOutcome;
    if (missingRequired.length > 0) outcome = 'Insufficient Evidence';
    else if (policy.requiresIntegrity && !input.integrityOk) outcome = 'Data Integrity Failure';
    else { const rule = policy.outcomeRules.find((r) => r.requires.every((id) => passedSet.has(id))); outcome = rule ? rule.outcome : policy.defaultOutcome; }
    return { outcome, conditionsEvaluated: results };
  }

  private evalCondition(c: PolicyCondition, facts: Record<string, PolicyFactValue>): ConditionResult {
    const base = { id: c.id, description: c.description, input: c.input, operator: c.operator, value: c.value };
    if (!(c.input in facts)) return { ...base, result: 'skipped', reason: `input '${c.input}' unavailable` };
    const fact = facts[c.input];
    const numericOps = ['gt', 'gte', 'lt', 'lte'];
    if (numericOps.includes(c.operator) && typeof fact !== 'number') return { ...base, result: 'skipped', reason: `input '${c.input}' has no numeric value` };
    let passed: boolean;
    switch (c.operator) {
      case 'exists': passed = fact !== null && fact !== undefined; break;
      case 'isTrue': passed = fact === true; break;
      case 'isFalse': passed = fact === false; break;
      case 'eq': passed = fact === c.value; break;
      case 'ne': passed = fact !== c.value; break;
      case 'gt': passed = (fact as number) > (c.value as number); break;
      case 'gte': passed = (fact as number) >= (c.value as number); break;
      case 'lt': passed = (fact as number) < (c.value as number); break;
      case 'lte': passed = (fact as number) <= (c.value as number); break;
      case 'in': passed = Array.isArray(c.value) && (c.value as PolicyFactValue[]).includes(fact); break;
      case 'nin': passed = Array.isArray(c.value) && !(c.value as PolicyFactValue[]).includes(fact); break;
      default: passed = false;
    }
    return { ...base, result: passed ? 'passed' : 'failed', reason: `${c.input} (${JSON.stringify(fact)}) ${c.operator} ${JSON.stringify(c.value)} → ${passed}` };
  }

  private versions(policy: PolicyDefinition, input: PolicyInput): PolicyVersions {
    return {
      nationalPolicyEngineVersion: NATIONAL_POLICY_ENGINE_VERSION,
      policyVersion: policy.policyVersion,
      ruleSetVersion: policy.ruleSetVersion,
      jurisdictionVersion: getJurisdictionProfile(policy.jurisdiction).jurisdictionVersion,
      correlationEngineVersion: input.correlationEngineVersion || CORRELATION_ENGINE_VERSION,
      federationAlgorithmVersion: FEDERATION_ALGORITHM_VERSION,
      matchingEngineVersion: MATCHING_ENGINE_VERSION,
      decisionEngineVersion: DECISION_ENGINE_VERSION,
      sourceDataFreshness: input.dataFreshness,
    };
  }

  private transition(ev: PolicyEvaluation, patch: Partial<PolicyEvaluation>, h: { action: string; from: string; to: string; actor: string; reason: string }): PolicyEvaluation {
    const entry: PolicyHistoryEntry = { at: this.now(), actor: h.actor, action: h.action, from: h.from, to: h.to, reason: h.reason };
    return deepFreeze({ ...ev, ...patch, decisionHistory: [...ev.decisionHistory, entry] });
  }

  private audit(action: PolicyAuditAction, ev: PolicyEvaluation, reviewer: string, reason: string): void {
    this.auditSink.append(sealPolicyAudit({
      at: this.now(), action, jurisdiction: ev.jurisdiction, sbNat: ev.sbNat,
      policyId: ev.policyId, policyVersion: ev.policyVersion, evaluationId: ev.evaluationId,
      outcome: ev.outcome, reviewer, reason, versions: ev.versions,
    }));
  }
}

/** Deterministic projection of Correlation Layer outputs into flat policy facts (no PII). */
export function projectFacts(twin: NationalPlayerTwin, intel: CrossOperatorIntelligence, se: NationalSelfExclusionView, integrity: CorrelationIntegrityReport): Record<string, PolicyFactValue> {
  return {
    participatingOperators: intel.participatingOperatorCount,
    activityFrequency: intel.activityFrequency,
    operatorSwitches: intel.operatorSwitches.length,
    currentRiskTier: twin.wellbeingSummary.currentRiskTier,
    riskEscalating: intel.riskEscalating,
    repeatedHarmIndicators: intel.repeatedHarmIndicators,
    repeatedInterventionPatterns: intel.repeatedInterventionPatterns,
    concurrentActivityWindows: intel.concurrentActivityWindows.length,
    selfExclusionConflicts: intel.selfExclusionConflicts.length,
    coolingOffConflicts: intel.coolingOffConflicts.length,
    investigationIndicators: intel.investigationIndicators,
    behaviourEscalation: intel.behaviourEscalation,
    activeSelfExclusions: se.activeExclusions.length,
    historicalSelfExclusions: se.historicalExclusions.length,
    coolingOffPeriods: se.coolingOffPeriods.length,
    selfExclusionConflictingActivity: se.conflictingActivity.length,
    interventionCount: twin.interventionHistory.length,
    correlationIntegrityOk: integrity.ok,
    provenanceComplete: twin.provenance.federationDecisionRefs.length > 0,
  };
}

// re-export the access error so callers can catch a single symbol
export { AccessDeniedError };
