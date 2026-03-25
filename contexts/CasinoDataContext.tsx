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
    activePlayers: 0,
    totalPlayers: 0,
    avgBetSize: 385,
    riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
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
    const [eventsRes, kpiRes, machinesRes] = await Promise.all([
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

            return {
              ...prev,
              liveEvents: updatedEvents,
              liveBets: updatedBets,
              kpi: newKpi,
              players: updatedPlayers,
              totalWagered: newKpi.total_wagered,
              totalWon: newKpi.total_won,
              activePlayers: newKpi.active_players,
              avgBetSize: newKpi.avg_bet_size || prev.avgBetSize,
              riskDistribution: riskDist,
            };
          });
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

  useEffect(() => {
    if (!casinoId) return;

    setData(prev => ({ ...prev, isSimulating: true }));
    loadInitialData(casinoId);
    subscribeRealtime(casinoId);

    triggerBurst(30);

    burstTimerRef.current = setInterval(() => {
      triggerBurst(Math.floor(Math.random() * 8) + 3);
    }, 30000);

    return () => {
      if (burstTimerRef.current) clearInterval(burstTimerRef.current);
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
