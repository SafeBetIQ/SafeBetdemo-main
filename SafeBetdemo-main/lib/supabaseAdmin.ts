import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './supabaseTarget';

/**
 * Server-side only Supabase client using the service role key.
 * Bypasses Row Level Security — use only in API routes and server-side logic.
 * NEVER import this in client components or expose it to the browser.
 */
// Fail closed in Pilot unless this is EXACTLY the authorised Pilot project URL (M1B-P2B.2).
const supabaseUrl = getSupabaseUrl();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
