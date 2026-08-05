// ── Super-Admin-only consolidated Admin Overview (NON-PRODUCTION) ────────────
// One request replaces the Overview's ~8-call fan-out. Backed by a single
// administrative RPC (sbiq_admin_overview_snapshot) that reads
// projection_casino_state once + cached registered counts + governance /
// simulator / alerts. Financial GGR (heavy: ~5s over 130k events) is a bounded
// DEFERRED section via ?section=financial. Gated CLOSED: demo env only, and the
// caller must be an authenticated super_admin (verified server-side EVERY request,
// never from cache). Anon 401, operator/regulator 403, super_admin 200. Short
// private in-memory cache of non-secret metrics only; no CDN cache; no secrets.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cacheHit } from '@/lib/demoSimHealthClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) =>
  NextResponse.json({ ok: false, error: 'Not available.' }, { status });

const CORE_TTL_MS = 8000;      // core metrics refresh quickly
const FIN_TTL_MS = 20000;      // financial is heavy + changes slowly
type Entry = { at: number; payload: Record<string, unknown> };
let coreCache: Entry | null = null;
let finCache: Entry | null = null;

export async function GET(req: Request) {
  const correlationId = crypto.randomUUID();
  if (process.env.NEXT_PUBLIC_ENV !== 'demo') return deny(404);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return deny(503);

  // Authenticate + require super_admin — EVERY request, never from cache.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return deny(401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return deny(401);
  const { data: prof } = await admin.from('users').select('role').eq('id', u.user.id).single();
  if (prof?.role !== 'super_admin') return deny(403);

  const params = new URL(req.url).searchParams;
  const financial = params.get('section') === 'financial';
  const fresh = params.get('fresh') === '1';
  const now = Date.now();
  const cache = financial ? finCache : coreCache;
  const ttl = financial ? FIN_TTL_MS : CORE_TTL_MS;

  if (cache && cacheHit(cache.at, now, ttl, fresh)) {
    return NextResponse.json({ ok: true, cached: true, correlationId, ...cache.payload },
      { headers: { 'Cache-Control': 'no-store, private' } });
  }

  try {
    const { data, error } = await admin.rpc('sbiq_admin_overview_snapshot', { p_include_financial: financial });
    if (error || !data) return deny(500);
    const payload = data as Record<string, unknown>;
    if (financial) finCache = { at: now, payload }; else coreCache = { at: now, payload };
    return NextResponse.json({ ok: true, cached: false, correlationId, ...payload },
      { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return deny(500);
  }
}

export async function POST() { return deny(404); }
