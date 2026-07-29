// ─── Customer Onboarding + Pilot models (v1.3) ───────────────────────────────
//
// Commercial workflow metadata (step progress, pilot checklists, readiness).
// NOT runtime state. Pure definitions + progress/readiness computation so the
// UI needs no business logic. Every step maps to a certified capability the
// customer configures — it never bypasses the enterprise flow.

// ── Casino operator onboarding (WS1) ──────────────────────────────────────────

export const ONBOARDING_STEPS = [
  { key: 'register-operator',   title: 'Register operator',        capability: 'casinos registry' },
  { key: 'configure-jurisdiction', title: 'Configure jurisdiction', capability: 'casinos.jurisdiction (policy selector)' },
  { key: 'select-connector',    title: 'Select connector profile', capability: 'Connector Framework profile' },
  { key: 'configure-auth',      title: 'Configure authentication', capability: 'Supabase Auth + verified principals' },
  { key: 'map-systems',         title: 'Map external systems',     capability: 'MappingConfig' },
  { key: 'validate-mappings',   title: 'Validate mappings',        capability: 'validateMappingConfig' },
  { key: 'run-certification',   title: 'Run connector certification', capability: 'Casino Integration Certification' },
  { key: 'test-ingestion',      title: 'Test event ingestion',     capability: 'connector-ingest → Event Platform' },
  { key: 'review-diagnostics',  title: 'Review diagnostics',       capability: 'Integration Health view' },
  { key: 'activate-production', title: 'Activate production mode',  capability: 'operating mode + subscription' },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['key'];

export interface OnboardingProgress {
  casinoId: string;
  completed: OnboardingStepKey[];      // keys the operator has completed
  startedAt: string | null;
  activatedAt: string | null;
}

export interface OnboardingView {
  casinoId: string;
  steps: { key: OnboardingStepKey; title: string; capability: string; done: boolean; current: boolean }[];
  completedCount: number;
  totalSteps: number;
  percent: number;
  currentStep: OnboardingStepKey | null;
  activated: boolean;
}

export function shapeOnboarding(progress: OnboardingProgress): OnboardingView {
  const done = new Set(progress.completed);
  let currentAssigned = false;
  const steps = ONBOARDING_STEPS.map(s => {
    const isDone = done.has(s.key);
    const current = !isDone && !currentAssigned;
    if (current) currentAssigned = true;
    return { key: s.key, title: s.title, capability: s.capability, done: isDone, current };
  });
  const completedCount = steps.filter(s => s.done).length;
  return {
    casinoId: progress.casinoId,
    steps,
    completedCount,
    totalSteps: ONBOARDING_STEPS.length,
    percent: Math.round((completedCount / ONBOARDING_STEPS.length) * 100),
    currentStep: steps.find(s => s.current)?.key ?? null,
    activated: progress.activatedAt !== null,
  };
}

// ── Pilot deployment (WS2) ────────────────────────────────────────────────────

export const PILOT_CHECKLIST = [
  { key: 'operator-onboarded',   title: 'Operator onboarded', category: 'setup' },
  { key: 'connector-certified',  title: 'Connector certified', category: 'setup' },
  { key: 'events-flowing',       title: 'Events flowing end-to-end', category: 'validation' },
  { key: 'dashboards-verified',  title: 'Dashboards verified', category: 'validation' },
  { key: 'uat-signed-off',       title: 'Customer acceptance testing signed off', category: 'acceptance' },
  { key: 'monitoring-enabled',   title: 'Monitoring & alerting enabled', category: 'operations' },
  { key: 'rollback-rehearsed',   title: 'Rollback rehearsed', category: 'operations' },
  { key: 'go-live-approved',     title: 'Go-live approved', category: 'go-live' },
] as const;

export type PilotItemKey = (typeof PILOT_CHECKLIST)[number]['key'];
export const PILOT_STATUSES = ['planned', 'in-progress', 'ready', 'live', 'rolled-back'] as const;
export type PilotStatus = (typeof PILOT_STATUSES)[number];

export interface PilotDeployment {
  casinoId: string;
  status: PilotStatus;
  checklist: PilotItemKey[];           // completed items
  startedAt: string | null;
  goLiveAt: string | null;
  notes: string | null;
}

export interface PilotView {
  casinoId: string;
  status: PilotStatus;
  items: { key: PilotItemKey; title: string; category: string; done: boolean }[];
  completedCount: number;
  totalItems: number;
  percent: number;
  readinessScore: number;              // 0–100
  goLiveRecommended: boolean;
  outstanding: string[];
}

export function shapePilot(pilot: PilotDeployment): PilotView {
  const done = new Set(pilot.checklist);
  const items = PILOT_CHECKLIST.map(i => ({ key: i.key, title: i.title, category: i.category, done: done.has(i.key) }));
  const completedCount = items.filter(i => i.done).length;
  const percent = Math.round((completedCount / PILOT_CHECKLIST.length) * 100);
  const goLiveRecommended = items.every(i => i.done) && pilot.status !== 'rolled-back';
  return {
    casinoId: pilot.casinoId,
    status: pilot.status,
    items,
    completedCount,
    totalItems: PILOT_CHECKLIST.length,
    percent,
    readinessScore: percent,
    goLiveRecommended,
    outstanding: items.filter(i => !i.done).map(i => i.title),
  };
}
