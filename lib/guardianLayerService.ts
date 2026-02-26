'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface MinorRiskScore {
  id: string;
  player_id: string;
  casino_id: string;
  risk_score: number;
  risk_category: 'Low' | 'Medium' | 'High' | 'Critical';
  risk_trend: 'increasing' | 'stable' | 'decreasing';
  risk_change_delta: number;
  betting_velocity_score: number;
  reaction_time_score: number;
  micro_bet_frequency: number;
  session_anomaly_score: number;
  school_hour_activity_flag: boolean;
  game_switch_impulsivity: number;
  loss_chasing_score: number;
  device_mismatch_score: number;
  calculated_at: string;
  players?: { first_name: string; last_name: string; email: string };
}

export interface DeviceIntelligence {
  id: string;
  device_id: string;
  casino_id: string;
  ip_address: string;
  ip_consistency_score: number;
  login_pattern_cluster: string;
  session_overlap_detected: boolean;
  fingerprint_shift_score: number;
  shared_device_probability: number;
  device_identity_shift_score: number;
  linked_accounts_count: number;
  high_risk_device: boolean;
  repeat_flagged: boolean;
  device_reuse_frequency: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface IdentityDrift {
  id: string;
  player_id: string;
  device_id: string;
  casino_id: string;
  drift_score: number;
  behavioral_signature_change: boolean;
  time_of_day_shift: boolean;
  stake_size_shift: boolean;
  gameplay_pattern_deviation: boolean;
  drift_threshold_exceeded: boolean;
  drift_spike_detected: boolean;
  repeat_drift_flag: boolean;
  cross_account_similarity_score: number;
  intervention_recommended: boolean;
  detected_at: string;
  players?: { first_name: string; last_name: string };
}

export interface SchoolHourFlag {
  id: string;
  player_id: string;
  casino_id: string;
  session_start: string;
  session_end: string;
  is_school_hours: boolean;
  is_weekday: boolean;
  province: string;
  geo_latitude: number;
  geo_longitude: number;
  within_school_zone: boolean;
  school_hour_activity_ratio: number;
  risk_multiplier: number;
  players?: { first_name: string; last_name: string };
}

export interface InterventionSignal {
  id: string;
  player_id: string;
  casino_id: string;
  signal_type: string;
  trigger_reason: string;
  risk_score: number;
  casino_response_status: string;
  response_time_minutes: number | null;
  action_taken: string | null;
  escalation_stage: number;
  resolution_outcome: string | null;
  resolved_at: string | null;
  created_at: string;
  players?: { first_name: string; last_name: string };
}

export interface OperatorRiskSummary {
  id: string;
  casino_id: string;
  summary_date: string;
  underage_suspicion_rate: number;
  device_risk_index: number;
  average_response_time_minutes: number;
  escalation_compliance_percent: number;
  total_minor_risk_alerts: number;
  total_identity_drift_alerts: number;
  total_device_shifts: number;
  total_interventions: number;
  interventions_resolved: number;
  interventions_pending: number;
  national_risk_ranking: number;
  casinos?: { name: string };
}

export interface ProvinceRiskSummary {
  id: string;
  province: string;
  summary_date: string;
  province_risk_index: number;
  school_hour_risk_score: number;
  total_flagged_sessions: number;
  total_operators: number;
  high_risk_operators: number;
  average_operator_response_time: number;
  compliance_rate: number;
  school_holiday_comparison: number;
}

export function calculateMinorRiskScore(params: {
  bettingVelocity: number;
  reactionTime: number;
  microBetFrequency: number;
  sessionAnomalyScore: number;
  schoolHourActivity: boolean;
  gameSwitchImpulsivity: number;
  lossChasingScore: number;
  deviceMismatchScore: number;
}): { score: number; category: 'Low' | 'Medium' | 'High' | 'Critical' } {
  const weights = {
    bettingVelocity: 0.18,
    reactionTime: 0.12,
    microBetFrequency: 0.15,
    sessionAnomalyScore: 0.10,
    schoolHourActivity: 0.20,
    gameSwitchImpulsivity: 0.10,
    lossChasingScore: 0.10,
    deviceMismatchScore: 0.05,
  };

  const schoolHourValue = params.schoolHourActivity ? 100 : 0;

  const rawScore =
    params.bettingVelocity * weights.bettingVelocity +
    params.reactionTime * weights.reactionTime +
    params.microBetFrequency * weights.microBetFrequency +
    params.sessionAnomalyScore * weights.sessionAnomalyScore +
    schoolHourValue * weights.schoolHourActivity +
    params.gameSwitchImpulsivity * weights.gameSwitchImpulsivity +
    params.lossChasingScore * weights.lossChasingScore +
    params.deviceMismatchScore * weights.deviceMismatchScore;

  const score = Math.round(Math.min(100, Math.max(0, rawScore)) * 1000) / 1000;

  let category: 'Low' | 'Medium' | 'High' | 'Critical';
  if (score >= 80) category = 'Critical';
  else if (score >= 60) category = 'High';
  else if (score >= 30) category = 'Medium';
  else category = 'Low';

  return { score, category };
}

export function calculateDeviceIdentityShift(params: {
  ipConsistencyScore: number;
  fingerprintShiftScore: number;
  sessionOverlapDetected: boolean;
  linkedAccountsCount: number;
  deviceReuseFrequency: number;
}): number {
  const sessionOverlapValue = params.sessionOverlapDetected ? 0.3 : 0;
  const accountFactor = Math.min(1.0, params.linkedAccountsCount / 10);
  const reuseFactor = Math.min(1.0, params.deviceReuseFrequency / 15);

  const raw =
    (1 - params.ipConsistencyScore) * 0.25 +
    params.fingerprintShiftScore * 0.30 +
    sessionOverlapValue +
    accountFactor * 0.10 +
    reuseFactor * 0.05;

  return Math.round(Math.min(1.0, Math.max(0, raw)) * 1000) / 1000;
}

export function getSchoolHourRiskMultiplier(sessionTime: Date): number {
  const hour = sessionTime.getHours();
  const dayOfWeek = sessionTime.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isSchoolHour = hour >= 8 && hour < 15;

  if (isWeekday && isSchoolHour) return 2.0;
  return 1.0;
}

export async function fetchMinorRiskScores(casinoId?: string, limit = 50): Promise<MinorRiskScore[]> {
  let query = supabase
    .from('guardian_minor_risk_scores')
    .select('*, players(first_name, last_name, email)')
    .order('risk_score', { ascending: false })
    .limit(limit);

  if (casinoId) query = query.eq('casino_id', casinoId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchDeviceIntelligence(casinoId?: string, limit = 50): Promise<DeviceIntelligence[]> {
  let query = supabase
    .from('guardian_device_intelligence')
    .select('*')
    .order('device_identity_shift_score', { ascending: false })
    .limit(limit);

  if (casinoId) query = query.eq('casino_id', casinoId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchIdentityDrift(casinoId?: string, limit = 50): Promise<IdentityDrift[]> {
  let query = supabase
    .from('guardian_identity_drift')
    .select('*, players(first_name, last_name)')
    .order('drift_score', { ascending: false })
    .limit(limit);

  if (casinoId) query = query.eq('casino_id', casinoId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchSchoolHourFlags(casinoId?: string, limit = 50): Promise<SchoolHourFlag[]> {
  let query = supabase
    .from('guardian_school_hour_flags')
    .select('*, players(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (casinoId) query = query.eq('casino_id', casinoId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchInterventionSignals(casinoId?: string, limit = 50): Promise<InterventionSignal[]> {
  let query = supabase
    .from('guardian_intervention_signals')
    .select('*, players(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (casinoId) query = query.eq('casino_id', casinoId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchOperatorRiskSummaries(casinoId?: string): Promise<OperatorRiskSummary[]> {
  let query = supabase
    .from('guardian_operator_risk_summary')
    .select('*, casinos(name)')
    .order('summary_date', { ascending: false });

  if (casinoId) query = query.eq('casino_id', casinoId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchProvinceRiskSummaries(): Promise<ProvinceRiskSummary[]> {
  const { data, error } = await supabase
    .from('guardian_province_risk_summary')
    .select('*')
    .order('summary_date', { ascending: false })
    .limit(36);

  if (error) throw error;
  return data || [];
}

export async function updateInterventionSignalStatus(
  signalId: string,
  status: string,
  actionTaken?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    casino_response_status: status,
    updated_at: new Date().toISOString(),
  };

  if (actionTaken) update.action_taken = actionTaken;
  if (status === 'resolved' || status === 'dismissed') {
    update.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('guardian_intervention_signals')
    .update(update)
    .eq('id', signalId);

  if (error) throw error;
}

export function getRiskCategoryColor(category: string): string {
  switch (category) {
    case 'Critical': return 'text-red-400';
    case 'High': return 'text-orange-400';
    case 'Medium': return 'text-yellow-400';
    case 'Low': return 'text-green-400';
    default: return 'text-gray-400';
  }
}

export function getRiskCategoryBg(category: string): string {
  switch (category) {
    case 'Critical': return 'bg-red-500/20 border-red-500/30 text-red-300';
    case 'High': return 'bg-orange-500/20 border-orange-500/30 text-orange-300';
    case 'Medium': return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300';
    case 'Low': return 'bg-green-500/20 border-green-500/30 text-green-300';
    default: return 'bg-gray-500/20 border-gray-500/30 text-gray-300';
  }
}

export function getResponseStatusColor(status: string): string {
  switch (status) {
    case 'resolved': return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'action_taken': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'investigating': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'acknowledged': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    case 'dismissed': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    case 'pending': return 'bg-red-500/20 text-red-300 border-red-500/30';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
}
