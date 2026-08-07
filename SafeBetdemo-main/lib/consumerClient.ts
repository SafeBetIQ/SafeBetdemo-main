// ─── Consumer Platform — browser client (v1.5.1 convergence) ─────────────────
//
// THE single browser entry point to the certified presentation layer. Every UI
// page fetches its data through here: the Consumer Platform gateway
// (consumer-gateway) and the Regulator Portal (regulator-portal), which are the
// only certified presentation surfaces. No page may read database tables
// directly — identity → events → projections → twin → intelligence → policy →
// Consumer Platform → UI is the ONLY permitted flow (Constitution 5).
//
// Auth is the user's verified Supabase session token; the server derives scope
// from the JWT (Phase 4.1 / ADR-002) — parameters only select a view.

import { supabase, readAccessTokenFast } from '@/lib/supabase';

async function authHeaders(): Promise<Record<string, string> | null> {
  // Prefer the lock-free persisted token so first-load fetches don't stall on the
  // Supabase auth-token navigator lock; fall back to getSession only if absent.
  let token = readAccessTokenFast();
  if (!token) token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !key) return null;
  return { Authorization: `Bearer ${token}`, apikey: key };
}

function fnUrl(fn: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fn}`;
}

/** Fetch a Consumer Platform gateway view. Returns the shaped `data` payload. */
export async function cgGet<T = Record<string, unknown>>(
  view: string,
  params: Record<string, string | undefined> = {},
): Promise<T | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const qs = new URLSearchParams({ view, version: 'v1', ...clean(params) });
  const res = await fetch(`${fnUrl('consumer-gateway')}?${qs.toString()}`, { headers });
  if (!res.ok) return null;
  return ((await res.json())?.data ?? null) as T | null;
}

/** Fetch a Regulator Portal view (the regulator's certified presentation surface). */
export async function rpGet<T = Record<string, unknown>>(
  view: string,
  params: Record<string, string | undefined> = {},
): Promise<T | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const qs = new URLSearchParams({ view, ...clean(params) });
  const res = await fetch(`${fnUrl('regulator-portal')}?${qs.toString()}`, { headers });
  if (!res.ok) return null;
  return ((await res.json())?.data ?? null) as T | null;
}

/** Fetch a certified evidence envelope (evidence-gateway). Scope is JWT-derived. */
export async function evGet<T = Record<string, unknown>>(
  domain: 'financial' | 'session' | 'player' | 'machine',
  params: Record<string, string | undefined> = {},
): Promise<T | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const qs = new URLSearchParams({ domain, ...clean(params) });
  const res = await fetch(`${fnUrl('evidence-gateway')}?${qs.toString()}`, { headers });
  if (!res.ok) return null;
  return ((await res.json())?.data ?? null) as T | null;
}

/** Build an authorised CSV export URL for the evidence-gateway (opened by the browser). */
export function evExportUrl(domain: string, params: Record<string, string | undefined> = {}): string {
  const qs = new URLSearchParams({ domain, format: 'csv', ...clean(params) });
  return `${fnUrl('evidence-gateway')}?${qs.toString()}`;
}

function clean(p: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== '')) as Record<string, string>;
}

export const EVIDENCE_LABEL: Record<string, string> = {
  'recorded-fact': 'Recorded Fact', 'derived-intelligence': 'Derived Intelligence',
  'policy-decision': 'Policy Decision', 'demonstration-data': 'Demonstration Data',
};

/** Map a numeric risk score to the certified band (matches Consumer Platform). */
export function riskBand(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
