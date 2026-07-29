// ─── Enterprise Policy & Rules Platform (Phase 3.6) ──────────────────────────
//
// THE enterprise decision layer — ONE platform evaluating configurable
// policies from every jurisdiction, regulator, operator and tenant through
// ONE evaluator. Its position in the flow:
//
//   … Digital Twin → Domain Intelligence → POLICY & RULES → Decision
//                                              → Realtime → Dashboards …
//
// The platform consumes the fully ENRICHED Digital Twin and returns
// PolicyDecisions. It never calculates (comparisons only), never enriches,
// never performs AI/behaviour/risk analysis (it reads the Domain
// Intelligence Platform's output), never owns runtime state, never
// persists, and never executes — execution belongs to Enterprise
// Consumers (Phase 3.7).
//
// The ONLY mutable thing here is CONFIGURATION (the active rule set),
// replaceable at runtime from any source via configure() — policy change
// is a data change, never a code change.

import type { CasinoDigitalTwin } from '../digitalTwin/index.ts';
import { defaultConfiguration } from './config/index.ts';
import { evaluateRules, type EvaluationContext } from './evaluation.ts';
import { validateRule, type DecisionSet, type PolicyRule } from './model.ts';

export class PolicyRulesPlatform {
  private rules: PolicyRule[];

  constructor(rules: PolicyRule[] = defaultConfiguration()) {
    this.rules = rules.map(validateRule);
  }

  /**
   * Replace the active configuration (validated, reject-not-repair).
   * Rules may come from any source — shipped packs, database, regulator
   * feed, tenant settings. Returns the number of active rules.
   */
  configure(rules: unknown[]): number {
    this.rules = rules.map(validateRule);
    return this.rules.length;
  }

  /** The active configuration (read-only copy — configuration, not state). */
  get policies(): PolicyRule[] {
    return this.rules.slice();
  }

  get policyCount(): number {
    return this.rules.length;
  }

  /**
   * THE decision interface (consumed by Enterprise Consumers in 3.7):
   * evaluate the active configuration against one casino's enriched twin.
   * Pure read → compare → decide; the twin is untouched.
   */
  evaluate(twin: CasinoDigitalTwin, ctx: EvaluationContext): DecisionSet {
    return evaluateRules(this.rules, twin, ctx);
  }
}

let defaultPlatform: PolicyRulesPlatform | undefined;

/** THE application-wide Enterprise Policy & Rules Platform. */
export function getPolicyPlatform(): PolicyRulesPlatform {
  if (!defaultPlatform) defaultPlatform = new PolicyRulesPlatform();
  return defaultPlatform;
}
