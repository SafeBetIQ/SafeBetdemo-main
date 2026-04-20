import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── UPGRADE 4: Contact Form API Security ──────────────────────────────────────
// Server-side handler — runs in Node.js, never in the browser.
// Layers:
//   1. Cloudflare Turnstile verification (server-side — token never reusable)
//   2. Input validation + sanitisation
//   3. Rate limiting (DB check — max 3 per email per 24h)
//   4. INSERT via service_role (no anon JWT exposed to client)
// ─────────────────────────────────────────────────────────────────────────────

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const EMAIL_RE    = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const ALLOWED_TYPES = new Set(['casino_operator', 'regulator', 'player', 'other', '']);

// Service-role client — server-only, never sent to browser
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('[contact] TURNSTILE_SECRET_KEY not set');
    return false;
  }
  const form = new FormData();
  form.append('secret',   secret);
  form.append('response', token);
  form.append('remoteip', ip);

  try {
    const res  = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: form });
    const json = await res.json() as { success: boolean; 'error-codes'?: string[] };
    if (!json.success) console.warn('[contact] Turnstile rejected', json['error-codes']);
    return json.success === true;
  } catch (err) {
    console.error('[contact] Turnstile fetch error:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown';

  // ── Parse ────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const name      = typeof body.name      === 'string' ? body.name.trim()              : '';
  const email     = typeof body.email     === 'string' ? body.email.trim().toLowerCase() : '';
  const message   = typeof body.message   === 'string' ? body.message.trim()           : '';
  const user_type = typeof body.user_type === 'string' ? body.user_type.trim()         : '';
  const company   = typeof body.company   === 'string' ? body.company.trim().slice(0, 200) : undefined;
  const phone     = typeof body.phone     === 'string' ? body.phone.trim().slice(0, 30)    : undefined;
  const token     = typeof body.turnstile_token === 'string' ? body.turnstile_token : '';

  const errors: { field: string; message: string }[] = [];

  if (!token)                                                 errors.push({ field: 'turnstile_token', message: 'CAPTCHA is required' });
  if (name.length < 2 || name.length > 100)                  errors.push({ field: 'name',    message: 'Name must be 2–100 characters' });
  if (!EMAIL_RE.test(email) || email.length > 254)           errors.push({ field: 'email',   message: 'Valid email address required' });
  if (message.length < 10 || message.length > 5000)          errors.push({ field: 'message', message: 'Message must be 10–5000 characters' });
  if (!ALLOWED_TYPES.has(user_type))                         errors.push({ field: 'user_type', message: 'Invalid user type' });

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 });
  }

  // ── Turnstile ─────────────────────────────────────────────────────────────
  const captchaOk = await verifyTurnstile(token, ip);
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'CAPTCHA verification failed. Please refresh and try again.' },
      { status: 403 },
    );
  }

  // ── Rate limit (DB check) ─────────────────────────────────────────────────
  let supabase: ReturnType<typeof getServiceClient>;
  try {
    supabase = getServiceClient();
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('contact_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since);

  if ((count ?? 0) >= 3) {
    console.warn('[contact] Rate limit hit', { email, ip });
    return NextResponse.json(
      { error: 'Too many submissions. Please wait 24 hours before submitting again.' },
      { status: 429, headers: { 'Retry-After': '86400' } },
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { error: insertErr } = await supabase.from('contact_submissions').insert({
    name,
    email,
    company:   company   || null,
    phone:     phone     || null,
    user_type: user_type || null,
    message,
    status:     'new',
    email_sent: false,
  });

  if (insertErr) {
    if (insertErr.code === 'P0001') {
      return NextResponse.json(
        { error: 'Too many submissions. Please wait before submitting again.' },
        { status: 429 },
      );
    }
    console.error('[contact] Insert error:', insertErr.message);
    return NextResponse.json({ error: 'Submission failed — please try again.' }, { status: 500 });
  }

  console.log('[contact] Accepted', { email, ip });
  return NextResponse.json({ success: true, message: "Thank you — we'll be in touch shortly." });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
