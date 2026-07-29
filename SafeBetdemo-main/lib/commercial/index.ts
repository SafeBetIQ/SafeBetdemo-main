// Commercial enablement — public API (v1.3).
//
// Commercial metadata + composition ONLY (subscriptions, entitlements,
// onboarding progress, pilot readiness, customer-success rollup, customer
// reports). Consumes the certified platform; owns no runtime state; alters
// no enterprise behaviour.

export {
  PLANS, SUBSCRIPTION_STATUSES, FEATURES, PLAN_CATALOGUE, EXPIRY_WARN_DAYS,
  type Plan, type SubscriptionStatus, type Feature, type PlanDefinition,
  type Subscription, type LicenceEvaluation,
  evaluateLicence, hasEntitlement, newTrialSubscription,
} from './licensing.ts';
export {
  ONBOARDING_STEPS, PILOT_CHECKLIST, PILOT_STATUSES,
  type OnboardingStepKey, type OnboardingProgress, type OnboardingView,
  type PilotItemKey, type PilotStatus, type PilotDeployment, type PilotView,
  shapeOnboarding, shapePilot,
} from './onboarding.ts';
export {
  CUSTOMER_REPORTS,
  type CustomerReport, type CustomerReportView,
  type CustomerSuccessRow, type CustomerSuccessInput,
  shapeCustomerSuccessRow, buildCustomerReport,
} from './customerSuccess.ts';
