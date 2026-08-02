// ── Secure Demo quick-login (NON-PRODUCTION ONLY) ────────────────────────────
// Signs an evaluator into an allowlisted synthetic Demo account WITHOUT ever
// exposing the account password to the browser. The client submits ONLY an
// immutable Demo slug (e.g. {"demoAccount":"prestige"}); the server maps it to
// the account, reads credentials from SERVER-ONLY env vars, authenticates with
// Supabase, verifies role + tenant scope, writes a tamper-evident audit event,
// and returns only { ok, redirect, session } — the session (access/refresh
// tokens) is what the app's localStorage Supabase client needs to establish the
// authenticated session via setSession(); it is the SAME material the browser
// already receives after a normal password login. The PASSWORD is never
// returned, logged, or placed in the client bundle. Fails CLOSED unless the
// environment is demo, the feature flag is on, the host/origin are approved, and
// the slug is allowlisted. Super Admin is intentionally NOT reachable here.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveDemoSlug, type DemoSlugCfg as SlugCfg } from '@/lib/demoAuthSlugs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APPROVED_HOSTS = new Set(['demo.safebetiq.com', 'localhost:3000', '127.0.0.1:3000']);

// In-memory rate limiting (single-instance demo). Fails safe on restart.
const ipHits = new Map<string, number[]>();
const acctHits = new Map<string, number[]>();
function limited(map: Map<string, number[]>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  map.set(key, arr);
  return arr.length > max;
}

const generic = (status: number) =>
  NextResponse.json({ ok: false, error: 'The Demo account could not be opened. Please try again.' }, { status });

function enabled(): boolean {
  return process.env.NEXT_PUBLIC_ENV === 'demo' && process.env.ENABLE_DEMO_QUICK_LOGIN === 'true';
}

async function writeAudit(slug: string, cfg: SlugCfg | undefined, resolvedId: string | null, ok: boolean, correlationId: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) return;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    await admin.from('audit_events').insert({
      event_type: 'DEMO_ACCOUNT_LOGIN',
      event_category: 'auth',
      action: 'demo_quick_login',
      chain_scope: cfg?.casino ?? 'platform',
      casino_id: cfg?.casino ?? null,
      resource_type: 'demo_account',
      outcome: ok ? 'success' : 'failure',
      severity: ok ? 'low' : 'medium',
      correlation_id: correlationId,
      description: `Demo quick-login ${ok ? 'succeeded' : 'failed'} for slug=${slug}`,
      metadata: { demoAccount: slug, resolvedRole: cfg?.role ?? null, resolvedAccountId: resolvedId, jurisdiction: cfg?.jurisdiction ?? null },
    });
  } catch { /* never let auditing break login; never log secrets */ }
}

export async function POST(req: Request) {
  const correlationId = crypto.randomUUID();

  // 1) Fail closed unless demo + flag on. Production returns 404.
  if (!enabled()) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  // 2) Host + same-origin (CSRF) validation.
  const host = req.headers.get('host') ?? '';
  if (!APPROVED_HOSTS.has(host)) return generic(403);
  const origin = req.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== host) return generic(403); } catch { return generic(403); }
  }

  // 3) Rate limit (per IP, per account). 20/IP/10min accommodates a full demo
  //    tour (six casinos + regulator = 7 logins) plus a re-run, while still
  //    blocking abuse; 5/account/min blocks targeting a single account.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (limited(ipHits, ip, 20, 10 * 60_000)) return generic(429);

  // 4) Parse + allowlist the slug. Only a slug is accepted — never email/pw/role/casino/redirect.
  let slug = '';
  try { const body = await req.json(); slug = typeof body?.demoAccount === 'string' ? body.demoAccount : ''; } catch { /* */ }
  const cfg = resolveDemoSlug(slug);
  if (!cfg) { await writeAudit(slug || 'invalid', undefined, null, false, correlationId); return generic(400); }
  if (limited(acctHits, slug, 5, 60_000)) return generic(429);

  // 5) Server-only credentials.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env[cfg.emailEnv];
  const password = process.env[cfg.pwEnv];
  if (!url || !anon || !email || !password) return generic(503); // fail closed if not configured

  // 6) Authenticate server-side (password never leaves the server).
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    await writeAudit(slug, cfg, null, false, correlationId);
    return generic(401);
  }

  // 7) Verify role + tenant scope from the authoritative profile (not the client).
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? anon, { auth: { persistSession: false } });
  const { data: prof } = await admin.from('users').select('id, role, casino_id, jurisdiction').eq('id', data.user.id).single();
  const scopeOk = !!prof && prof.role === cfg.role
    && (!cfg.casino || prof.casino_id === cfg.casino)
    && (!cfg.jurisdiction || prof.jurisdiction === cfg.jurisdiction);
  if (!scopeOk) {
    await sb.auth.signOut();
    await writeAudit(slug, cfg, data.user.id, false, correlationId);
    return generic(403);
  }

  // 8) Audit success on the correct tamper-evident chain.
  await writeAudit(slug, cfg, data.user.id, true, correlationId);

  // 9) Return ONLY a success + fixed server-controlled redirect + the session the
  //    localStorage Supabase client needs. No password. No service key. No profile dump.
  const s = data.session;
  return NextResponse.json(
    { ok: true, redirect: cfg.redirect, session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// Any other method (and production) → 404.
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
}
