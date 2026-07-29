// ─── Customer Success + Reporting composition (v1.3) ─────────────────────────
//
// Composes COMMERCIAL metadata (subscriptions, onboarding, pilots) with
// CERTIFIED platform facts (connector health, platform health) into Customer
// Success and customer-facing report views. Pure composition — recalculates
// nothing, owns no runtime state; the platform data is read verbatim.

import { evaluateLicence, type Subscription, type LicenceEvaluation } from './licensing.ts';
import { shapeOnboarding, shapePilot, type OnboardingProgress, type PilotDeployment } from './onboarding.ts';

/** Per-operator commercial + health rollup for the Customer Success dashboard. */
export interface CustomerSuccessRow {
  casinoId: string;
  name: string;
  jurisdiction: string;
  plan: string;
  licenceStatus: string;
  licenceActive: boolean;
  daysToExpiry: number | null;
  onboardingPercent: number;
  onboardingActivated: boolean;
  pilotStatus: string | null;
  pilotReadiness: number | null;
  connectorRuns: number;
  connectorFailed: number;
  eventsInLog: number;
  projectionLagSeconds: number | null;
  healthState: 'ok' | 'attention' | 'unknown';
  warnings: string[];
}

export interface CustomerSuccessInput {
  casino: { id: string; name: string; jurisdiction: string };
  subscription: Subscription | null;
  onboarding: OnboardingProgress | null;
  pilot: PilotDeployment | null;
  connectorHealth: { runs?: number; failed?: number } | null;
  platformHealth: { events_in_log?: number; projection_lag_seconds?: number } | null;
  now?: number;
}

export function shapeCustomerSuccessRow(input: CustomerSuccessInput): CustomerSuccessRow {
  const now = input.now ?? Date.now();
  const licence: LicenceEvaluation | null = input.subscription ? evaluateLicence(input.subscription, now) : null;
  const onboarding = input.onboarding ? shapeOnboarding(input.onboarding) : null;
  const pilot = input.pilot ? shapePilot(input.pilot) : null;
  const runs = Number(input.connectorHealth?.runs ?? 0);
  const failed = Number(input.connectorHealth?.failed ?? 0);
  const events = Number(input.platformHealth?.events_in_log ?? 0);
  const lag = input.platformHealth?.projection_lag_seconds != null ? Number(input.platformHealth.projection_lag_seconds) : null;

  const warnings: string[] = [];
  if (licence) for (const w of licence.warnings) warnings.push(w.message);
  if (failed > 0) warnings.push(`${failed} failed connector event(s)`);

  const healthState: CustomerSuccessRow['healthState'] =
    input.platformHealth == null ? 'unknown'
      : (failed > 0 || (lag != null && lag > 300) || (licence != null && !licence.active)) ? 'attention'
      : 'ok';

  return {
    casinoId: input.casino.id, name: input.casino.name, jurisdiction: input.casino.jurisdiction,
    plan: licence?.plan ?? 'none',
    licenceStatus: licence?.status ?? 'none',
    licenceActive: licence?.active ?? false,
    daysToExpiry: licence?.daysToExpiry ?? null,
    onboardingPercent: onboarding?.percent ?? 0,
    onboardingActivated: onboarding?.activated ?? false,
    pilotStatus: pilot?.status ?? null,
    pilotReadiness: pilot?.readinessScore ?? null,
    connectorRuns: runs, connectorFailed: failed,
    eventsInLog: events, projectionLagSeconds: lag,
    healthState, warnings,
  };
}

// ── Customer-facing reports (WS6): compose certified Consumer Platform views ──

export const CUSTOMER_REPORTS = [
  'responsible-gambling-summary', 'compliance-overview', 'executive-dashboard',
  'connector-performance', 'intervention-summary', 'risk-trends',
] as const;
export type CustomerReport = (typeof CUSTOMER_REPORTS)[number];

export interface CustomerReportView {
  report: CustomerReport;
  casinoId: string;
  title: string;
  period: string;
  sections: { heading: string; evidenceClass: string; data: unknown }[];
  generatedAt: string;
}

/**
 * Build a customer report from ALREADY-SHAPED Consumer Platform view data
 * (summary/compliance/integration). No recalculation — the certified views
 * are composed and labelled.
 */
export function buildCustomerReport(
  report: CustomerReport,
  casinoId: string,
  views: { summary?: unknown; compliance?: unknown; integration?: unknown },
): CustomerReportView {
  const titles: Record<CustomerReport, string> = {
    'responsible-gambling-summary': 'Monthly Responsible Gambling Summary',
    'compliance-overview': 'Compliance Overview',
    'executive-dashboard': 'Executive Dashboard',
    'connector-performance': 'Connector Performance',
    'intervention-summary': 'Intervention Summary',
    'risk-trends': 'Risk Trends',
  };
  const sections: CustomerReportView['sections'] = [];
  if (report === 'connector-performance') {
    sections.push({ heading: 'Connector Health', evidenceClass: 'recorded-fact', data: views.integration ?? null });
  } else if (report === 'compliance-overview') {
    sections.push({ heading: 'Compliance', evidenceClass: 'recorded-fact', data: views.compliance ?? null });
  } else {
    // RG summary / executive / intervention / risk-trends compose the executive summary
    sections.push({ heading: 'Executive Summary', evidenceClass: 'recorded-fact', data: views.summary ?? null });
    if (views.compliance) sections.push({ heading: 'Compliance', evidenceClass: 'recorded-fact', data: views.compliance });
  }
  return {
    report, casinoId, title: titles[report],
    period: new Date().toISOString().slice(0, 7),
    sections,
    generatedAt: new Date().toISOString(),
  };
}
