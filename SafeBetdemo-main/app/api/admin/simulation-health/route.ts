// ── Super-Admin-only Demo Simulation Health (NON-PRODUCTION) ─────────────────
// Reads the certified governance views (overall health, per-casino health,
// event-volume usage, storage, partition readiness, open alerts, emergency-
// disable flags) and returns them for the Super Admin Platform Health page.
// Gated CLOSED: demo env only, and the caller must be an authenticated
// super_admin (verified server-side from the users table, not the client).
// No operator/regulator account can read this. No secrets are returned.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) =>
  NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_ENV !== 'demo') return deny(404);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return deny(503);

  // Authenticate the caller from their bearer token and require super_admin.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return deny(401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return deny(401);
  const { data: prof } = await admin.from('users').select('role').eq('id', u.user.id).single();
  if (prof?.role !== 'super_admin') return deny(403);

  try {
    const [overall, casinos, usage, storage, readiness, alerts, flags] = await Promise.all([
      admin.from('sbiq_demo_sim_health_overall').select('*').maybeSingle(),
      admin.from('sbiq_demo_simulation_health').select('*').order('casino_name'),
      admin.from('sbiq_demo_simulator_usage').select('*').maybeSingle(),
      admin.from('sbiq_demo_storage_status').select('*').maybeSingle(),
      admin.rpc('sbiq_demo_partition_readiness', { p_ensure: false }),
      admin.from('sbiq_demo_sim_alerts').select('category,severity,scope,details,created_at').eq('resolved', false).order('created_at', { ascending: false }).limit(50),
      admin.from('sbiq_demo_sim_flags').select('key,value'),
    ]);

    const flagMap = Object.fromEntries((flags.data ?? []).map((f: { key: string; value: string }) => [f.key, f.value]));
    return NextResponse.json(
      {
        ok: true,
        as_of: new Date().toISOString(),
        overall: overall.data ?? null,
        casinos: casinos.data ?? [],
        usage: usage.data ?? null,
        storage: storage.data ?? null,
        readiness: readiness.data ?? null,
        alerts: alerts.data ?? [],
        emergency: {
          simulator_enabled: flagMap['ENABLE_DEMO_LIVE_SIMULATOR'] === 'true',
          showcase_enabled: flagMap['ENABLE_DEMO_SHOWCASE_MODE'] === 'true',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return deny(500);
  }
}

export async function POST() { return deny(404); }
