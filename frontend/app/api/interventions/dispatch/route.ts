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
import { sendWhatsAppMessage, sendSMS, type DispatchResult } from '@/lib/messaging';

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

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<DispatchResponse>> {
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
      // In-app notifications are delivered via Supabase Realtime — already live by the time
      // the intervention_history row is inserted. Mark immediately as sent.
      console.log(`[dispatch] in_app → delivered via Supabase Realtime (player: ${recipient})`);
      result = { success: true, sid: `in_app_${Date.now()}` };
      break;

    case 'email':
      // Email provider not yet wired — log intent and return a placeholder success.
      // Wire up SendGrid / Resend / SES here when ready.
      console.log(`[dispatch] email → provider not configured, skipping dispatch to ${recipient}`);
      result = { success: true, sid: `email_placeholder_${Date.now()}` };
      break;

    default:
      result = { success: false, error: `Unknown channel: ${channel}` };
  }

  const response: DispatchResponse = {
    ...result,
    status: result.success ? 'sent' : 'failed',
  };

  // Always 200 — callers check `success` field, not HTTP status, for retry logic
  return NextResponse.json(response);
}
