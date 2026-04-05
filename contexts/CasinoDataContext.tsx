'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export interface LiveEvent {
  id: string;
  event_type: string;
  casino_id: string;
  player_id: string;
  session_id: string | null;
  game_id: string | null;
  machine_id: string | null;
  bet_amount: number;
  win_amount: number;
  balance_after: number | null;
  duration_seconds: number;
  risk_score: number;
  risk_flags: string[];
  outcome: 'win' | 'loss' | 'push' | 'active' | null;
  game_type: string | null;
  is_simulated: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RiskProfile {
  id: string;
  player_id: string;
  casino_id: string;
  risk_score: number;
  risk_level: string;
  loss_escalation_score: number;
  session_duration_score: number;
  deposit_frequency_score: number;
  bet_intensity_score: number;
  cross_operator_score: number;
  risk_rationale: string | null;
  score_delta: number;
  intervention_triggered: boolean;
  analyzed_at: string;
}

export interface LiveAlert {
  id: string;
  player_id: string;
  casino_id: string;
  intervention_type: string;
  trigger_reason: string;
  risk_score_at_trigger: number;
  delivery_method: string | null;
  message_sent: string | null;
  dispatch_status: string;
  triggered_at: string;
  player_response: string | null;
  intervention_successful: boolean | null;
}

/**
 * Unified active player record — ONE source of truth for both Live Feed and BRIE.
 *
 * Pipeline: live_events (last 10 min) → behavioral_risk_profiles → ActivePlayer
 *
 * Players without a risk profile yet get default low/0 values (fallback).
 */
export interface ActivePlayer {
  player_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  // Risk profile fields — defaults when no profile exists yet
  risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  loss_escalation_score: number;
  session_duration_score: number;
  deposit_frequency_score: number;
  bet_intensity_score: number;
  cross_operator_score: number;
  risk_rationale: string | null;
  score_delta: number;
  intervention_triggered: boolean;
  analyzed_at: string | null;
  // Presence metadata
  last_seen: string;        // most recent live_event created_at
  has_risk_profile: boolean;
  profile_id: string | null;
}

export interface PeriodMetrics {
  totalWagered: number;
  totalWon: number;
  ggr: number;
  avgBetSize: number;
  totalEvents: number;
  uniquePlayers: number;
  riskCritical: number;
}

const DEFAULT_PERIOD_METRICS: PeriodMetrics = {
  totalWagered: 0, totalWon: 0, ggr: 0, avgBetSize: 0,
  totalEvents: 0, uniquePlayers: 0, riskCritical: 0,
};

export interface LiveKpi {
  active_players: number;
  events_per_min: number;
  total_wagered: number;
  total_won: number;
  ggr: number;
  avg_bet_size: number;
  risk_critical: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  active_machines: number;
  snapshot_at: string;
}

export interface MachineStatus {
  machine_id: string;
  machine_type: string;
  status: 'active' | 'idle' | 'offline' | 'maintenance';
  current_player_id: string | null;
  spins_per_minute: number;
  current_risk_score: number;
  total_wagered_session: number;
  updated_at: string;
}

export interface Player {
  id: string;
  playerName: string;
  playerId: string;
  game: string;
  betAmount: number;
  totalWagered: number;
  sessionDuration: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  lastBetTime: Date;
}

export interface Intervention {
  id: string;
  playerName: string;
  playerId: string;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  timestamp: Date;
  reason: string;
  riskScore: number;
  automated: boolean;
  triggerType: 'high_risk' | 'rapid_betting' | 'session_duration' | 'loss_chasing' | 'bet_escalation';
}

interface CasinoData {
  liveEvents: LiveEvent[];
  players: Player[];
  interventions: Intervention[];
  kpi: LiveKpi;
  machines: MachineStatus[];
  isSimulating: boolean;
  realtimeConnected: boolean;
  liveBets: LiveBetLegacy[];
  totalWagered: number;
  totalWon: number;
  /** KPI count derived from the live 1-min window */
  activePlayerCount: number;
  totalPlayers: number;
  avgBetSize: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  /** BET_PLACED sum since dashboard load — frontend only, resets on refresh */
  sessionWagered: number;
  /** Aggregated metrics for today (midnight → now) — DB-driven, refreshed every 60s */
  todayMetrics: PeriodMetrics;
  /** Aggregated metrics for the last 30 days — DB-driven, refreshed every 5 min */
  thirtyDayMetrics: PeriodMetrics;
  /** Latest AI risk profile per player from behavioral_risk_profiles */
  riskProfiles: RiskProfile[];
  /** Recent triggered interventions from intervention_history */
  liveAlerts: LiveAlert[];
  /**
   * UNIFIED active player dataset — ONE source of truth for Live Feed AND BRIE.
   *
   * Derived from: live_events (last 10 min) ⟶ behavioral_risk_profiles (latest per player).
   * Sorted by risk_score DESC. Updated in real-time via Supabase subscriptions.
   * Refreshed every 2 minutes to prune players who have gone inactive.
   */
  activePlayers: ActivePlayer[];
}

interface LiveBetLegacy {
  id: string;
  playerName: string;
  playerId: string;
  game: string;
  betAmount: number;
  outcome: 'win' | 'loss' | 'active';
  winAmount?: number;
  timestamp: Date;
  riskScore: number;
}

interface CasinoDataContextType {
  data: CasinoData;
  triggerBurst: (count?: number) => Promise<void>;
  refreshData: () => void;
}

const DEFAULT_KPI: LiveKpi = {
  active_players: 0,
  events_per_min: 0,
  total_wagered: 0,
  total_won: 0,
  ggr: 0,
  avg_bet_size: 0,
  risk_critical: 0,
  risk_high: 0,
  risk_medium: 0,
  risk_low: 0,
  active_machines: 0,
  snapshot_at: new Date().toISOString(),
};

const CasinoDataContext = createContext<CasinoDataContextType | undefined>(undefined);

const GAME_TYPES = ['Slots', 'Blackjack', 'Roulette', 'Poker', 'Baccarat', 'Video Poker', 'Craps'];

