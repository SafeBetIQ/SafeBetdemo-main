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
  activePlayers: number;
  totalPlayers: number;
  avgBetSize: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
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

const GAME_TYPES = ['slots', 'slots', 'slots', 'blackjack', 'roulette', 'poker', 'baccarat', 'live_dealer'];
const EVENT_TYPES_LOCAL = [
  'BET_PLACED','BET_PLACED','BET_PLACED','BET_PLACED','BET_PLACED',
  'BET_PLACED','BET_PLACED','BET_PLACED',
  'DEPOSIT','DEPOSIT',
  'WITHDRAWAL',
  'SESSION_START',
  'RISK_ALERT',
];
const BASE_BET_SIZES: Record<string, number> = {
  slots: 50, blackjack: 300, roulette: 175, poker: 400, baccarat: 225, live_dealer: 350,
};
const DEPOSIT_AMOUNTS = [500,1000,1500,2000,3000,5000,10000,250,750,1200,2500,4000];
const WITHDRAWAL_AMOUNTS = [500,800,1000,1500,2000,3000,200,350,600,900,1400,2200];
const DEPOSIT_METHODS = ['EFT','Card','Ozow','PayFast','Capitec Pay'];
const ALERT_REASONS = ['prolonged_session','loss_chasing_pattern','rapid_bet_escalation','velocity_breach'];
const INTERVENTION_TRIGGERS: Intervention['triggerType'][] = [
  'high_risk', 'rapid_betting', 'session_duration', 'loss_chasing', 'bet_escalation',
];
const INTERVENTION_CHANNELS: Intervention['channel'][] = ['WhatsApp', 'Email', 'SMS'];
const INTERVENTION_REASONS = [
  'AI detected prolonged session — responsible gambling prompt sent',
  'Loss chasing pattern identified — cooling-off message triggered',
  'Rapid bet escalation — SafeBet AI intervention activated',
  'Risk score exceeded threshold — WhatsApp wellness check sent',
  'Velocity breach detected — automated compliance intervention',
];

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
  { first: 'Johan', last: 'Du Plessis' },
  { first: 'Lindiwe', last: 'Radebe' },
  { first: 'Kagiso', last: 'Molefe' },
  { first: 'Neo', last: 'Phiri' },
  { first: 'Sandile', last: 'Buthelezi' },
  { first: 'Busisiwe', last: 'Cele' },
  { first: 'Lungelo', last: 'Ngcobo' },
  { first: 'Nandi', last: 'Mahlangu' },
  { first: 'Vusi', last: 'Vilakazi' },
  { first: 'Nokuthula', last: 'Gumede' },
  { first: 'Heinrich', last: 'Louw' },
  { first: 'Cornê', last: 'Pretorius' },
  { first: 'Sifiso', last: 'Shabalala' },
  { first: 'Thandeka', last: 'Xulu' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

// Generate a realistic local event for fallback simulation
function generateLocalEvent(casinoId: string): LiveEvent {
  const name = pick(SA_NAMES);
  const playerSuffix = String(randInt(1000, 9999));
  const playerId = `sim-${name.first.toLowerCase()}-${playerSuffix}`;
  const playerName = `${name.first} ${name.last}`;
  const gameType = pick(GAME_TYPES);
  const eventType = pick(EVENT_TYPES_LOCAL);
  const betBase = BASE_BET_SIZES[gameType] ?? 100;
  const now = new Date(Date.now() - randInt(0, 8000)).toISOString();
  const baseRisk = randInt(5, 70);

  if (eventType === 'DEPOSIT') {
    const amount = pick(DEPOSIT_AMOUNTS);
    return {
      id: `local-${crypto.randomUUID()}`,
      event_type: 'DEPOSIT',
      casino_id: casinoId,
      player_id: playerId,
      session_id: null,
      game_id: null,
      machine_id: null,
      bet_amount: amount,
      win_amount: 0,
      balance_after: amount + randInt(0, 5000),
      duration_seconds: 0,
      risk_score: Math.min(100, baseRisk + (amount > 3000 ? randInt(10, 25) : randInt(0, 8))),
      risk_flags: amount > 5000 ? ['large_deposit'] : [],
      outcome: 'active',
      game_type: gameType,
      is_simulated: true,
      metadata: { player_name: playerName, deposit_method: pick(DEPOSIT_METHODS), amount },
      created_at: now,
    };
  }

  if (eventType === 'WITHDRAWAL') {
    const amount = pick(WITHDRAWAL_AMOUNTS);
    return {
      id: `local-${crypto.randomUUID()}`,
      event_type: 'WITHDRAWAL',
      casino_id: casinoId,
      player_id: playerId,
      session_id: null,
      game_id: null,
      machine_id: null,
      bet_amount: amount,
      win_amount: 0,
      balance_after: randInt(0, 3000),
      duration_seconds: 0,
      risk_score: Math.max(0, baseRisk - randInt(5, 15)),
      risk_flags: [],
      outcome: 'active',
      game_type: gameType,
      is_simulated: true,
      metadata: { player_name: playerName, withdrawal_method: pick(['EFT','Card','Ozow']), amount },
      created_at: now,
    };
  }

  if (eventType === 'SESSION_START') {
    return {
      id: `local-${crypto.randomUUID()}`,
      event_type: 'SESSION_START',
      casino_id: casinoId,
      player_id: playerId,
      session_id: null,
      game_id: null,
      machine_id: `M-${String(randInt(1, 80)).padStart(3, '0')}`,
      bet_amount: 0,
      win_amount: 0,
      balance_after: randInt(500, 10000),
      duration_seconds: 0,
      risk_score: baseRisk,
      risk_flags: [],
      outcome: 'active',
      game_type: gameType,
      is_simulated: true,
      metadata: { player_name: playerName, device: pick(['desktop','mobile','tablet']), entry_point: pick(['lobby','direct_link','promo']) },
      created_at: now,
    };
  }

  if (eventType === 'RISK_ALERT') {
    const alertRisk = Math.min(100, baseRisk + randInt(20, 40));
    return {
      id: `local-${crypto.randomUUID()}`,
      event_type: 'RISK_ALERT',
      casino_id: casinoId,
      player_id: playerId,
      session_id: null,
      game_id: null,
      machine_id: `M-${String(randInt(1, 80)).padStart(3, '0')}`,
      bet_amount: 0,
      win_amount: 0,
      balance_after: null,
      duration_seconds: randInt(1800, 7200),
      risk_score: alertRisk,
      risk_flags: ['ai_flagged', 'pattern_detected'],
      outcome: 'active',
      game_type: gameType,
      is_simulated: true,
      metadata: { player_name: playerName, alert_reason: pick(ALERT_REASONS), model_version: 'SafeBet-AI-v2.4' },
      created_at: now,
    };
  }

  // BET_PLACED
  const betAmount = Math.round(betBase * (0.5 + Math.random() * 2.0) / 5) * 5;
  const isWin = Math.random() > 0.52;
  const winAmount = isWin ? Math.round(betAmount * (0.8 + Math.random() * 2.4) / 5) * 5 : 0;
  const riskFlags: string[] = [];
  if (Math.random() < 0.15) riskFlags.push('loss_chasing');
  if (Math.random() < 0.08) riskFlags.push('excessive_time');
  if (Math.random() < 0.06) riskFlags.push('bet_escalation');
  const riskBoost = riskFlags.length * randInt(8, 18) + randInt(0, 8);
  const riskScore = Math.min(100, Math.max(0, baseRisk + riskBoost));

  return {
    id: `local-${crypto.randomUUID()}`,
    event_type: 'BET_PLACED',
    casino_id: casinoId,
    player_id: playerId,
    session_id: null,
    game_id: `GAME-${gameType.toUpperCase()}-${randInt(1, 99)}`,
    machine_id: `M-${String(randInt(1, 80)).padStart(3, '0')}`,
    bet_amount: betAmount,
    win_amount: winAmount,
    balance_after: null,
    duration_seconds: randInt(30, 5400),
    risk_score: riskScore,
    risk_flags: riskFlags,
    outcome: isWin ? 'win' : 'loss',
    game_type: gameType,
    is_simulated: true,
    metadata: { player_name: playerName, game_type: gameType },
    created_at: now,
  };
}

function maybeGenerateIntervention(event: LiveEvent, playerName: string): Intervention | null {
  if (event.risk_score < 80) return null;
  if (Math.random() > 0.35) return null;
  return {
    id: `iv-${crypto.randomUUID()}`,
    playerName,
    playerId: event.player_id,
    channel: pick(INTERVENTION_CHANNELS),
    status: pick(['sent', 'delivered', 'sent', 'sent']),
    timestamp: new Date(),
    reason: pick(INTERVENTION_REASONS),
    riskScore: event.risk_score,
    automated: true,
    triggerType: pick(INTERVENTION_TRIGGERS),
  };
}

export function CasinoDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const rawCasinoId = (user as unknown as Record<string, unknown>)?.casino_id as string | undefined;
  const isSuperAdmin = (user as unknown as Record<string, unknown>)?.role === 'super_admin';
  const [resolvedCasinoId, setResolvedCasinoId] = useState<string | undefined>(rawCasinoId);
  const casinoId = resolvedCasinoId;

  useEffect(() => {
    if (rawCasinoId) { setResolvedCasinoId(rawCasinoId); return; }
    if (isSuperAdmin) {
      supabase.from('casinos').select('id').eq('is_active', true).order('name').limit(1).maybeSingle()
        .then(({ data }) => { if (data?.id) setResolvedCasinoId(data.id); });
    }
  }, [rawCasinoId, isSuperAdmin]);

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
    activePlayers: 0,
    totalPlayers: 0,
    avgBetSize: 385,
    riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
  });

  const burstTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const ingestEvent = useCallback((newEvent: LiveEvent) => {
    kpiWindowRef.current = [newEvent, ...kpiWindowRef.current].slice(0, 200);

    setData(prev => {
      const updatedEvents = [newEvent, ...prev.liveEvents].slice(0, 120);
      const updatedBets = [eventToLiveBet(newEvent), ...prev.liveBets].slice(0, 20);
      const newKpi = computeKpiFromWindow(kpiWindowRef.current.slice(0, 60), prev.kpi);
      const newPlayer = eventToPlayer(newEvent, 0);
      const playerName = playerNameFromEvent(newEvent);

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

      const newIntervention = maybeGenerateIntervention(newEvent, playerName);
      const updatedInterventions = newIntervention
        ? [newIntervention, ...prev.interventions].slice(0, 50)
        : prev.interventions;

      return {
        ...prev,
        liveEvents: updatedEvents,
        liveBets: updatedBets,
        kpi: newKpi,
        players: updatedPlayers,
        interventions: updatedInterventions,
        totalWagered: newKpi.total_wagered,
        totalWon: newKpi.total_won,
        activePlayers: newKpi.active_players,
        avgBetSize: newKpi.avg_bet_size || prev.avgBetSize,
        riskDistribution: riskDist,
      };
    });
  }, [computeKpiFromWindow]);

  const loadInitialData = useCallback(async (id: string) => {
    const [eventsRes, kpiRes, machinesRes] = await Promise.all([
      supabase
        .from('live_events')
        .select('*')
        .eq('casino_id', id)
        .order('created_at', { ascending: false })
        .limit(80),
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

    kpiWindowRef.current = events.slice(0, 60);

    const players = events.slice(0, 50).map((e, i) => eventToPlayer(e, i));
    const liveBets = events.slice(0, 20).map(e => eventToLiveBet(e));
    const riskDist = {
      low: players.filter(p => p.riskLevel === 'low').length,
      medium: players.filter(p => p.riskLevel === 'medium').length,
      high: players.filter(p => p.riskLevel === 'high').length,
      critical: players.filter(p => p.riskLevel === 'critical').length,
    };

    setData(prev => ({
      ...prev,
      liveEvents: events,
      players,
      liveBets,
      kpi,
      machines,
      totalWagered: kpi.total_wagered,
      totalWon: kpi.total_won,
      activePlayers: kpi.active_players,
      totalPlayers: players.length,
      avgBetSize: kpi.avg_bet_size || 385,
      riskDistribution: riskDist,
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
          ingestEvent(newEvent);
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
  }, [ingestEvent]);

  const triggerBurst = useCallback(async (count = 30) => {
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
      // silent — local simulation covers the gap
    }
  }, [casinoId]);

  const refreshData = useCallback(() => {
    if (casinoId) loadInitialData(casinoId);
  }, [casinoId, loadInitialData]);

  useEffect(() => {
    if (!casinoId) return;

    setData(prev => ({ ...prev, isSimulating: true }));
    loadInitialData(casinoId);
    subscribeRealtime(casinoId);

    // Initial burst to populate immediately
    triggerBurst(40);

    // Remote bursts every 8 seconds to keep the DB feed alive
    burstTimerRef.current = setInterval(() => {
      triggerBurst(Math.floor(Math.random() * 15) + 20);
    }, 8000);

    // Local tick every 1.5–3s: inject 1–3 events directly into state
    // This ensures the feed always looks live regardless of network latency
    const scheduleTick = () => {
      const delay = randInt(1500, 3000);
      localTickRef.current = setTimeout(() => {
        const count = randInt(1, 3);
        for (let i = 0; i < count; i++) {
          ingestEvent(generateLocalEvent(casinoId));
        }
        scheduleTick();
      }, delay) as unknown as ReturnType<typeof setInterval>;
    };
    scheduleTick();

    return () => {
      if (burstTimerRef.current) clearInterval(burstTimerRef.current);
      if (localTickRef.current) clearTimeout(localTickRef.current as unknown as ReturnType<typeof setTimeout>);
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
