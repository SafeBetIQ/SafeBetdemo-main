// ─── SafeBet Guardian — deterministic policy applicability (ARCH-V4-C8) ───────
// Deterministic, explainable. NO AI. Policy applicability is NOT the legal decision —
// it narrows candidate policies; a human reviewer confirms legal/regulatory applicability.

import type { PolicyVersionFixture, PolicyApplicability, ActionType } from './types.ts';

/** Evaluate whether a policy version could apply to a proposed (jurisdiction, actionType). */
export function evaluatePolicyApplicability(
  policy: PolicyVersionFixture | null,
  ctx: { jurisdiction: string; actionType: ActionType; now?: Date },
): PolicyApplicability {
  if (!policy) return 'INSUFFICIENT_CONTEXT';
  const now = ctx.now ?? new Date();
  if (policy.status === 'SUPERSEDED') return 'SUPERSEDED';
  if (policy.status === 'EXPIRED') return 'EXPIRED';
  if (policy.status !== 'ACTIVE' && policy.status !== 'APPROVED_FOR_SYNTHETIC_USE') return 'NOT_APPLICABLE';
  if (policy.jurisdiction !== ctx.jurisdiction) return 'NOT_APPLICABLE';
  const from = Date.parse(policy.effectiveFrom); const until = Date.parse(policy.effectiveUntil);
  if (!Number.isNaN(from) && now.getTime() < from) return 'NOT_APPLICABLE';    // future
  if (!Number.isNaN(until) && now.getTime() > until) return 'EXPIRED';         // past effective window
  const perm = policy.permittedActions.find((p) => p.actionType === ctx.actionType);
  if (!perm || !perm.permitted) return 'NOT_APPLICABLE';                       // action not permitted by policy
  if (policy.exceptions.length > 0) return 'REQUIRES_LEGAL_REVIEW';
  return perm.reviewRequired ? 'REQUIRES_LEGAL_REVIEW' : 'POTENTIALLY_APPLICABLE';
}
