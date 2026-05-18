import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isDev = process.env.NODE_ENV === 'development';

const SETUP_GUIDE =
  '\n  1. Copy .env.example to .env.local' +
  '\n  2. Open https://supabase.com/dashboard → your project → Settings → API' +
  '\n  3. Copy "Project URL" → NEXT_PUBLIC_SUPABASE_URL' +
  '\n  4. Copy "anon public" key → NEXT_PUBLIC_SUPABASE_ANON_KEY' +
  '\n  5. Restart the dev server (npm run dev)\n';

function createUnconfiguredClient(): SupabaseClient {
  // Returns a real SupabaseClient pointed at a non-existent local address.
  // Any query will fail at the network level with a clear console message
  // rather than crashing the module at import time.
  // This client is only ever created in development when env vars are missing.
  const stub = createClient('http://localhost:0', 'unconfigured', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Wrap fetch so every network attempt logs a helpful message before failing.
  // The actual request will fail (nothing listens on port 0), giving a
  // clear network error in the browser devtools as a secondary signal.
  if (typeof window !== 'undefined') {
    const _originalFetch = window.fetch.bind(window);
    (stub as unknown as { fetch: typeof fetch }).fetch = (...args) => {
      console.error(
        '%c[SafeBet IQ] Supabase is not configured.\n' +
        'This query will fail. Set environment variables to connect to a real project.' +
        SETUP_GUIDE,
        'color: #f87171; font-weight: bold;'
      );
      return _originalFetch(...args);
    };
  }

  return stub;
}

function buildClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    const message =
      '[SafeBet IQ] Missing required environment variables:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL' + (supabaseUrl    ? ' ✓' : ' ✗ MISSING') + '\n' +
      '  NEXT_PUBLIC_SUPABASE_ANON_KEY' + (supabaseAnonKey ? ' ✓' : ' ✗ MISSING') + '\n' +
      SETUP_GUIDE;

    // TEMPORARY: warn instead of crash to confirm env vars are the root cause of 504/500.
    // Restore throw once NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
    // are confirmed set correctly on the EB environment.
    console.error('[SafeBet IQ] PRODUCTION MISCONFIGURATION (non-fatal):', message);
    return createUnconfiguredClient();
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });
}

export const supabase = buildClient();

export type UserRole =
  | 'super_admin'
  | 'national_regulator'
  | 'provincial_regulator'
  | 'casino_admin'
  | 'compliance_officer'
  | 'regulator';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InterventionChannel = 'whatsapp' | 'email' | 'sms';
export type InterventionStatus = 'pending' | 'sent' | 'failed' | 'delivered';
export type GameType = 'slots' | 'roulette' | 'blackjack' | 'poker' | 'baccarat' | 'live_dealer';

export type TransactionType = 'deposit' | 'withdrawal' | 'wager' | 'win' | 'bonus' | 'refund';
export type ExclusionType = 'self' | 'operator_initiated' | 'regulator_mandated' | 'network';
export type ExclusionStatus = 'active' | 'expired' | 'lifted' | 'breached';
export type BehaviourSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IntegrationStatus = 'pending' | 'active' | 'paused' | 'error' | 'disconnected';
export type FeatureModuleTier = 'standard' | 'premium' | 'enterprise';
export type AccessScope = 'own' | 'province' | 'national' | 'all';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  casino_id?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface Casino {
  id: string;
  name: string;
  license_number?: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  province?: string;
  country?: string;
  is_active: boolean;
  simulation_mode: boolean;
  created_at: string;
}

export type Operator = Casino;

export interface Player {
  id: string;
  casino_id: string;
  player_token: string;
  player_external_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  current_risk_level: RiskLevel;
  current_risk_score: number;
  total_bets_today: number;
  total_winnings: number;
  total_withdrawals: number;
  current_game?: string;
  current_game_type?: GameType;
  visit_count: number;
  is_active: boolean;
  registration_date: string;
  last_activity: string;
}

export interface Session {
  id: string;
  casino_id: string;
  player_id?: string;
  player_token: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  game_type?: string;
  device_type: string;
  total_wagered: number;
  total_won: number;
  net_result: number;
  session_risk_score: number;
  is_flagged: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Transaction {
  id: string;
  casino_id: string;
  session_id?: string;
  player_id?: string;
  player_token: string;
  transaction_type: TransactionType;
  amount: number;
  currency: string;
  game_type?: string;
  risk_flag: boolean;
  risk_reason?: string;
  processed_at: string;
  created_at: string;
}

export interface BehaviourEvent {
  id: string;
  casino_id: string;
  session_id?: string;
  player_id?: string;
  player_token: string;
  event_type: string;
  signal_score: number;
  severity: BehaviourSeverity;
  event_data: Record<string, unknown>;
  model_version: string;
  flagged_for_review: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  recorded_at: string;
  created_at: string;
}

export interface SelfExclusion {
  id: string;
  casino_id: string;
  player_id?: string;
  player_token: string;
  exclusion_type: ExclusionType;
  duration_type: 'temporary' | 'indefinite' | 'permanent';
  duration_days?: number;
  starts_at: string;
  ends_at?: string;
  status: ExclusionStatus;
  breach_count: number;
  reason?: string;
  notes?: string;
  submitted_by?: string;
  nrgp_reported: boolean;
  nrgp_reported_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OperatorIntegration {
  id: string;
  casino_id: string;
  provider_name: string;
  provider_type: string;
  status: IntegrationStatus;
  api_endpoint?: string;
  webhook_url?: string;
  last_sync_at?: string;
  sync_frequency_minutes: number;
  records_synced_total: number;
  error_count: number;
  last_error?: string;
  config: Record<string, unknown>;
  enabled_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureModule {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  tier: FeatureModuleTier;
  is_default: boolean;
  is_active: boolean;
  icon: string;
  sort_order: number;
  permissions_required: string[];
  created_at: string;
  updated_at: string;
}

export interface OperatorFeatureAccess {
  id: string;
  casino_id: string;
  feature_module_id: string;
  is_enabled: boolean;
  enabled_at: string;
  enabled_by?: string;
  expires_at?: string;
  notes?: string;
  created_at: string;
}

export interface RoleAccessEntry {
  role: string;
  resource: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  scope: AccessScope;
  notes?: string;
}

export interface RiskScore {
  id: string;
  player_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  factors?: Record<string, unknown>;
  recorded_at: string;
}

export interface Intervention {
  id: string;
  player_id: string;
  casino_id: string;
  channel: InterventionChannel;
  message_content: string;
  status: InterventionStatus;
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  created_by?: string;
  created_at: string;
}

export interface CrossOperatorAlert {
  id: string;
  alert_type: string;
  severity: BehaviourSeverity;
  status: string;
  player_token: string;
  originating_casino_id?: string;
  affected_casino_ids?: string[];
  details: Record<string, unknown>;
  created_at: string;
}

export function isRegulator(role: UserRole | string): boolean {
  return ['national_regulator', 'provincial_regulator', 'regulator'].includes(role);
}

export function canAccessNational(role: UserRole | string): boolean {
  return ['super_admin', 'national_regulator', 'regulator'].includes(role);
}

export function canAccessProvince(role: UserRole | string): boolean {
  return ['super_admin', 'national_regulator', 'provincial_regulator', 'regulator'].includes(role);
}

export function isOperatorRole(role: UserRole | string): boolean {
  return ['casino_admin', 'compliance_officer'].includes(role);
}
