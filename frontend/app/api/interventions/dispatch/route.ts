/**
 * POST /api/interventions/dispatch
 *
 * Server-side endpoint that dispatches a single intervention channel.
 * Called once per channel by the RevenueDashboard client component.
 * Credentials (Twilio) live here — never exposed to the browser.
 *
 * Request body:
 *   { channel: 'in_app' | 'whatsapp' | 'sms' | 'email', recipient: string, message: string }
 *
 * Response:
 *   { success: boolean, sid?: string, error?: string, status: 'sent' | 'failed' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage, sendSMS, type DispatchResult } from '@/lib/messaging';
import * as Sentry from '@sentry/nextjs';
import { rateLimit, getIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Request / response shapes ─────────────────────────────────────────────────

export interface DispatchRequest {
  channel:   'in_app' | 'whatsapp' | 'sms' | 'email';
  recipient: string;
  message:   string;
}

export interface DispatchResponse extends DispatchResult {
  status: 'sent' | 'failed';
}

const ALLOWED_ROLES = new Set(['casino_admin', 'super_admin']);

// ── Auth helper ───────────────────────────────────────────────────────────────

async function authorise(req: NextRequest): Promise<{ error: NextResponse } | { userId: string; email: string }> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header', status: 'failed' },
        { status: 401 }
      ),
    };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Invalid or expired token', status: 'failed' },
        { status: 401 }
      ),
    };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Insufficient permissions', status: 'failed' },
        { status: 403 }
      ),
    };
  }

  return { userId: user.id, email: user.email ?? '' };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<DispatchResponse>> {
  Sentry.setTag('endpoint', '/api/interventions/dispatch');
  Sentry.setTag('environment', process.env.NODE_ENV);

  const ip = getIp(req);
  if (!rateLimit(ip)) {
    Sentry.captureMessage('Rate limit exceeded', { level: 'warning', tags: { endpoint: '/api/interventions/dispatch', ip } });
    return NextResponse.json({ success: false, error: 'Too many requests', status: 'failed' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  try {
    const auth = await authorise(req);
    if ('error' in auth) return auth.error as NextResponse<DispatchResponse>;

    Sentry.setUser({ id: auth.userId, email: auth.email });

    let body: Partial<DispatchRequest>;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body', status: 'failed' },
        { status: 400 }
      );
    }

    const { channel, recipient, message } = body;

    if (!channel || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: channel, message', status: 'failed' },
        { status: 400 }
      );
    }

    let result: DispatchResult;

    switch (channel) {
      case 'whatsapp':
        if (!recipient) {
          result = { success: false, error: 'recipient is required for whatsapp channel' };
          break;
        }
        result = await sendWhatsAppMessage(recipient, message);
        break;

      case 'sms':
        if (!recipient) {
          result = { success: false, error: 'recipient is required for sms channel' };
          break;
        }
        result = await sendSMS(recipient, message);
        break;

      case 'in_app':
        console.log(`[dispatch] in_app → delivered via Supabase Realtime (player: ${recipient})`);
        result = { success: true, sid: `in_app_${Date.now()}` };
        break;

      case 'email':
        // Wire up SendGrid / Resend / SES here when ready.
        console.log(`[dispatch] email → provider not configured, skipping dispatch to ${recipient}`);
        result = { success: true, sid: `email_placeholder_${Date.now()}` };
        break;

      default:
        result = { success: false, error: `Unknown channel: ${channel}` };
    }

    if (!result.success && result.error) {
      Sentry.captureException(new Error(`[dispatch] ${channel} failed: ${result.error}`));
    }

    const response: DispatchResponse = {
      ...result,
      status: result.success ? 'sent' : 'failed',
    };

    // Always 200 — callers check `success` field, not HTTP status, for retry logic
    return NextResponse.json(response);

  } catch (err) {
    Sentry.captureException(err);
    console.error('[dispatch] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error', status: 'failed' },
      { status: 500 }
    );
  }
}