const SA_NAMES = [
  { first: 'Thabo', last: 'Nkosi' },
  { first: 'Lerato', last: 'Dlamini' },
  { first: 'Sipho', last: 'Mthembu' },
  { first: 'Nomsa', last: 'Khumalo' },
  { first: 'Mandla', last: 'Ndlovu' },
  { first: 'Zanele', last: 'Zulu' },
  { first: 'Bongani', last: 'Sithole' },
  { first: 'Precious', last: 'Zwane' },
  { first: 'Tshepo', last: 'Mkhize' },
  { first: 'Ntombi', last: 'Nkomo' },
  { first: 'Pieter', last: 'Van der Merwe' },
  { first: 'Annelie', last: 'Botha' },
  { first: 'Ahmed', last: 'Mohamed' },
  { first: 'Fatima', last: 'Abrahams' },
  { first: 'Ravi', last: 'Patel' },
  { first: 'Priya', last: 'Naidoo' },
  { first: 'Johan', last: 'Botha' },
  { first: 'Lindiwe', last: 'Zulu' },
  { first: 'Kagiso', last: 'Molefe' },
  { first: 'Neo', last: 'Phiri' },
];

function riskLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function playerNameFromEvent(event: LiveEvent): string {
  const meta = event.metadata as Record<string, unknown>;
  if (typeof meta?.player_name === 'string') return meta.player_name;
  const idx = parseInt(event.player_id.replace(/\D/g, ''), 10) || 0;
  const name = SA_NAMES[idx % SA_NAMES.length];
  return `${name.first} ${name.last}`;
}

function eventToLiveBet(event: LiveEvent): LiveBetLegacy {
  return {
    id: event.id,
    playerName: playerNameFromEvent(event),
    playerId: event.player_id,
    game: event.game_type || GAME_TYPES[0],
    betAmount: event.bet_amount,
    outcome: event.outcome === 'win' ? 'win' : event.outcome === 'loss' ? 'loss' : 'active',
    winAmount: event.win_amount > 0 ? event.win_amount : undefined,
    timestamp: new Date(event.created_at),
    riskScore: event.risk_score,
  };
}

function eventToPlayer(event: LiveEvent, idx: number): Player {
  return {
    id: `${event.player_id}-${idx}`,
    playerName: playerNameFromEvent(event),
    playerId: event.player_id,
    game: event.game_type || GAME_TYPES[idx % GAME_TYPES.length],
    betAmount: event.bet_amount,
    totalWagered: event.bet_amount,
    sessionDuration: event.duration_seconds,
    riskScore: event.risk_score,
    riskLevel: riskLevelFromScore(event.risk_score),
    isActive: true,
    lastBetTime: new Date(event.created_at),
  };
}

