'use client';

// ─── Casino live data — Enterprise Consumer Platform client (Phase 3.7) ──────
//
// This context is a CONSUMER. It owns no business logic, no runtime state,
// no calculations and no simulation. Everything it renders comes from the
// ONE enterprise flow:
//
//   Event Platform → Projections → Digital Twin → Intelligence → Policy
//     → Enterprise Consumer Platform (consumer-gateway)  ← shaped views
//     → Realtime distribution (casino_event_log / projection_machine_state)
//
// It fetches shaped presentation contracts from the consumer-gateway,
// receives the platform's Realtime distribution (shaped with the Consumer
// Platform's own shapers), and periodically triggers the casino-simulator
// producer so the demo floor stays live. The pre-3.7 browser session-pool
// simulation — the last duplicate runtime model — is GONE.

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase, readAccessTokenFast } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import {
  shapeEventRow, shapeMachineRow,
  type LiveEventView, type LiveKpiView, type MachineStatusView,
  type PlayerView, type InterventionView,
  type OperatorLiveFloorView, type ActivityFeedView,
} from '@/lib/consumerPlatform';

// ─── Presentation types consumed by dashboard components ─────────────────────
// These remain the stable shapes components render. Events/KPIs/machines are
// the Consumer Platform's v1 contracts verbatim; Player/Intervention convert
// contract timestamps into Date for existing component code.

export type LiveEvent = LiveEventView;
export type LiveKpi = LiveKpiView;
export type MachineStatus = MachineStatusView;

export interface Player {
  id: string;
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
  playerId: string;
  // Evidence integrity (Constitution §8): delivery channel/status are NOT
  // recorded by the platform — reported as 'unrecorded' / 'recorded', never
  // fabricated. The intervention count/timestamp are Recorded Facts; the
  // trigger type is Derived Intelligence.
  evidenceClass: 'recorded-fact';
  channel: 'unrecorded';
  status: 'recorded';
  timestamp: Date;
  interventionCount: number;
  reason: string;
  riskScore: number;
  triggerType: 'high_risk' | 'rapid_betting' | 'session_duration' | 'loss_chasing' | 'bet_escalation';
  triggerSource: 'derived-intelligence';
}

interface LiveBetLegacy {
  id: string;
  playerId: string;
  game: string;
  betAmount: number;
  outcome: 'win' | 'loss' | 'active';
  winAmount?: number;
  timestamp: Date;
  riskScore: number;
}

interface CasinoData {
  liveEvents: LiveEvent[];
  players: Player[];
  interventions: Intervention[];
  kpi: LiveKpi;
  machines: MachineStatus[];
  isSimulating: boolean;
  realtimeConnected: boolean;
  kpiLoaded: boolean;
  liveBets: LiveBetLegacy[];
  totalWagered: number;
  totalWon: number;
  activePlayers: number;
  totalPlayers: number;
  avgBetSize: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
}

interface CasinoDataContextType {
  data: CasinoData;
  triggerBurst: (count?: number) => Promise<void>;
  refreshData: () => void;
}

const DEFAULT_KPI: LiveKpi = {
  active_players: 0, active_sessions: 0, idle_sessions: 0, stale_sessions: 0, open_sessions: 0,
  players_active_now: 0, players_idle: 0, players_stale: 0,
  machines_in_play: 0, machines_stale: 0, registered_machines: 0,
  events_per_min: 0, total_wagered: 0, total_won: 0,
  ggr: 0, avg_bet_size: 0, risk_critical: 0, risk_high: 0, risk_medium: 0, risk_low: 0,
  risk_unclassified: 0, active_machines: 0, snapshot_at: new Date().toISOString(),
};

const GATEWAY_REFRESH_MS = 10_000;   // shaped-view refresh cadence
const BURST_INTERVAL_MS = 10_000;    // producer trigger cadence (unchanged)

const BET_EVENT_TYPES = ['BET_PLACED', 'JACKPOT', 'DEPOSIT', 'WITHDRAWAL'];

function eventToLiveBet(e: LiveEvent): LiveBetLegacy {
  return {
    id: e.id,
    playerId: e.player_id,
    game: e.game_type ?? 'slots',
    betAmount: e.bet_amount,
    outcome: e.outcome === 'win' ? 'win' : e.outcome === 'loss' ? 'loss' : 'active',
    winAmount: e.win_amount > 0 ? e.win_amount : undefined,
    timestamp: new Date(e.created_at),
    riskScore: e.risk_score,
  };
}

function toPlayer(view: PlayerView): Player {
  return { ...view, lastBetTime: new Date(view.lastBetTime) };
}

