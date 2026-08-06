// ── Super-Admin-only registered-count manual refresh (NON-PRODUCTION) ────────
// Recomputes the static-population registered cache on demand. Gated CLOSED: demo
// env only + authenticated super_admin (server-verified every request). The RPC is
// advisory-locked + rate-limited (≥30s) + audited; the browser supplies no casino
// authority. Returns the refresh status + new certified timestamp. No player data.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) =>
  NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function POST(req: Request) {
  const correlationId = crypto.randomUUID();
  if (process.env.NEXT_PUBLIC_ENV !== 'demo') return deny(404);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return deny(503);

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return deny(401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return deny(401);
  const { data: prof } = await admin.from('users').select('role').eq('id', u.user.id).single();
  if (prof?.role !== 'super_admin') return deny(403);

  try {
    const { data, error } = await admin.rpc('sbiq_admin_refresh_registered_manual', {
      p_account: u.user.id, p_correlation: correlationId,
    });
    if (error) return deny(500);
    // Audit (safe; no player data).
    await admin.from('audit_events').insert({
      event_type: 'ADMIN_REGISTERED_REFRESH', event_category: 'admin', action: 'refresh_registered_counts',
      chain_scope: 'platform', resource_type: 'registered_counts', outcome: 'success', severity: 'low',
      correlation_id: correlationId, description: 'Super Admin manual registered-count refresh',
      metadata: { decision: (data as Record<string, unknown>)?.reason ?? null },
    }).then(() => {}, () => {});
    return NextResponse.json({ ok: true, correlationId, ...(data as Record<string, unknown>) },
      { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return deny(500);
  }
}

export async function GET() { return deny(404); }