export function CasinoDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const casinoId = (user as unknown as Record<string, unknown>)?.casino_id as string | undefined;

  const [data, setData] = useState<CasinoData>({
    liveEvents: [],
    players: [],
    interventions: [],
    kpi: DEFAULT_KPI,
    machines: [],
    isSimulating: false,
    realtimeConnected: false,
    liveBets: [],
    totalWagered: 0,
    totalWon: 0,
    activePlayerCount: 0,
    totalPlayers: 0,
    avgBetSize: 385,
    riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
    sessionWagered: 0,
    todayMetrics: DEFAULT_PERIOD_METRICS,
    thirtyDayMetrics: DEFAULT_PERIOD_METRICS,
    riskProfiles: [],
    liveAlerts: [],
    activePlayers: [],
  });

  const burstTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const kpiWindowRef = useRef<LiveEvent[]>([]);

  const computeKpiFromWindow = useCallback((events: LiveEvent[], prevKpi: LiveKpi): LiveKpi => {
    if (events.length === 0) return prevKpi;
    const totalWageredWindow = events.reduce((s, e) => s + e.bet_amount, 0);
    const totalWonWindow = events.reduce((s, e) => s + e.win_amount, 0);
    const playerSet = new Set(events.map(e => e.player_id));
    const avgBet = events.length > 0 ? totalWageredWindow / events.length : 0;

    return {
      active_players: playerSet.size,
      events_per_min: events.length,
      total_wagered: parseFloat((prevKpi.total_wagered + totalWageredWindow).toFixed(2)),
      total_won: parseFloat((prevKpi.total_won + totalWonWindow).toFixed(2)),
      ggr: parseFloat((prevKpi.total_wagered + totalWageredWindow - prevKpi.total_won - totalWonWindow).toFixed(2)),
      avg_bet_size: parseFloat(avgBet.toFixed(2)),
      risk_critical: events.filter(e => e.risk_score >= 80).length,
      risk_high: events.filter(e => e.risk_score >= 60 && e.risk_score < 80).length,
      risk_medium: events.filter(e => e.risk_score >= 40 && e.risk_score < 60).length,
      risk_low: events.filter(e => e.risk_score < 40).length,
      active_machines: prevKpi.active_machines,
      snapshot_at: new Date().toISOString(),
    };
  }, []);

  const loadInitialData = useCallback(async (id: string) => {
    const [eventsRes, kpiRes, machinesRes, profilesRes, alertsRes] = await Promise.all([
      supabase
        .from('live_events')
        .select('*')
        .eq('casino_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('live_kpi_snapshots')
        .select('*')
        .eq('casino_id', id)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('machine_activity')
        .select('*')
        .eq('casino_id', id)
        .order('updated_at', { ascending: false })
        .limit(80),
      supabase
        .from('behavioral_risk_profiles')
        .select('id,player_id,casino_id,risk_score,risk_level,loss_escalation_score,session_duration_score,deposit_frequency_score,bet_intensity_score,cross_operator_score,risk_rationale,score_delta,intervention_triggered,analyzed_at')
        .eq('casino_id', id)
        .order('analyzed_at', { ascending: false })
        .limit(100),
      supabase
        .from('intervention_history')
        .select('id,player_id,casino_id,intervention_type,trigger_reason,risk_score_at_trigger,delivery_method,message_sent,dispatch_status,triggered_at,player_response,intervention_successful')
        .eq('casino_id', id)
        .order('triggered_at', { ascending: false })
        .limit(50),
    ]);

    const events: LiveEvent[] = (eventsRes.data || []).map((e) => ({
      ...e,
      bet_amount: Number(e.bet_amount),
      win_amount: Number(e.win_amount),
      risk_flags: Array.isArray(e.risk_flags) ? e.risk_flags : [],
    }));

    const machines: MachineStatus[] = (machinesRes.data || []).map((m) => ({
      machine_id: m.machine_id,
      machine_type: m.machine_type,
      status: m.status,
      current_player_id: m.current_player_id,
      spins_per_minute: Number(m.spins_per_minute),
      current_risk_score: m.current_risk_score,
      total_wagered_session: Number(m.total_wagered_session),
      updated_at: m.updated_at,
    }));

    const kpi: LiveKpi = kpiRes.data
      ? {
          active_players: kpiRes.data.active_players,
          events_per_min: kpiRes.data.events_per_min,
          total_wagered: Number(kpiRes.data.total_wagered),
          total_won: Number(kpiRes.data.total_won),
          ggr: Number(kpiRes.data.ggr),
          avg_bet_size: Number(kpiRes.data.avg_bet_size),
          risk_critical: kpiRes.data.risk_critical,
          risk_high: kpiRes.data.risk_high,
          risk_medium: kpiRes.data.risk_medium,
          risk_low: kpiRes.data.risk_low,
          active_machines: machines.filter(m => m.status === 'active').length,
          snapshot_at: kpiRes.data.snapshot_at,
        }
      : DEFAULT_KPI;

    const players = events.slice(0, 50).map((e, i) => eventToPlayer(e, i));
    const liveBets = events.slice(0, 20).map(e => eventToLiveBet(e));

    // Deduplicate risk profiles — latest per player_id
    const profileMap = new Map<string, RiskProfile>();
    for (const r of (profilesRes.data || [])) {
      if (!profileMap.has(r.player_id)) {
        profileMap.set(r.player_id, {
          id: r.id,
          player_id: r.player_id,
          casino_id: r.casino_id,
          risk_score: Number(r.risk_score) || 0,
          risk_level: r.risk_level || 'low',
          loss_escalation_score: Number(r.loss_escalation_score) || 0,
          session_duration_score: Number(r.session_duration_score) || 0,
          deposit_frequency_score: Number(r.deposit_frequency_score) || 0,
          bet_intensity_score: Number(r.bet_intensity_score) || 0,
          cross_operator_score: Number(r.cross_operator_score) || 0,
          risk_rationale: r.risk_rationale || null,
          score_delta: Number(r.score_delta) || 0,
          intervention_triggered: Boolean(r.intervention_triggered),
          analyzed_at: r.analyzed_at,
        });
      }
    }
    const riskProfiles = Array.from(profileMap.values()).sort((a, b) => b.risk_score - a.risk_score);

    const liveAlerts: LiveAlert[] = (alertsRes.data || []).map(a => ({
      id: a.id,
      player_id: a.player_id,
      casino_id: a.casino_id,
      intervention_type: a.intervention_type,
      trigger_reason: a.trigger_reason,
      risk_score_at_trigger: Number(a.risk_score_at_trigger) || 0,
      delivery_method: a.delivery_method || null,
      message_sent: a.message_sent || null,
      dispatch_status: (a as Record<string, unknown>).dispatch_status as string || 'pending',
      triggered_at: a.triggered_at,
      player_response: (a as Record<string, unknown>).player_response as string | null ?? null,
      intervention_successful: (a as Record<string, unknown>).intervention_successful as boolean | null ?? null,
    }));

    // ── Build unified active player dataset ──────────────────────────────────
    // Pipeline: live_events (last 10 min) → behavioral_risk_profiles → ActivePlayer[]
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: activeEvtData } = await supabase
      .from('live_events')
      .select('player_id, metadata, created_at')
      .eq('casino_id', id)
      .gte('created_at', tenMinAgo)
      .order('created_at', { ascending: false })
      .limit(500);

    const activeEvtMap = new Map<string, { metadata: Record<string, unknown>; created_at: string }>();
    for (const evt of (activeEvtData || [])) {
      if (!activeEvtMap.has(evt.player_id)) {
        activeEvtMap.set(evt.player_id, {
          metadata: (evt.metadata as Record<string, unknown>) || {},
          created_at: evt.created_at,
        });
      }
    }

    // Reuse the already-fetched risk profiles for the join
    const profileByPlayer = new Map<string, RiskProfile>();
    for (const p of riskProfiles) {
      if (!profileByPlayer.has(p.player_id)) profileByPlayer.set(p.player_id, p);
    }

    const activePlayers: ActivePlayer[] = Array.from(activeEvtMap.entries()).map(([pid, evt]) => {
      const profile = profileByPlayer.get(pid);
      const fullName = (evt.metadata?.player_name as string) || `Player …${pid.slice(-6)}`;
      const parts = fullName.split(' ');
      return {
        player_id: pid,
        display_name: fullName,
        first_name: parts[0] || 'Player',
        last_name: parts.slice(1).join(' ') || pid.slice(-6),
        risk_score: profile?.risk_score ?? 0,
        risk_level: (profile?.risk_level ?? 'low') as ActivePlayer['risk_level'],
        loss_escalation_score: profile?.loss_escalation_score ?? 0,
        session_duration_score: profile?.session_duration_score ?? 0,
        deposit_frequency_score: profile?.deposit_frequency_score ?? 0,
        bet_intensity_score: profile?.bet_intensity_score ?? 0,
        cross_operator_score: profile?.cross_operator_score ?? 0,
        risk_rationale: profile?.risk_rationale ?? null,
        score_delta: profile?.score_delta ?? 0,
        intervention_triggered: profile?.intervention_triggered ?? false,
        analyzed_at: profile?.analyzed_at ?? null,
        last_seen: evt.created_at,
        has_risk_profile: !!profile,
        profile_id: profile?.id ?? null,
      };
    }).sort((a, b) => b.risk_score - a.risk_score).slice(0, 100);

    // Derive ALL KPI counts from the unified activePlayers dataset — single source of truth
    const riskDist = {
      low:      activePlayers.filter(p => p.risk_score < 40).length,
      medium:   activePlayers.filter(p => p.risk_score >= 40 && p.risk_score < 60).length,
      high:     activePlayers.filter(p => p.risk_score >= 60 && p.risk_score < 80).length,
      critical: activePlayers.filter(p => p.risk_score >= 80).length,
    };

    setData(prev => ({
      ...prev,
      liveEvents: events,
      players,
      liveBets,
      // Sync kpi.active_players to match activePlayers.length so LiveKPIStrip and BRIE agree
      kpi: { ...kpi, active_players: activePlayers.length, risk_critical: riskDist.critical },
      machines,
      totalWagered: kpi.total_wagered,
      totalWon: kpi.total_won,
      activePlayerCount: activePlayers.length,
      totalPlayers: players.length,
      avgBetSize: kpi.avg_bet_size || 385,
      riskDistribution: riskDist,
      riskProfiles,
      liveAlerts,
      activePlayers,
    }));
  }, []);

  /**
   * Rebuild the unified active player list from DB.
   * Called on init and every 2 minutes to expire players who have gone inactive.
   * Pipeline: live_events (last 10 min) → behavioral_risk_profiles → ActivePlayer[]
   */
  const loadActivePlayers = useCallback(async (id: string) => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: evtData } = await supabase
      .from('live_events')
      .select('player_id, metadata, created_at')
      .eq('casino_id', id)
      .gte('created_at', tenMinAgo)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!evtData || evtData.length === 0) {
      setData(prev => ({ ...prev, activePlayers: [] }));
      return;
    }

    const evtMap = new Map<string, { metadata: Record<string, unknown>; created_at: string }>();
    for (const evt of evtData) {
      if (!evtMap.has(evt.player_id)) {
        evtMap.set(evt.player_id, {
          metadata: (evt.metadata as Record<string, unknown>) || {},
          created_at: evt.created_at,
        });
      }
    }

    const playerIds = Array.from(evtMap.keys());
    const { data: profileData } = await supabase
      .from('behavioral_risk_profiles')
      .select('id,player_id,risk_score,risk_level,loss_escalation_score,session_duration_score,deposit_frequency_score,bet_intensity_score,cross_operator_score,risk_rationale,score_delta,intervention_triggered,analyzed_at')
      .eq('casino_id', id)
      .in('player_id', playerIds)
      .order('analyzed_at', { ascending: false });

    const profileMap = new Map<string, Record<string, unknown>>();
    for (const p of (profileData || [])) {
      if (!profileMap.has(p.player_id)) profileMap.set(p.player_id, p as unknown as Record<string, unknown>);
    }

    const activePlayers: ActivePlayer[] = Array.from(evtMap.entries()).map(([pid, evt]) => {
      const p = profileMap.get(pid);
      const fullName = (evt.metadata?.player_name as string) || `Player …${pid.slice(-6)}`;
      const parts = fullName.split(' ');
      return {
        player_id: pid,
        display_name: fullName,
        first_name: parts[0] || 'Player',
        last_name: parts.slice(1).join(' ') || pid.slice(-6),
        risk_score: Number(p?.risk_score) || 0,
        risk_level: (p?.risk_level as ActivePlayer['risk_level']) ?? 'low',
        loss_escalation_score: Number(p?.loss_escalation_score) || 0,
        session_duration_score: Number(p?.session_duration_score) || 0,
        deposit_frequency_score: Number(p?.deposit_frequency_score) || 0,
        bet_intensity_score: Number(p?.bet_intensity_score) || 0,
        cross_operator_score: Number(p?.cross_operator_score) || 0,
        risk_rationale: (p?.risk_rationale as string) ?? null,
        score_delta: Number(p?.score_delta) || 0,
        intervention_triggered: Boolean(p?.intervention_triggered),
        analyzed_at: (p?.analyzed_at as string) ?? null,
        last_seen: evt.created_at,
        has_risk_profile: !!p,
        profile_id: (p?.id as string) ?? null,
      };
    }).sort((a, b) => b.risk_score - a.risk_score).slice(0, 100);

    const riskDist = {
      low:      activePlayers.filter(p => p.risk_score < 40).length,
      medium:   activePlayers.filter(p => p.risk_score >= 40 && p.risk_score < 60).length,
      high:     activePlayers.filter(p => p.risk_score >= 60 && p.risk_score < 80).length,
      critical: activePlayers.filter(p => p.risk_score >= 80).length,
    };
    setData(prev => ({
      ...prev,
      activePlayers,
      activePlayerCount: activePlayers.length,
      riskDistribution: riskDist,
      kpi: { ...prev.kpi, active_players: activePlayers.length, risk_critical: riskDist.critical },
    }));
  }, []);

  const subscribeRealtime = useCallback((id: string) => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`live-events-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_events', filter: `casino_id=eq.${id}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const newEvent: LiveEvent = {
            id: raw.id as string,
            event_type: raw.event_type as string,
            casino_id: raw.casino_id as string,
            player_id: raw.player_id as string,
            session_id: raw.session_id as string | null,
            game_id: raw.game_id as string | null,
            machine_id: raw.machine_id as string | null,
            bet_amount: Number(raw.bet_amount),
            win_amount: Number(raw.win_amount),
            balance_after: raw.balance_after != null ? Number(raw.balance_after) : null,
            duration_seconds: Number(raw.duration_seconds) || 0,
            risk_score: Number(raw.risk_score) || 0,
            risk_flags: Array.isArray(raw.risk_flags) ? (raw.risk_flags as string[]) : [],
            outcome: raw.outcome as LiveEvent['outcome'],
            game_type: raw.game_type as string | null,
            is_simulated: Boolean(raw.is_simulated),
            metadata: (raw.metadata as Record<string, unknown>) || {},
            created_at: raw.created_at as string,
          };

          kpiWindowRef.current = [newEvent, ...kpiWindowRef.current].slice(0, 200);

          setData(prev => {
            const updatedEvents = [newEvent, ...prev.liveEvents].slice(0, 80);
            const updatedBets = [eventToLiveBet(newEvent), ...prev.liveBets].slice(0, 20);
            const newKpi = computeKpiFromWindow(kpiWindowRef.current.slice(0, 60), prev.kpi);
            const newPlayer = eventToPlayer(newEvent, 0);

            const existingIdx = prev.players.findIndex(p => p.playerId === newEvent.player_id);
            let updatedPlayers: Player[];
            if (existingIdx >= 0) {
              updatedPlayers = [...prev.players];
              updatedPlayers[existingIdx] = newPlayer;
            } else {
              updatedPlayers = [newPlayer, ...prev.players].slice(0, 100);
            }

            const riskDist = {
              low: updatedPlayers.filter(p => p.riskLevel === 'low').length,
              medium: updatedPlayers.filter(p => p.riskLevel === 'medium').length,
              high: updatedPlayers.filter(p => p.riskLevel === 'high').length,
              critical: updatedPlayers.filter(p => p.riskLevel === 'critical').length,
            };

            const isBetPlaced = newEvent.event_type === 'BET_PLACED';

            const applyBetToPeriod = (m: PeriodMetrics): PeriodMetrics => {
              if (!isBetPlaced) return m;
              const newWagered = m.totalWagered + newEvent.bet_amount;
              const newWon = m.totalWon + newEvent.win_amount;
              const newEvents = m.totalEvents + 1;
              return {
                ...m,
                totalWagered: newWagered,
                totalWon: newWon,
                ggr: newWagered - newWon,
                avgBetSize: newEvents > 0 ? newWagered / newEvents : 0,
                totalEvents: newEvents,
                riskCritical: m.riskCritical + (newEvent.risk_score >= 80 ? 1 : 0),
              };
            };

            // ── Sync activePlayers: add or refresh the incoming player ────────
            const meta = newEvent.metadata as Record<string, unknown>;
            const fullName = (meta?.player_name as string) || `Player …${newEvent.player_id.slice(-6)}`;
            const nameParts = fullName.split(' ');
            const existingActive = prev.activePlayers.find(p => p.player_id === newEvent.player_id);
            let updatedActive: ActivePlayer[];
            if (existingActive) {
              updatedActive = prev.activePlayers.map(p =>
                p.player_id === newEvent.player_id ? { ...p, last_seen: newEvent.created_at } : p
              );
            } else {
              const newActive: ActivePlayer = {
                player_id: newEvent.player_id,
                display_name: fullName,
                first_name: nameParts[0] || 'Player',
                last_name: nameParts.slice(1).join(' ') || newEvent.player_id.slice(-6),
                risk_score: 0, risk_level: 'low',
                loss_escalation_score: 0, session_duration_score: 0,
                deposit_frequency_score: 0, bet_intensity_score: 0,
                cross_operator_score: 0, risk_rationale: null,
                score_delta: 0, intervention_triggered: false,
                analyzed_at: null, last_seen: newEvent.created_at,
                has_risk_profile: false, profile_id: null,
              };
              updatedActive = [newActive, ...prev.activePlayers]
                .sort((a, b) => b.risk_score - a.risk_score)
                .slice(0, 100);
            }

            // Derive all KPI counts from activePlayers — one source of truth
            const activeRiskDist = {
              low:      updatedActive.filter(p => p.risk_score < 40).length,
              medium:   updatedActive.filter(p => p.risk_score >= 40 && p.risk_score < 60).length,
              high:     updatedActive.filter(p => p.risk_score >= 60 && p.risk_score < 80).length,
              critical: updatedActive.filter(p => p.risk_score >= 80).length,
            };
            // Keep KPI's financial metrics from window calc; override player counts from activePlayers
            const syncedKpi = {
              ...newKpi,
              active_players: updatedActive.length,
              risk_critical: activeRiskDist.critical,
            };

            return {
              ...prev,
              liveEvents: updatedEvents,
              liveBets: updatedBets,
              kpi: syncedKpi,
              players: updatedPlayers,
              totalWagered: newKpi.total_wagered,
              totalWon: newKpi.total_won,
              activePlayerCount: updatedActive.length,
              avgBetSize: newKpi.avg_bet_size || prev.avgBetSize,
              riskDistribution: activeRiskDist,
              sessionWagered: isBetPlaced
                ? prev.sessionWagered + newEvent.bet_amount
                : prev.sessionWagered,
              todayMetrics: applyBetToPeriod(prev.todayMetrics),
              thirtyDayMetrics: applyBetToPeriod(prev.thirtyDayMetrics),
              activePlayers: updatedActive,
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'behavioral_risk_profiles', filter: `casino_id=eq.${id}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const profile: RiskProfile = {
            id: raw.id as string,
            player_id: raw.player_id as string,
            casino_id: raw.casino_id as string,
            risk_score: Number(raw.risk_score) || 0,
            risk_level: (raw.risk_level as string) || 'low',
            loss_escalation_score: Number(raw.loss_escalation_score) || 0,
            session_duration_score: Number(raw.session_duration_score) || 0,
            deposit_frequency_score: Number(raw.deposit_frequency_score) || 0,
            bet_intensity_score: Number(raw.bet_intensity_score) || 0,
            cross_operator_score: Number(raw.cross_operator_score) || 0,
            risk_rationale: (raw.risk_rationale as string) || null,
            score_delta: Number(raw.score_delta) || 0,
            intervention_triggered: Boolean(raw.intervention_triggered),
            analyzed_at: raw.analyzed_at as string,
          };
          setData(prev => {
            // Keep latest per player — deduplicated, sorted by risk_score desc
            const others = prev.riskProfiles.filter(p => p.player_id !== profile.player_id);
            const updatedRiskProfiles = [profile, ...others]
              .sort((a, b) => b.risk_score - a.risk_score)
              .slice(0, 60);

            // ── Sync activePlayers: update risk fields for this player ────────
            const updatedActive = prev.activePlayers.map(ap => {
              if (ap.player_id !== profile.player_id) return ap;
              return {
                ...ap,
                risk_score: profile.risk_score,
                risk_level: profile.risk_level as ActivePlayer['risk_level'],
                loss_escalation_score: profile.loss_escalation_score,
                session_duration_score: profile.session_duration_score,
                deposit_frequency_score: profile.deposit_frequency_score,
                bet_intensity_score: profile.bet_intensity_score,
                cross_operator_score: profile.cross_operator_score,
                risk_rationale: profile.risk_rationale,
                score_delta: profile.score_delta,
                intervention_triggered: profile.intervention_triggered,
                analyzed_at: profile.analyzed_at,
                has_risk_profile: true,
                profile_id: profile.id,
              };
            }).sort((a, b) => b.risk_score - a.risk_score);

            const profileRiskDist = {
              low:      updatedActive.filter(p => p.risk_score < 40).length,
              medium:   updatedActive.filter(p => p.risk_score >= 40 && p.risk_score < 60).length,
              high:     updatedActive.filter(p => p.risk_score >= 60 && p.risk_score < 80).length,
              critical: updatedActive.filter(p => p.risk_score >= 80).length,
            };

            return {
              ...prev,
              riskProfiles: updatedRiskProfiles,
              activePlayers: updatedActive,
              riskDistribution: profileRiskDist,
              kpi: { ...prev.kpi, risk_critical: profileRiskDist.critical },
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'intervention_history', filter: `casino_id=eq.${id}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const alert: LiveAlert = {
            id: raw.id as string,
            player_id: raw.player_id as string,
            casino_id: raw.casino_id as string,
            intervention_type: (raw.intervention_type as string) || 'break_suggestion',
            trigger_reason: (raw.trigger_reason as string) || '',
            risk_score_at_trigger: Number(raw.risk_score_at_trigger) || 0,
            delivery_method: (raw.delivery_method as string) || null,
            message_sent: (raw.message_sent as string) || null,
            dispatch_status: (raw.dispatch_status as string) || 'pending',
            triggered_at: (raw.triggered_at as string) || new Date().toISOString(),
            player_response: (raw.player_response as string) || null,
            intervention_successful: raw.intervention_successful != null ? Boolean(raw.intervention_successful) : null,
          };
          setData(prev => ({
            ...prev,
            liveAlerts: [alert, ...prev.liveAlerts].slice(0, 50),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machine_activity', filter: `casino_id=eq.${id}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const machine: MachineStatus = {
            machine_id: raw.machine_id as string,
            machine_type: raw.machine_type as string,
            status: raw.status as MachineStatus['status'],
            current_player_id: raw.current_player_id as string | null,
            spins_per_minute: Number(raw.spins_per_minute),
            current_risk_score: Number(raw.current_risk_score),
            total_wagered_session: Number(raw.total_wagered_session),
            updated_at: raw.updated_at as string,
          };
          setData(prev => {
            const idx = prev.machines.findIndex(m => m.machine_id === machine.machine_id);
            const updatedMachines = [...prev.machines];
            if (idx >= 0) updatedMachines[idx] = machine;
            else updatedMachines.unshift(machine);
            const sliced = updatedMachines.slice(0, 100);
            return {
              ...prev,
              machines: sliced,
              kpi: { ...prev.kpi, active_machines: sliced.filter(m => m.status === 'active').length },
            };
          });
        }
      )
      .subscribe((status) => {
        setData(prev => ({ ...prev, realtimeConnected: status === 'SUBSCRIBED' }));
      });

    realtimeChannelRef.current = channel;
  }, [computeKpiFromWindow]);

  const triggerBurst = useCallback(async (count = 20) => {
    if (!casinoId) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) return;

      await fetch(`${supabaseUrl}/functions/v1/casino-simulator?action=burst&casino_id=${casinoId}&count=${count}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
      });
    } catch {
      // silent – fallback to local simulation below
    }
  }, [casinoId]);

  const refreshData = useCallback(() => {
    if (casinoId) loadInitialData(casinoId);
  }, [casinoId, loadInitialData]);

  // ─── Client-side live feed generator ────────────────────────────────────────
  // Inserts directly into live_events every 3 s using the authenticated Supabase
  // client.  No Edge Function round-trip = zero cold-start latency.
  // Realtime subscription above picks up each INSERT and updates the UI.

  const sessionPoolRef = useRef<{ playerId: string; sessionId: string }[]>([]);

  // Cross-tick state for behavioural continuity — same player escalates across ticks
  interface PlayerTickState {
    archetype: 'normal' | 'at_risk' | 'problem';
    consecutiveLosses: number;
    currentBet: number;      // grows on loss, resets on win
    sessionSeconds: number;  // simulated session length
  }
  const playerStateRef = useRef<Map<string, PlayerTickState>>(new Map());

  const loadSessionPool = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('gaming_sessions')
      .select('id, player_id')
      .eq('casino_id', id)
      .eq('is_active', true)
      .limit(100);
    if (data && data.length > 0) {
      sessionPoolRef.current = data.map((s: { id: string; player_id: string }) => ({
        sessionId: s.id,
        playerId: s.player_id,
      }));
    }
  }, []);

  const fetchPeriodMetrics = useCallback(async (id: string, since: Date): Promise<PeriodMetrics> => {
    const { data: rows } = await supabase
      .from('live_events')
      .select('bet_amount, win_amount, player_id, risk_score')
      .eq('casino_id', id)
      .eq('event_type', 'BET_PLACED')
      .gte('created_at', since.toISOString());
    const r = rows || [];
    const totalWagered = r.reduce((s, e) => s + Number(e.bet_amount), 0);
    const totalWon = r.reduce((s, e) => s + Number(e.win_amount), 0);
    const avgBetSize = r.length > 0 ? totalWagered / r.length : 0;
    return {
      totalWagered,
      totalWon,
      ggr: totalWagered - totalWon,
      avgBetSize,
      totalEvents: r.length,
      uniquePlayers: new Set(r.map(e => e.player_id)).size,
      riskCritical: r.filter(e => Number(e.risk_score) >= 80).length,
    };
  }, []);

  const refreshAllPeriodMetrics = useCallback(async (id: string) => {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const start30Days = new Date(now); start30Days.setDate(start30Days.getDate() - 30);
    const [today, thirtyDay] = await Promise.all([
      fetchPeriodMetrics(id, startOfToday),
      fetchPeriodMetrics(id, start30Days),
    ]);
    setData(prev => ({ ...prev, todayMetrics: today, thirtyDayMetrics: thirtyDay }));
  }, [fetchPeriodMetrics]);

  const generateAndInsert = useCallback(async (id: string) => {
    const pool = sessionPoolRef.current;

    // ── Shared lookup tables ──────────────────────────────────────────────────
    const GAME_TYPES_W = ['slots','slots','slots','blackjack','roulette','poker','baccarat'];
    const BET_BASE: Record<string, number> = { slots:50, blackjack:300, roulette:175, poker:400, baccarat:225 };
    const SA_FIRST = ['Thabo','Sipho','Lerato','Nomvula','Kagiso','Zanele','Tshepo','Palesa','Lungelo','Bongani','Pieter','Ahmed','Ravi','Lindiwe','Neo'];
    const SA_LAST  = ['Dlamini','Nkosi','Mthembu','Zulu','Ndlovu','Sithole','Mkhize','Khumalo','Radebe','Molefe','Van der Merwe','Mohamed','Naidoo','Phiri','Cele'];

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const ri   = (lo: number, hi: number) => Math.floor(lo + Math.random() * (hi - lo + 1));
    const r5   = (n: number) => Math.round(n / 5) * 5;
    const pidHash = (pid: string) => pid.split('').reduce((s, c) => s + c.charCodeAt(0), 0);

    // ── Archetype assignment — deterministic per player ───────────────────────
    // 70 % normal · 20 % at-risk · 10 % problem
    function getArchetype(pid: string): 'normal' | 'at_risk' | 'problem' {
      const h = pidHash(pid) % 10;
      if (h === 0) return 'problem';      // 10 %
      if (h <= 2)  return 'at_risk';      // 20 %
      return 'normal';                    // 70 %
    }

    // ── Guarantee at least one problem and one at-risk player per tick ────────
    // Split pool by archetype; if empty fallback to fixed UUIDs so we always
    // have high-risk signals even on a brand-new session pool.
    const FIXED_PROBLEM_IDS = [
      '00000000-0001-0000-0000-000000000001',
      '00000000-0001-0000-0000-000000000002',
    ];
    const FIXED_ATRISK_IDS = [
      '00000000-0002-0000-0000-000000000001',
      '00000000-0002-0000-0000-000000000002',
      '00000000-0002-0000-0000-000000000003',
    ];

    const problemPool  = pool.filter(p => getArchetype(p.playerId) === 'problem');
    const atRiskPool   = pool.filter(p => getArchetype(p.playerId) === 'at_risk');
    const normalPool   = pool.filter(p => getArchetype(p.playerId) === 'normal');

    const problemEntry = problemPool.length > 0
      ? pick(problemPool)
      : { playerId: pick(FIXED_PROBLEM_IDS), sessionId: crypto.randomUUID() };
    const atRiskEntry  = atRiskPool.length > 0
      ? pick(atRiskPool)
      : { playerId: pick(FIXED_ATRISK_IDS), sessionId: crypto.randomUUID() };
    const normalEntries = Array.from({ length: ri(1, 3) }, () =>
      normalPool.length > 0 ? pick(normalPool) : { playerId: crypto.randomUUID(), sessionId: crypto.randomUUID() }
    );

    // ── Player-state helper — retrieves or initialises cross-tick state ────────
    function getState(pid: string, archetype: 'normal' | 'at_risk' | 'problem'): PlayerTickState {
      if (!playerStateRef.current.has(pid)) {
        const base = BET_BASE[pick(GAME_TYPES_W)] || 100;
        playerStateRef.current.set(pid, {
          archetype,
          consecutiveLosses: 0,
          currentBet: base * (archetype === 'problem' ? 3 : archetype === 'at_risk' ? 1.5 : 1),
          sessionSeconds:
            archetype === 'problem'  ? ri(5400, 7200)  // 90–120 min
            : archetype === 'at_risk' ? ri(2700, 5400) // 45–90 min
            : ri(120, 2400),                           // 2–40 min
        });
      }
      return playerStateRef.current.get(pid)!;
    }

    // ── Row builder helpers ───────────────────────────────────────────────────
    function buildBetRow(
      playerId: string,
      sessionId: string,
      betAmount: number,
      outcome: 'win' | 'loss',
      gameType: string,
      sessionSecs: number,
      riskScore: number,
      riskFlags: string[],
      tsMs: number,
    ) {
      const winAmount = outcome === 'win' ? r5(betAmount * (0.8 + Math.random() * 1.8)) : 0;
      const h = pidHash(playerId);
      const nameFirst = SA_FIRST[h % SA_FIRST.length];
      const nameLast  = SA_LAST[(h + 7) % SA_LAST.length];
      return {
        event_id:         crypto.randomUUID(),
        event_type:       'BET_PLACED',
        casino_id:        id,
        player_id:        playerId,
        session_id:       sessionId,
        game_id:          `GAME-${gameType.toUpperCase()}-${ri(1, 99)}`,
        machine_id:       `M-${String((h % 80) + 1).padStart(3, '0')}`,
        bet_amount:       betAmount,
        win_amount:       winAmount,
        balance_after:    null,
        duration_seconds: sessionSecs,
        risk_score:       riskScore,
        risk_flags:       riskFlags,
        outcome,
        game_type:        gameType,
        is_simulated:     true,
        metadata:         { player_name: `${nameFirst} ${nameLast}`, game_type: gameType, ingest_source: 'simulator' },
        created_at:       new Date(tsMs).toISOString(),
      };
    }

    function buildDepositRow(playerId: string, sessionId: string, amount: number, tsMs: number) {
      const h = pidHash(playerId);
      const nameFirst = SA_FIRST[h % SA_FIRST.length];
      const nameLast  = SA_LAST[(h + 7) % SA_LAST.length];
      return {
        event_id:         crypto.randomUUID(),
        event_type:       'DEPOSIT',
        casino_id:        id,
        player_id:        playerId,
        session_id:       sessionId,
        game_id:          null,
        machine_id:       null,
        bet_amount:       0,
        win_amount:       0,
        balance_after:    amount,
        duration_seconds: 0,
        risk_score:       0,
        risk_flags:       [],
        outcome:          'active' as const,
        game_type:        null,
        is_simulated:     true,
        metadata:         { player_name: `${nameFirst} ${nameLast}`, ingest_source: 'simulator' },
        created_at:       new Date(tsMs).toISOString(),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRows: any[] = [];
    const nowMs = Date.now();

    // ── PROBLEM PLAYER: rapid loss-chasing burst ──────────────────────────────
    // 5–8 consecutive BET_PLACED losses, timestamps 6–15 s apart within the last
    // 90 s so the risk engine's 2-minute rapid-betting window catches them.
    // Bet escalates 25–45 % after each loss (loss-chasing pattern).
    {
      const { playerId, sessionId } = problemEntry;
      const state   = getState(playerId, 'problem');
      const gameType = pick(['slots','slots','blackjack','roulette']);
      const burstLen = ri(5, 8);
      let bet = Math.max(state.currentBet, BET_BASE[gameType] * ri(3, 6)); // start high

      // Deposit spike before the burst (simulates chasing losses with fresh funds)
      const depositAmount = ri(5000, 20000);
      allRows.push(buildDepositRow(playerId, sessionId, depositAmount, nowMs - (burstLen + 1) * 12000));

      for (let i = 0; i < burstLen; i++) {
        // Timestamps staggered 6–15 s apart going backwards from now
        const tsMs = nowMs - (burstLen - i) * ri(6000, 15000);
        const riskScore = Math.min(100, ri(75, 95) + state.consecutiveLosses * 2);
        const riskFlags = ['loss_chasing', 'bet_escalation', 'excessive_time', 'rapid_high_stakes'];

        allRows.push(buildBetRow(
          playerId, sessionId,
          r5(bet), 'loss',
          gameType, state.sessionSeconds,
          riskScore, riskFlags, tsMs,
        ));

        // Escalate bet 25–45 % on each loss
        bet = bet * (1.25 + Math.random() * 0.20);
        state.consecutiveLosses++;
      }

      // Update cross-tick state
      state.currentBet = bet;
      state.sessionSeconds = Math.min(state.sessionSeconds + ri(60, 180), 7200);
    }

    // ── AT-RISK PLAYER: moderate escalation over 2–3 events ──────────────────
    // 60–70 % loss rate, growing bets, extended session, occasional deposit.
    {
      const { playerId, sessionId } = atRiskEntry;
      const state    = getState(playerId, 'at_risk');
      const gameType = pick(GAME_TYPES_W);
      const base     = BET_BASE[gameType] || 100;
      const betCount = ri(2, 3);

      // Occasional deposit spike (40 % chance per tick)
      if (Math.random() < 0.4) {
        const depositAmount = ri(1000, 3500);
        allRows.push(buildDepositRow(playerId, sessionId, depositAmount, nowMs - betCount * 8000 - 5000));
      }

      let bet = Math.max(state.currentBet, base * ri(15, 30) / 10); // 1.5–3× base
      for (let i = 0; i < betCount; i++) {
        const tsMs    = nowMs - (betCount - i) * ri(8000, 20000);
        const isLoss  = Math.random() < 0.65;
        const outcome: 'win' | 'loss' = isLoss ? 'loss' : 'win';
        const riskScore = ri(45, 72);

        const riskFlags: string[] = [];
        if (isLoss && state.consecutiveLosses >= 2) riskFlags.push('loss_chasing');
        if (state.sessionSeconds > 2700)            riskFlags.push('excessive_time');
        if (bet > base * 2)                         riskFlags.push('bet_escalation');

        allRows.push(buildBetRow(
          playerId, sessionId,
          r5(bet), outcome,
          gameType, state.sessionSeconds,
          riskScore, riskFlags, tsMs,
        ));

        if (isLoss) {
          state.consecutiveLosses++;
          bet = bet * (1.15 + Math.random() * 0.15); // 15–30 % escalation
        } else {
          state.consecutiveLosses = 0;
          bet = base * (0.8 + Math.random() * 0.6);   // reset to near base on win
        }
      }

      state.currentBet = bet;
      state.sessionSeconds = Math.min(state.sessionSeconds + ri(30, 90), 5400);
    }

    // ── NORMAL PLAYERS: low-risk random events ────────────────────────────────
    // Standard mixed event stream — keeps the feed busy with low-risk traffic.
    const NORMAL_EVENT_POOL = [
      ...Array(60).fill('BET_PLACED'),
      ...Array(10).fill('DEPOSIT'),
      ...Array(8).fill('WITHDRAWAL'),
      ...Array(12).fill('SESSION_START'),
      ...Array(10).fill('SESSION_END'),
    ];

    for (const { playerId, sessionId } of normalEntries) {
      const state    = getState(playerId, 'normal');
      const eventType = pick(NORMAL_EVENT_POOL);
      const gameType  = pick(GAME_TYPES_W);
      const base      = BET_BASE[gameType] || 100;
      const h         = pidHash(playerId);
      const baseRisk  = (h % 30) + 5; // 5–34

      if (eventType === 'BET_PLACED') {
        const betAmount  = r5(base * (0.4 + Math.random() * 1.2));
        const isWin      = Math.random() > 0.45;
        const riskScore  = Math.min(55, baseRisk + (isWin ? 0 : ri(0, 8)));
        const nameFirst  = SA_FIRST[h % SA_FIRST.length];
        const nameLast   = SA_LAST[(h + 7) % SA_LAST.length];
        allRows.push({
          event_id:         crypto.randomUUID(),
          event_type:       'BET_PLACED',
          casino_id:        id,
          player_id:        playerId,
          session_id:       sessionId,
          game_id:          `GAME-${gameType.toUpperCase()}-${ri(1, 99)}`,
          machine_id:       `M-${String((h % 80) + 1).padStart(3, '0')}`,
          bet_amount:       betAmount,
          win_amount:       isWin ? r5(betAmount * (0.7 + Math.random() * 1.5)) : 0,
          balance_after:    null,
          duration_seconds: state.sessionSeconds,
          risk_score:       riskScore,
          risk_flags:       [],
          outcome:          isWin ? 'win' : 'loss',
          game_type:        gameType,
          is_simulated:     true,
          metadata:         { player_name: `${nameFirst} ${nameLast}`, game_type: gameType, ingest_source: 'simulator' },
          created_at:       new Date(nowMs - ri(0, 5000)).toISOString(),
        });
      } else {
        // SESSION / DEPOSIT / WITHDRAWAL — no bet amount
        const nameFirst = SA_FIRST[h % SA_FIRST.length];
        const nameLast  = SA_LAST[(h + 7) % SA_LAST.length];
        allRows.push({
          event_id:         crypto.randomUUID(),
          event_type:       eventType,
          casino_id:        id,
          player_id:        playerId,
          session_id:       sessionId,
          game_id:          `GAME-${gameType.toUpperCase()}-${ri(1, 99)}`,
          machine_id:       `M-${String((h % 80) + 1).padStart(3, '0')}`,
          bet_amount:       0,
          win_amount:       0,
          balance_after:    eventType === 'DEPOSIT' ? ri(200, 3000) : eventType === 'WITHDRAWAL' ? ri(0, 2000) : null,
          duration_seconds: state.sessionSeconds,
          risk_score:       baseRisk,
          risk_flags:       [],
          outcome:          'active',
          game_type:        gameType,
          is_simulated:     true,
          metadata:         { player_name: `${nameFirst} ${nameLast}`, game_type: gameType, ingest_source: 'simulator' },
          created_at:       new Date(nowMs - ri(0, 5000)).toISOString(),
        });
      }

      state.sessionSeconds = Math.min(state.sessionSeconds + ri(10, 45), 2400);
    }

    // ── Prune stale player states (keep memory bounded) ───────────────────────
    if (playerStateRef.current.size > 200) {
      const keys = Array.from(playerStateRef.current.keys());
      keys.slice(0, 50).forEach(k => playerStateRef.current.delete(k));
    }

    await supabase.from('live_events').insert(allRows);
  }, []);

  useEffect(() => {
    if (!casinoId) return;

    setData(prev => ({ ...prev, isSimulating: true }));
    loadInitialData(casinoId);
    subscribeRealtime(casinoId);
    loadSessionPool(casinoId);
    refreshAllPeriodMetrics(casinoId);

    // Seed an initial burst via Edge Function (also warms up sessions + machine_activity)
    triggerBurst(30);

    // Client-side tick: 3-second interval, 2–5 events per tick ≈ 60–100 events/min
    burstTimerRef.current = setInterval(() => {
      generateAndInsert(casinoId);
    }, 3000);

    // Refresh session pool every 2 minutes so new sessions are included
    const poolTimer = setInterval(() => loadSessionPool(casinoId), 120_000);

    // Re-sync period metrics from DB every 60s (authoritative baseline)
    const periodMetricsTimer = setInterval(() => refreshAllPeriodMetrics(casinoId), 60_000);

    // Rebuild unified active player list every 2 min to prune players who have gone inactive
    const activePlayersTimer = setInterval(() => loadActivePlayers(casinoId), 120_000);

    return () => {
      if (burstTimerRef.current) clearInterval(burstTimerRef.current);
      clearInterval(poolTimer);
      clearInterval(periodMetricsTimer);
      clearInterval(activePlayersTimer);
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    };
  }, [casinoId]);

  return (
    <CasinoDataContext.Provider value={{ data, triggerBurst, refreshData }}>
      {children}
    </CasinoDataContext.Provider>
  );
}

export function useCasinoData() {
  const context = useContext(CasinoDataContext);
  if (context === undefined) {
    throw new Error('useCasinoData must be used within a CasinoDataProvider');
  }
  return context;
}
