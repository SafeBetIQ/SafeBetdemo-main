// ─── Federation Decision Engine (v2.0, ADR-006 · Milestone 3.3) ──────────────
//
// The GOVERNANCE AUTHORITY. It consumes candidate matches from the Identity
// Matching Engine and decides — by CONFIGURABLE POLICY — whether each becomes
// auto-approved, requires manual review, or is rejected. It provides the manual
// review, appeal and override workflows and an immutable, explainable, versioned
// decision + audit trail. It performs NO identity matching, and it NEVER creates
// an SB-NAT or merges identities — that is the SB-NAT Registry (Milestone 3.4).
// Deterministic: no probabilistic/AI behaviour; no hidden logic.

import type {
  FederationCandidate, FederationDecision, DecisionOutcome, DecisionRuleResult,
  DecisionDiagnostics, ConfidenceTier, ReviewState, AppealState, FederationDecisionAudit,
} from './types.ts';
import type { JurisdictionProfile } from './jurisdictionProfiles.ts';
import { buildDecisionVersionStamp, buildVersionStamp, DECISION_ENGINE_VERSION } from './version.ts';
import { sealAuditRecord } from './audit.ts';

export interface DecisionResult { decision: FederationDecision; audit: FederationDecisionAudit; }

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}

export class FederationDecisionEngine {
  private readonly now: () => string;
  constructor(now: () => string = () => new Date().toISOString()) {
    this.now = now;
  }

  /** Decide a single candidate by the jurisdiction's decision policy (data, not code). */
  decide(profile: JurisdictionProfile, candidate: FederationCandidate): DecisionResult {
    const p = profile.decision;
    const matched = candidate.evidenceUsed;
    const matchedCount = matched.length;
    const score = candidate.confidenceScore;
    const allSoft = matchedCount > 0 && matched.every((e) => e.strength === 'soft');

    // Deterministic policy rule evaluation (explainable).
    const rMinEvidence: DecisionRuleResult = { ruleId: 'DEC-MIN-EVIDENCE', description: `at least ${p.minMatchedAttributes} matched attribute(s)`, passed: matchedCount >= p.minMatchedAttributes };
    const rReviewFloor: DecisionRuleResult = { ruleId: 'DEC-REVIEW-FLOOR', description: `confidence ≥ ${p.manualReviewMinScore}`, passed: score >= p.manualReviewMinScore };
    const rAutoThreshold: DecisionRuleResult = { ruleId: 'DEC-AUTO-THRESHOLD', description: `confidence ≥ ${p.autoApproveMinScore}`, passed: score >= p.autoApproveMinScore };
    const rNotSoftOnly: DecisionRuleResult = { ruleId: 'DEC-NOT-SOFT-ONLY', description: 'not exclusively soft-strength evidence', passed: !(p.mandatoryReviewIfOnlySoft && allSoft) };
    const rulesEvaluated = [rMinEvidence, rReviewFloor, rAutoThreshold, rNotSoftOnly];

    let outcome: DecisionOutcome;
    let reason: string;
    if (!rMinEvidence.passed || !rReviewFloor.passed) {
      outcome = 'rejected';
      reason = !rMinEvidence.passed
        ? `Rejected: minimum evidence not met (${matchedCount} matched < ${p.minMatchedAttributes} required).`
        : `Rejected: confidence ${score} is below the review floor ${p.manualReviewMinScore}.`;
    } else if (rAutoThreshold.passed && rNotSoftOnly.passed) {
      outcome = 'auto-approved';
      reason = `Automatically approved: confidence ${score} meets the auto-approval threshold ${p.autoApproveMinScore} with sufficient, non-soft-only evidence.`;
    } else {
      outcome = 'manual-review';
      reason = rAutoThreshold.passed
        ? `Requires manual review: evidence is exclusively soft-strength (mandatory review).`
        : `Requires manual review: confidence ${score} is below the auto-approval threshold ${p.autoApproveMinScore}.`;
    }

    const rulesPassed = rulesEvaluated.filter((r) => r.passed).map((r) => r.ruleId);
    const rulesFailed = rulesEvaluated.filter((r) => !r.passed).map((r) => r.ruleId);
    const tier = this.tierFor(outcome, score, profile);
    const at = this.now();

    const decision: FederationDecision = deepFreeze({
      decisionId: `dec:${candidate.candidateId}:${DECISION_ENGINE_VERSION}`,
      candidateId: candidate.candidateId,
      jurisdiction: candidate.jurisdiction,
      sbPlrA: candidate.sbPlrA, sbPlrB: candidate.sbPlrB, casinoA: candidate.casinoA, casinoB: candidate.casinoB,
      outcome, reason, confidenceScore: score,
      rulesEvaluated, rulesPassed, rulesFailed,
      evidenceAccepted: candidate.evidenceUsed,
      evidenceRejected: candidate.evidenceNotMatched,
      versions: buildDecisionVersionStamp(profile),
      timestamp: at, reviewer: 'system',
      reviewState: outcome === 'manual-review' ? 'pending-review' : null,
      appealState: null,
      overrideStatus: 'none',
      decisionHistory: [{ at, actor: 'system', action: 'decide', from: '', to: outcome, reason }],
      overrideHistory: [], appealHistory: [],
    });

    const audit = sealAuditRecord({
      jurisdiction: candidate.jurisdiction, subjectSbNat: null,
      affectedSbPlr: [candidate.sbPlrA, candidate.sbPlrB],
      evidenceUsed: candidate.evidenceUsed, evidenceIgnored: candidate.evidenceNotMatched,
      matchingRules: candidate.matchingRulesApplied, decisionRule: `${outcome} (${rulesFailed.join(',') || 'all-rules-passed'})`,
      confidence: { tier, score }, versions: buildVersionStamp(profile),
      reviewer: 'system', overrideHistory: [], appealHistory: [], timestamp: at,
    });
    return { decision, audit };
  }