function toIntervention(view: InterventionView): Intervention {
  return { ...view, timestamp: new Date(view.timestamp) };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CasinoDataContext = createContext<CasinoDataContextType | undefined>(undefined);

export function CasinoDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const rawCasinoId = (user as unknown as Record<string, unknown>)?.casino_id as string | undefined;
  const role = (user as unknown as Record<string, unknown>)?.role as string | undefined;
  const isSuperAdmin = role === 'super_admin';
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
    kpiLoaded: false,
    liveBets: [],
    totalWagered: 0,
    totalWon: 0,
    activePlayers: 0,
    totalPlayers: 0,
    avgBetSize: 0,
    riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
  });

  const burstTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Consumer Platform gateway client ─────────────────────────────────────

  const callGateway = useCallback(async <T,>(id: string, view: string): Promise<T | null> => {
    try {
      let token = readAccessTokenFast();
      if (!token) token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!token || !supabaseUrl || !anonKey) return null;
      // Identity is server-derived from the verified JWT (Phase 4.1) —
      // parameters only select the view and target casino.
      const res = await fetch(
        `${supabaseUrl}/functions/v1/consumer-gateway?view=${view}&casino_id=${id}&version=v1`,
        { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } },
      );
      if (!res.ok) return null;
      const body = await res.json();
      return (body?.data ?? null) as T | null;
    } catch {
      return null;
    }
  }, []);

  const refreshFromGateway = useCallback(async (id: string) => {
    const [floor, feed] = await Promise.all([
      callGateway<OperatorLiveFloorView>(id, 'live-floor'),
      callGateway<ActivityFeedView>(id, 'activity-feed'),
    ]);
    if (!floor && !feed) return;

    setData(prev => {
      const events = feed?.events ?? prev.liveEvents;
      const kpi = floor?.kpi ?? prev.kpi;
      const players = floor ? floor.players.map(toPlayer) : prev.players;
      return {
        ...prev,
        kpiLoaded: floor ? true : prev.kpiLoaded,
        liveEvents: events.slice(0, 120),
        liveBets: events.filter(e => BET_EVENT_TYPES.includes(e.event_type))
          .slice(0, 20).map(eventToLiveBet),
        kpi,
        machines: floor?.machines ?? prev.machines,
        players,
        interventions: floor ? floor.interventions.map(toIntervention) : prev.interventions,
        totalWagered: kpi.total_wagered,
        totalWon: kpi.total_won,
        activePlayers: kpi.active_players,
        totalPlayers: players.length,
        avgBetSize: kpi.avg_bet_size,
        riskDistribution: {
          low: kpi.risk_low, medium: kpi.risk_medium,
          high: kpi.risk_high, critical: kpi.risk_critical,
        },
      };
    });
  }, [callGateway]);

  // ─── Platform Realtime distribution (shaped with Consumer Platform shapers) ─

  const subscribeRealtime = useCallback((id: string) => {
    if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);

    const channel = supabase
      .channel(`consumer-distribution-${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'casino_event_log', filter: `casino_id=eq.${id}` },
        (payload) => {
          const event = shapeEventRow(payload.new as Record<string, unknown>);
          setData(prev => ({
            ...prev,
            liveEvents: [event, ...prev.liveEvents].slice(0, 120),
            liveBets: BET_EVENT_TYPES.includes(event.event_type)
              ? [eventToLiveBet(event), ...prev.liveBets].slice(0, 20)
              : prev.liveBets,
          }));
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'projection_machine_state', filter: `casino_id=eq.${id}` },
        (payload) => {
          const machine = shapeMachineRow(payload.new as Record<string, unknown>);
          setData(prev => {
            const idx = prev.machines.findIndex(m => m.machine_id === machine.machine_id);
            if (idx < 0) return { ...prev, machines: [machine, ...prev.machines].slice(0, 100) };
            const machines = [...prev.machines];
            machines[idx] = { ...machines[idx], ...machine };
            return { ...prev, machines };
          });
        }
      )
      .subscribe((status) => {
        setData(prev => ({ ...prev, realtimeConnected: status === 'SUBSCRIBED' }));
      });

    realtimeChannelRef.current = channel;
  }, []);

  // ─── Producer trigger (the casino-simulator is the event source) ──────────

  const triggerBurst = useCallback(async (count = 30) => {
    if (!casinoId) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) return;
      await fetch(
        `${supabaseUrl}/functions/v1/casino-simulator?action=burst&casino_id=${casinoId}&count=${count}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            apikey: anonKey,
          },
        }
      );
    } catch {
      // The floor stays on its last shaped view until the next refresh.
    }
  }, [casinoId]);

  const refreshData = useCallback(() => {
    if (casinoId) refreshFromGateway(casinoId);
  }, [casinoId, refreshFromGateway]);

  // ─── Main setup effect ────────────────────────────────────────────────────

  useEffect(() => {
    if (!casinoId) return;

    setData(prev => ({ ...prev, isSimulating: true }));
    refreshFromGateway(casinoId);
    subscribeRealtime(casinoId);
    triggerBurst(40);

    burstTimerRef.current = setInterval(() => {
      triggerBurst(Math.floor(Math.random() * 15) + 18);
    }, BURST_INTERVAL_MS);

    refreshTimerRef.current = setInterval(() => {
      refreshFromGateway(casinoId);
    }, GATEWAY_REFRESH_MS);

    return () => {
      if (burstTimerRef.current) clearInterval(burstTimerRef.current);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
