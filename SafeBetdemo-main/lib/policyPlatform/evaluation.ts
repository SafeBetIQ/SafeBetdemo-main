// ─── Policy evaluation lifecycle (Phase 3.6) ─────────────────────────────────
//
// ONE pass over ONE casino's enriched twin:
//
//   select applicable rules (enabled ∧ jurisdiction ∧ operator)
//     → for each runtime subject, evaluate each rule's condition
//     → emit decisions (advice with provenance), priority-ordered
//
// Evaluation is PURE: it reads the twin, compares, and returns decisions.
// It mutates nothing, enriches nothing, persists nothing, executes nothing.

import type { CasinoDigitalTwin } from '../digitalTwin/index.ts';
import { evaluateCondition, resolvePath } from './conditions.ts';
import { casinoFacts, factsFor } from './facts.ts';
import {
  byPriority,
  type DecisionSet, type DecisionSubject, type PolicyDecision, type PolicyRule,
} from './model.ts';

export interface EvaluationContext {
  /** Jurisdiction the casino operates under, e.g. 'ZA'. */
  jurisdiction: string;
}

function toDecision(
  rule: PolicyRule,
  subject: DecisionSubject,
  facts: Record<string, unknown>,
  evaluatedAt: string,
): PolicyDecision {
  // Confidence is READ from the intelligence the rule names — never computed.
  let confidence = 1;
  if (rule.confidenceFrom) {
    const value = resolvePath(facts, rule.confidenceFrom);
    if (typeof value === 'number' && Number.isFinite(value)) confidence = value;
  }
  return {
    decisionId: crypto.randomUUID(),
    policyId: rule.policyId,
    scope: rule.scope,
    jurisdiction: rule.jurisdiction ?? null,
    subject,
    action: rule.action,
    priority: rule.priority,
    reason: rule.reason,
    policyReference: rule.policyReference,
    confidence,
    executionRequired: rule.executionRequired,
    evaluatedAt,
  };
}

/** Evaluate a rule set against the enriched twin. */
export function evaluateRules(
  rules: PolicyRule[],
  twin: CasinoDigitalTwin,
  ctx: EvaluationContext,
): DecisionSet {
  const evaluatedAt = new Date().toISOString();
  const applicable = rules.filter(r =>
    r.enabled !== false
    && (!r.jurisdiction || r.jurisdiction === ctx.jurisdiction)
    && (!r.casinoId || r.casinoId === twin.casinoId));

  const decisions: PolicyDecision[] = [];
  let subjects = 0;

  const evaluateSubject = (subject: DecisionSubject, facts: Record<string, unknown>) => {
    subjects += 1;
    applicable.forEach(rule => {
      if (rule.appliesTo !== subject.kind) return;
      if (evaluateCondition(rule.when, facts)) {
        decisions.push(toDecision(rule, subject, facts, evaluatedAt));
      }
    });
  };

  const casinoId = twin.casinoId;
  twin.registry.players.forEach((p, id) =>
    evaluateSubject({ kind: 'player', id, casinoId }, factsFor(p)));
  twin.registry.sessions.forEach((s, id) =>
    evaluateSubject({ kind: 'session', id, casinoId }, factsFor(s)));
  twin.registry.machines.forEach((m, id) =>
    evaluateSubject({ kind: 'machine', id, casinoId }, factsFor(m)));
  twin.registry.floors.forEach((f, id) =>
    evaluateSubject({ kind: 'floor', id, casinoId }, factsFor(f)));
  evaluateSubject({ kind: 'casino', id: casinoId, casinoId }, casinoFacts(twin));

  decisions.sort(byPriority);

  return {
    casinoId,
    jurisdiction: ctx.jurisdiction,
    evaluatedAt,
    policiesEvaluated: applicable.length,
    subjectsEvaluated: subjects,
    decisions,
  };
}