  /** Manual-review transition (governance object only; no UI). Returns a NEW immutable decision + audit. */
  applyReview(decision: FederationDecision, action: 'approve' | 'reject' | 'return' | 'escalate', reviewer: string, reason: string): DecisionResult {
    if (decision.outcome !== 'manual-review') throw new Error('review applies only to manual-review decisions');
    const map: Record<string, ReviewState> = { approve: 'approved', reject: 'rejected', return: 'returned', escalate: 'escalated' };
    const to = map[action];
    if (!to) throw new Error(`invalid review action '${action}'`);
    return this.transition(decision, { reviewState: to }, { action: `review:${action}`, from: String(decision.reviewState), to, reviewer, reason }, decision.jurisdiction);
  }

  /** Regulator override (never deletes history; records original + new). */
  applyOverride(decision: FederationDecision, newOutcome: DecisionOutcome, reviewer: string, justification: string): DecisionResult {
    const patch = { outcome: newOutcome, overrideStatus: 'overridden' as const };
    const res = this.transition(decision, patch, { action: 'override', from: decision.outcome, to: newOutcome, reviewer, reason: justification }, decision.jurisdiction, true);
    return res;
  }

  /** Open an appeal against a decision (governance object only). */
  openAppeal(decision: FederationDecision, reviewer: string, reason: string): DecisionResult {
    return this.transition(decision, { appealState: 'open' }, { action: 'appeal:open', from: String(decision.appealState), to: 'open', reviewer, reason }, decision.jurisdiction, false, true);
  }

  /** Progress an appeal through its states. */
  progressAppeal(decision: FederationDecision, action: 'review' | 'uphold' | 'dismiss' | 'close', reviewer: string, reason: string): DecisionResult {
    const map: Record<string, AppealState> = { review: 'under-review', uphold: 'upheld', dismiss: 'dismissed', close: 'closed' };
    const to = map[action];
    if (!to) throw new Error(`invalid appeal action '${action}'`);
    return this.transition(decision, { appealState: to }, { action: `appeal:${action}`, from: String(decision.appealState), to, reviewer, reason }, decision.jurisdiction, false, true);
  }

  /** Diagnostics over a batch of already-made decisions. */
  diagnose(jurisdiction: FederationDecision['jurisdiction'], decisions: FederationDecision[]): DecisionDiagnostics {
    return {
      jurisdiction,
      candidates: decisions.length,
      autoApproved: decisions.filter((d) => d.outcome === 'auto-approved').length,
      manualReview: decisions.filter((d) => d.outcome === 'manual-review').length,
      rejected: decisions.filter((d) => d.outcome === 'rejected').length,
    };
  }

  // ── internals ───────────────────────────────────────────────────────────────
  private tierFor(outcome: DecisionOutcome, score: number, profile: JurisdictionProfile): ConfidenceTier {
    if (outcome === 'auto-approved') return 'confirmed';
    if (outcome === 'rejected') return 'rejected';
    return score >= profile.thresholds.probable ? 'probable' : 'possible';
  }

  private transition(
    decision: FederationDecision,
    patch: Partial<FederationDecision>,
    history: { action: string; from: string; to: string; reviewer: string; reason: string },
    jurisdiction: FederationDecision['jurisdiction'],
    isOverride = false, isAppeal = false,
  ): DecisionResult {
    const at = this.now();
    const entry = { at, actor: history.reviewer, action: history.action, from: history.from, to: history.to, reason: history.reason };
    const next: FederationDecision = deepFreeze({
      ...decision, ...patch,
      decisionHistory: [...decision.decisionHistory, entry],
      overrideHistory: isOverride ? [...decision.overrideHistory, entry] : decision.overrideHistory.slice(),
      appealHistory: isAppeal ? [...decision.appealHistory, entry] : decision.appealHistory.slice(),
    });
    const audit = sealAuditRecord({
      jurisdiction, subjectSbNat: null, affectedSbPlr: [decision.sbPlrA, decision.sbPlrB],
      evidenceUsed: decision.evidenceAccepted, evidenceIgnored: decision.evidenceRejected,
      matchingRules: [], decisionRule: `${history.action}:${history.from}->${history.to}`,
      confidence: { tier: this.tierFor(next.outcome, next.confidenceScore, { thresholds: { probable: 0.6 } } as JurisdictionProfile), score: next.confidenceScore },
      versions: { federationAlgorithmVersion: next.versions.federationAlgorithmVersion, matchingPolicyVersion: next.versions.matchingPolicyVersion, jurisdictionVersion: next.versions.jurisdictionVersion, decisionEngineVersion: next.versions.decisionEngineVersion, ruleSetVersion: next.versions.ruleSetVersion },
      reviewer: history.reviewer, overrideHistory: isOverride ? [{ at, actor: history.reviewer, from: history.from, to: history.to, reason: history.reason }] : [], appealHistory: isAppeal ? [{ at, actor: history.reviewer, outcome: history.to, reason: history.reason }] : [], timestamp: at,
    });
    return { decision: next, audit };
  }
}

/** Convenience: an approved candidate = auto-approved, or manual-review that a human approved. */
export function isApprovedDecision(d: FederationDecision): boolean {
  return d.outcome === 'auto-approved' || (d.outcome === 'manual-review' && d.reviewState === 'approved');
}
