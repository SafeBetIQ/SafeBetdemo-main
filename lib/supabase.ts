import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export type UserRole = 'super_admin' | 'casino_admin' | 'regulator';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InterventionChannel = 'whatsapp' | 'email' | 'sms';
export type InterventionStatus = 'pending' | 'sent' | 'failed' | 'delivered';
export type GameType = 'slots' | 'roulette' | 'blackjack' | 'poker' | 'baccarat' | 'live_dealer';

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
  is_active: boolean;
  simulation_mode: boolean;
  created_at: string;
}

export interface Player {
  id: string;
  casino_id: string;
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

export interface RiskScore {
  id: string;
  player_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  factors?: Record<string, any>;
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
