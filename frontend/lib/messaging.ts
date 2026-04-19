/**
 * messaging.ts — Server-side only
 *
 * Real Twilio dispatch for WhatsApp and SMS.
 * Uses the Twilio REST API directly (no SDK dependency).
 *
 * Required environment variables (add to .env.local):
 *   TWILIO_ACCOUNT_SID     — e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN      — your Twilio auth token
 *   TWILIO_WHATSAPP_NUMBER — e.g. +14155238886  (Twilio sandbox or approved number)
 *   TWILIO_SMS_NUMBER      — e.g. +12345678901
 *
 * NEVER import this file from a 'use client' component.
 * It is only safe to call from API routes or Server Actions.
 */

export interface DispatchResult {
  success: boolean;
  sid?: string;
  error?: string;
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function twilioPost(formBody: URLSearchParams): Promise<DispatchResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    const msg = 'Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing)';
    console.error(`[messaging] ${msg}`);
    return { success: false, error: msg };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  // btoa is available in Node.js ≥16 and all edge runtimes
  const credentials = btoa(`${accountSid}:${authToken}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });
  } catch (networkErr) {
    const msg = `Network error reaching Twilio: ${networkErr}`;
    console.error(`[messaging] ${msg}`);
    return { success: false, error: msg };
  }

  let payload: Record<string, unknown>;
  try {
    payload = await res.json();
  } catch {
    return { success: false, error: `Twilio returned non-JSON response (HTTP ${res.status})` };
  }

  if (!res.ok || payload.status === 'failed' || payload.error_code) {
    const msg = (payload.message as string) ?? `HTTP ${res.status}`;
    return { success: false, error: msg };
  }

  return { success: true, sid: payload.sid as string };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message via Twilio.
 * `to` must be a full E.164 number, e.g. +27820000000
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<DispatchResult> {
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!from) {
    const msg = 'TWILIO_WHATSAPP_NUMBER is not configured';
    console.error(`[messaging] ${msg}`);
    return { success: false, error: msg };
  }

  const body = new URLSearchParams({
    From: `whatsapp:${from}`,
    To:   `whatsapp:${to}`,
    Body: message,
  });

  const result = await twilioPost(body);

  if (result.success) {
    console.log(`[messaging] WhatsApp sent — SID: ${result.sid} → ${to}`);
  } else {
    console.error(`[messaging] WhatsApp failed — ${result.error} → ${to}`);
  }

  return result;
}

/**
 * Send an SMS via Twilio.
 * `to` must be a full E.164 number, e.g. +27820000000
 */
export async function sendSMS(to: string, message: string): Promise<DispatchResult> {
  const from = process.env.TWILIO_SMS_NUMBER;
  if (!from) {
    const msg = 'TWILIO_SMS_NUMBER is not configured';
    console.error(`[messaging] ${msg}`);
    return { success: false, error: msg };
  }

  const body = new URLSearchParams({
    From: from,
    To:   to,
    Body: message,
  });

  const result = await twilioPost(body);

  if (result.success) {
    console.log(`[messaging] SMS sent — SID: ${result.sid} → ${to}`);
  } else {
    console.error(`[messaging] SMS failed — ${result.error} → ${to}`);
  }

  return result;
}
