// ── Super-Admin-only Demo Simulation Health (NON-PRODUCTION) ─────────────────
// Returns the certified governance snapshot for the Super Admin Platform Health
// page via ONE consolidated RPC (sbiq_demo_sim_health_snapshot) — which reads
// projection_casino_state and the event log once each (was ~10s across many
// re-scanned views; now sub-second). Gated CLOSED: demo env only, and the caller
// must be an authenticated super_admin (verified server-side from the users
// table, per request — never from cache). No operator/regulator can read this.
// A short PRIVATE in-memory cache (of the non-secret health payload only) absorbs
// bursts and polling; auth is ALWAYS re-validated before anything is returned.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cacheHit } from '@/lib/demoSimHealthClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) =>
  NextResponse.json({ ok: false, error: 'Not available.' }, { status });

// Private, in-process cache of the health DATA only (never auth). Short TTL so
// emergency-state changes surface quickly; not a CDN/shared cache.
const CACHE_TTL_MS = 6000;
let cache: { at: number; payload: Record<string, unknown> } | null = null;

export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_ENV !== 'demo') return deny(404);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return deny(503);

  // Authenticate the caller and require super_admin — EVERY request, never cached.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return deny(401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return deny(401);
  const { data: prof } = await admin.from('users').select('role').eq('id', u.user.id).single();
  if (prof?.role !== 'super_admin') return deny(403);

  // Retry / emergency path may bypass the short cache with ?fresh=1.
  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  const now = Date.now();
  if (cache && cacheHit(cache.at, now, CACHE_TTL_MS, fresh)) {
    return NextResponse.json(
      { ok: true, cached: true, ...cache.payload },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  try {
    const { data, error } = await admin.rpc('sbiq_demo_sim_health_snapshot');
    if (error || !data) return deny(500);
    const snap = data as Record<string, unknown>;
    const payload = {
      as_of: (snap.as_of as string) ?? new Date().toISOString(),
      overall: snap.overall ?? null,
      casinos: snap.casinos ?? [],
      usage: snap.usage ?? null,
      storage: snap.storage ?? null,
      readiness: snap.readiness ?? null,
      alerts: snap.alerts ?? [],
      emergency: snap.emergency ?? { simulator_enabled: false, showcase_enabled: false },
    };
    cache = { at: now, payload };
    return NextResponse.json(
      { ok: true, cached: false, ...payload },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch {
    return deny(500);
  }
}

export async function POST() { return deny(404); }
