// ─── Reporting Centre narrative coherence (UAT-OP-1 P0-1) ────────────────────
//
// The printable operator report showed a self-contradiction: a risk summary that
// said "0 critical / 0 high, no monitoring required" alongside a Policy Decisions
// section that read like observed critical incidents ("compliance review required",
// policy citations). The two sections were composed from independent sources (risk
// tiers from casino aggregates; decisions from the policy evaluation) and never
// reconciled.
//
// This module derives ONE coherent narrative from the same inputs so the summary and
// the findings can never disagree:
//   - if any critical/high/monitored player exists  -> findings are OBSERVED incidents;
//   - if none exist                                  -> policy decisions are shown as
//     GENERAL POLICY GUIDANCE (clearly labelled, not an observed incident), and the
//     summary states plainly that no critical/high-risk players were observed.
// It fabricates nothing: it only classifies and labels what the certified views return.

export interface ReportRiskInputs {
  critical: number;
  high: number;
  monitoredCount: number;
  decisionCount: number;
}

export interface ReportNarrative {
  hasObservedRisk: boolean;
  /** One-line risk summary that agrees with the findings section. */
  riskSummary: string;
  /** Heading for the decisions section, honest about what it represents. */
  findingsLabel: string;
  /** True only when there is observed risk to attach the decisions to. */
  findingsAreObserved: boolean;
  /** Non-null disclaimer shown when decisions are general guidance, not incidents. */
  guidanceDisclaimer: string | null;
}

export function buildReportNarrative(inp: ReportRiskInputs): ReportNarrative {
  const critical = Math.max(0, inp.critical | 0);
  const high = Math.max(0, inp.high | 0);
  const monitored = Math.max(0, inp.monitoredCount | 0);
  const hasObservedRisk = critical > 0 || high > 0 || monitored > 0;

  if (hasObservedRisk) {
    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical} critical-risk player${critical === 1 ? '' : 's'}`);
    if (high > 0) parts.push(`${high} high-risk player${high === 1 ? '' : 's'}`);
    if (monitored > 0) parts.push(`${monitored} under active monitoring`);
    return {
      hasObservedRisk: true,
      riskSummary: `Observed this period: ${parts.join(', ')}.`,
      findingsLabel: 'Observed compliance findings',
      findingsAreObserved: true,
      guidanceDisclaimer: null,
    };
  }

  return {
    hasObservedRisk: false,
    riskSummary: 'No critical or high-risk players were observed this period; no player monitoring was required.',
    // With no observed risk, any policy decisions are general guidance — NOT incidents.
    findingsLabel: inp.decisionCount > 0 ? 'General policy guidance' : 'Compliance findings',
    findingsAreObserved: false,
    guidanceDisclaimer: inp.decisionCount > 0
      ? 'The items below are general policy guidance for this operator, not observed player-specific incidents this period.'
      : null,
  };
}

/**
 * Coherence invariant: the report may NEVER present observed player-specific
 * incidents while simultaneously reporting no observed risk. Used by tests and can
 * gate rendering. Returns true when the narrative is internally consistent.
 */
export function narrativeIsConsistent(n: ReportNarrative): boolean {
  if (!n.hasObservedRisk && n.findingsAreObserved) return false;
  if (n.hasObservedRisk && n.guidanceDisclaimer !== null) return false;
  return true;
}
