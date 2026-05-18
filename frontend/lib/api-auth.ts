import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export type AuthResult =
  | { error: NextResponse }
  | { userId: string; email: string; casinoId: string | null };

const ALLOWED_ROLES = new Set(['casino_admin', 'super_admin', 'compliance_officer']);

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function authorise(req: NextRequest): Promise<AuthResult> {
  const sb = serviceClient();

  // ── API key path ─────────────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key')?.trim();
  if (apiKey) {
    const { data: keyRecord } = await sb
      .from('api_keys')
      .select('id, casino_id, owner_email, is_active, expires_at')
      .eq('key', apiKey)
      .single();

    if (!keyRecord || !keyRecord.is_active) {
      return { error: NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 }) };
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return { error: NextResponse.json({ error: 'API key has expired' }, { status: 401 }) };
    }

    return {
      userId:   keyRecord.id,
      email:    keyRecord.owner_email ?? '',
      casinoId: keyRecord.casino_id   ?? null,
    };
  }

  // ── Bearer token path (Supabase JWT) ─────────────────────────────────────────
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  if (!token) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };

  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };

  const { data: profile } = await sb
    .from('users')
    .select('role, casino_id')
    .eq('id', user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userId: user.id, email: user.email ?? '', casinoId: profile.casino_id ?? null };
}

/** Returns true if v is a non-empty string */
export const isStr = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
