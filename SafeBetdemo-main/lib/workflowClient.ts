// ─── Workflow — browser client (v1.5) ────────────────────────────────────────
//
// Thin fetch wrapper over the `workflow` edge function. The UI is a CONSUMER:
// it never computes anything — it calls the workflow endpoint (orchestration)
// and the consumer-gateway (certified intelligence). Auth is the user's
// verified Supabase session token.

import { supabase } from '@/lib/supabase';

async function authHeaders(): Promise<Record<string, string> | null> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !key) return null;
  return { Authorization: `Bearer ${token}`, apikey: key, 'Content-Type': 'application/json' };
}

function base(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/workflow`;
}

/** GET a workflow view. */
export async function wfGet(action: string, params: Record<string, string | undefined> = {}): Promise<Record<string, unknown> | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string> });
  const res = await fetch(`${base()}?${qs.toString()}`, { headers });
  return res.ok ? await res.json() : null;
}

/** POST a workflow mutation. Returns {ok, data}. */
export async function wfPost(action: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> | null; status: number }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, data: null, status: 401 };
  const res = await fetch(`${base()}?action=${encodeURIComponent(action)}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data, status: res.status };
}

export const EVIDENCE_LABEL: Record<string, string> = {
  'recorded-fact': 'Recorded Fact',
  'derived-intelligence': 'Derived Intelligence',
  'policy-decision': 'Policy Decision',
  'explainable-intelligence': 'Explainable Intelligence',
};

export const STATUS_TONE: Record<string, string> = {
  open: 'secondary', 'in-review': 'default', accepted: 'default', rejected: 'destructive',
  'action-recorded': 'default', 'outcome-recorded': 'default', resolved: 'outline', closed: 'outline',
};

export const PRIORITY_TONE: Record<string, string> = {
  critical: 'destructive', high: 'destructive', medium: 'default', low: 'secondary',
};
