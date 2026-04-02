import { createClient } from '@supabase/supabase-js';

/**
 * Server-side only Supabase client using the service role key.
 * Bypasses Row Level Security — use only in API routes and server-side logic.
 * NEVER import this in client components or expose it to the browser.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
