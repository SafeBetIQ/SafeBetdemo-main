// ─── Commercial Licensing (v1.3) ─────────────────────────────────────────────
//
// SaaS licensing is COMMERCIAL METADATA — a tenant's plan, lifecycle, and
// feature entitlements. It is NOT casino runtime state (no players/sessions/
// machines) and it NEVER alters the certified enterprise flow: identity,
// events, projections, twin, intelligence, and policy behave identically
// regardless of licence. Entitlements gate commercial FEATURE ACCESS at the
// presentation layer only. Pure, configuration-driven, tested.

export const PLANS = ['trial', 'pilot', 'standard', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'suspended', 'expired', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Commercial feature entitlements (presentation-layer access only). */
export const FEATURES = [
  'casino-portal', 'connector-framework', 'regulator-portal',
  'customer-reports', 'report-export', 'priority-support',
] as const;
export type Feature = (typeof FEATURES)[number];

export interface PlanDefinition {
  plan: Plan;
  label: string;
  entitlements: Feature[];
  maxConnectors: number;      // 0 = unlimited
  maxOperators: number;       // casinos under this subscription
  trialDays: number;          // 0 = not a trial plan
  supportLevel: 'community' | 'standard' | 'priority';
}

/** Shipped plan catalogue (configuration, not behaviour). */
export const PLAN_CATALOGUE: Record<Plan, PlanDefinition> = {
  trial: {
    plan: 'trial', label: 'Trial', trialDays: 30, maxConnectors: 2, maxOperators: 1,
    supportLevel: 'community',
    entitlements: ['casino-portal', 'connector-framework', 'customer-reports'],
  },
  pilot: {
    plan: 'pilot', label: 'Pilot', trialDays: 90, maxConnectors: 5, maxOperators: 1,
    supportLevel: 'standard',
    entitlements: ['casino-portal', 'connector-framework', 'customer-reports', 'regulator-portal'],
  },
  standard: {
    plan: 'standard', label: 'Standard', trialDays: 0, maxConnectors: 10, maxOperators: 3,
    supportLevel: 'standard',
    entitlements: ['casino-portal', 'connector-framework', 'customer-reports', 'regulator-portal', 'report-export'],
  },
  enterprise: {
    plan: 'enterprise', label: 'Enterprise', trialDays: 0, maxConnectors: 0, maxOperators: 0,
    supportLevel: 'priority',
    entitlements: ['casino-portal', 'connector-framework', 'regulator-portal', 'customer-reports', 'report-export', 'priority-support'],
  },
};

export interface Subscription {
  casinoId: string;
  plan: Plan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface LicenceEvaluation {
  casinoId: string;
  plan: Plan;
  status: SubscriptionStatus;
  active: boolean;                       // may the tenant use entitled features?
  daysToExpiry: number | null;
  expiryDate: string | null;
  warnings: { code: 'TRIAL_ENDING' | 'SUBSCRIPTION_ENDING' | 'EXPIRED' | 'SUSPENDED'; message: string }[];
  entitlements: Feature[];
  supportLevel: PlanDefinition['supportLevel'];
}

const DAY = 86_400_000;
export const EXPIRY_WARN_DAYS = 7;

function daysBetween(fromIso: string | null, now: number): number | null {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now) / DAY);
}

/** Evaluate a subscription into a licence view (pure). */
export function evaluateLicence(sub: Subscription, now: number = Date.now()): LicenceEvaluation {
  const def = PLAN_CATALOGUE[sub.plan] ?? PLAN_CATALOGUE.trial;
  const expiryIso = sub.status === 'trial' ? sub.trialEndsAt : sub.currentPeriodEnd;
  const daysToExpiry = daysBetween(expiryIso, now);
  const warnings: LicenceEvaluation['warnings'] = [];

  let active = false;
  if (sub.status === 'cancelled') {
    // inactive
  } else if (sub.status === 'suspended') {
    warnings.push({ code: 'SUSPENDED', message: 'Subscription is suspended — contact Customer Success.' });
  } else if (sub.status === 'expired' || (daysToExpiry !== null && daysToExpiry < 0)) {
    warnings.push({ code: 'EXPIRED', message: 'Subscription has expired — renew to restore access.' });
  } else {
    active = sub.status === 'trial' || sub.status === 'active';
    if (daysToExpiry !== null && daysToExpiry <= EXPIRY_WARN_DAYS) {
      warnings.push({
        code: sub.status === 'trial' ? 'TRIAL_ENDING' : 'SUBSCRIPTION_ENDING',
        message: `${sub.status === 'trial' ? 'Trial' : 'Subscription'} ends in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}.`,
      });
    }
  }

  return {
    casinoId: sub.casinoId, plan: sub.plan, status: sub.status,
    active,
    daysToExpiry: active || sub.status === 'expired' ? daysToExpiry : daysToExpiry,
    expiryDate: expiryIso,
    warnings,
    entitlements: active ? def.entitlements : [],
    supportLevel: def.supportLevel,
  };
}

/** Is a commercial feature entitled under an evaluated licence? */
export function hasEntitlement(licence: LicenceEvaluation, feature: Feature): boolean {
  return licence.active && licence.entitlements.indexOf(feature) !== -1;
}

/** Build a default trial subscription for a newly-registered operator. */
export function newTrialSubscription(casinoId: string, now: number = Date.now(), plan: Plan = 'trial'): Subscription {
  const def = PLAN_CATALOGUE[plan];
  return {
    casinoId, plan, status: def.trialDays > 0 ? 'trial' : 'active',
    trialEndsAt: def.trialDays > 0 ? new Date(now + def.trialDays * DAY).toISOString() : null,
    currentPeriodEnd: def.trialDays > 0 ? null : new Date(now + 365 * DAY).toISOString(),
    createdAt: new Date(now).toISOString(),
  };
}
