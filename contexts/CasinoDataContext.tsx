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

  // ─── Client-side live feed generator ────────────────────────────────────────
  // Inserts directly into live_events every 3 s using the authenticated Supabase
  // client.  No Edge Function round-trip = zero cold-start latency.
  // Realtime subscription above picks up each INSERT and updates the UI.

  const sessionPoolRef = useRef<{ playerId: string; sessionId: string }[]>([]);

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

  const generateAndInsert = useCallback(async (id: string) => {
    const pool = sessionPoolRef.current;
    const batchSize = 2 + Math.floor(Math.random() * 4); // 2–5 events per tick

    const GAME_TYPES_W = ['slots','slots','slots','blackjack','roulette','poker','baccarat'];
    const BET_BASE: Record<string, number> = { slots:50, blackjack:300, roulette:175, poker:400, baccarat:225 };
    const HOUSE_EDGE: Record<string, number> = { slots:0.055, blackjack:0.005, roulette:0.027, poker:0.030, baccarat:0.012 };
    const SA_FIRST = ['Thabo','Sipho','Lerato','Nomvula','Kagiso','Zanele','Tshepo','Palesa','Lungelo','Bongani','Pieter','Ahmed','Ravi','Lindiwe','Neo'];
    const SA_LAST  = ['Dlamini','Nkosi','Mthembu','Zulu','Ndlovu','Sithole','Mkhize','Khumalo','Radebe','Molefe','Van der Merwe','Mohamed','Naidoo','Phiri','Cele'];

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const ri = (lo: number, hi: number) => Math.floor(lo + Math.random() * (hi - lo + 1));
    const r5 = (n: number) => Math.round(n / 5) * 5;

    // Event type weights — roughly realistic casino floor mix
    // 60% BET_PLACED · 10% DEPOSIT · 8% WITHDRAWAL · 12% SESSION_START · 10% SESSION_END
    const EVENT_TYPE_ROLLS = [
      ...Array(60).fill('BET_PLACED'),
      ...Array(10).fill('DEPOSIT'),
      ...Array(8).fill('WITHDRAWAL'),
      ...Array(12).fill('SESSION_START'),
      ...Array(10).fill('SESSION_END'),
    ];

    const rows = Array.from({ length: batchSize }, () => {
      const poolEntry = pool.length > 0 ? pick(pool) : null;
      const playerId  = poolEntry?.playerId ?? crypto.randomUUID();
      const sessionId = poolEntry?.sessionId ?? crypto.randomUUID();

      const gameType  = pick(GAME_TYPES_W);
      const base      = BET_BASE[gameType] || 100;
      const betAmount = r5(base * (0.4 + Math.random() * 2.2));
      const edge      = HOUSE_EDGE[gameType] || 0.04;
      const isWin     = Math.random() > edge * 3;
      const winAmount = isWin ? r5(betAmount * (0.7 + Math.random() * 2.5)) : 0;

      // Risk logic ─────────────────────────────────────────────────────────────
      // Base risk from a seeded hash of the playerId so the same player drifts
      // consistently rather than jumping randomly on each event.
      const pidHash   = playerId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const baseRisk  = (pidHash % 55) + 10;                // 10–64 typical range

      // Behavioural flags
      const flagLoss  = !isWin && Math.random() < 0.25;     // loss chasing signal
      const flagTime  = Math.random() < 0.12;               // long session
      const flagEsc   = betAmount > base * 2 && Math.random() < 0.40; // bet escalation
      const flagRapid = betAmount > base * 3 && Math.random() < 0.20; // rapid high stakes

      const riskFlags: string[] = [];
      if (flagLoss)  riskFlags.push('loss_chasing');
      if (flagTime)  riskFlags.push('excessive_time');
      if (flagEsc)   riskFlags.push('bet_escalation');
      if (flagRapid) riskFlags.push('rapid_high_stakes');

      const riskBoost = (flagLoss ? 18 : 0) + (flagTime ? 9 : 0) + (flagEsc ? 12 : 0) + (flagRapid ? 14 : 0) + ri(0, 6);
      const riskScore = Math.min(100, Math.max(0, baseRisk + riskBoost));

      const eventType = pick(EVENT_TYPE_ROLLS);
      const nameFirst = SA_FIRST[pidHash % SA_FIRST.length];
      const nameLast  = SA_LAST[(pidHash + 7) % SA_LAST.length];

      // For non-bet events, amounts make contextual sense
      const isBet      = eventType === 'BET_PLACED';
      const isDeposit  = eventType === 'DEPOSIT';
      const isWithdraw = eventType === 'WITHDRAWAL';
      const finalBet   = isBet ? betAmount : 0;
      const finalWin   = isBet ? winAmount : 0;

      return {
        event_id:                crypto.randomUUID(),
        event_type:              eventType,
        casino_id:               id,
        player_id:               playerId,
        session_id:              sessionId,
        game_id:                 `GAME-${gameType.toUpperCase()}-${ri(1, 99)}`,
        machine_id:              `M-${String(ri(1, 80)).padStart(3, '0')}`,
        bet_amount:              finalBet,
        win_amount:              finalWin,
        balance_after:           isDeposit ? ri(500, 10000) : isWithdraw ? ri(0, 5000) : null,
        duration_seconds:        ri(30, 7200),
        risk_score:              riskScore,
        risk_flags:              riskFlags,
        outcome:                 isBet ? (isWin ? 'win' : 'loss') : 'active',
        game_type:               gameType,
        is_simulated:            true,
        metadata: {
          player_name:   `${nameFirst} ${nameLast}`,
          game_type:     gameType,
          ingest_source: 'simulator',
        },
        created_at: new Date().toISOString(),
      };
    });

    await supabase.from('live_events').insert(rows);
  }, []);

  useEffect(() => {
    if (!casinoId) return;

    setData(prev => ({ ...prev, isSimulating: true }));
    loadInitialData(casinoId);
    subscribeRealtime(casinoId);
    loadSessionPool(casinoId);

    // Seed an initial burst via Edge Function (also warms up sessions + machine_activity)
    triggerBurst(30);

    // Client-side tick: 3-second interval, 2–5 events per tick ≈ 60–100 events/min
    burstTimerRef.current = setInterval(() => {
      generateAndInsert(casinoId);
    }, 3000);

    // Refresh session pool every 2 minutes so new sessions are included
    const poolTimer = setInterval(() => loadSessionPool(casinoId), 120_000);

    return () => {
      if (burstTimerRef.current) clearInterval(burstTimerRef.current);
      clearInterval(poolTimer);
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
