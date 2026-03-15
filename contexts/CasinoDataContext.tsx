'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

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

interface LiveBet {
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
  players: Player[];
  liveBets: LiveBet[];
  interventions: Intervention[];
  totalWagered: number;
  totalWon: number;
  activePlayers: number;
  totalPlayers: number;
  avgBetSize: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

interface CasinoDataContextType {
  data: CasinoData;
  refreshData: () => void;
}

const CasinoDataContext = createContext<CasinoDataContextType | undefined>(undefined);

const GAME_TYPES = ['Slots', 'Blackjack', 'Roulette', 'Poker', 'Baccarat'];

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

function calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function buildSimulatedPlayers(dbPlayers: Array<{ first_name: string; last_name: string; player_id: string; risk_score: number; status: string; total_wagered?: number }>): Player[] {
  return dbPlayers.map((p, i) => ({
    id: `db-${p.player_id}`,
    playerName: `${p.first_name} ${p.last_name}`,
    playerId: p.player_id,
    game: GAME_TYPES[i % GAME_TYPES.length],
    betAmount: Math.floor(Math.random() * 1900) + 100,
    totalWagered: Number(p.total_wagered) || 0,
    sessionDuration: Math.floor(Math.random() * 180) + 15,
    riskScore: p.risk_score,
    riskLevel: calculateRiskLevel(p.risk_score),
    isActive: p.status === 'active',
    lastBetTime: new Date(Date.now() - Math.random() * 3600000),
  }));
}

function buildFallbackPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => {
    const name = SA_NAMES[i % SA_NAMES.length];
    const suffix = Math.floor(i / SA_NAMES.length);
    const playerName = suffix > 0 ? `${name.first} ${name.last} ${suffix + 1}` : `${name.first} ${name.last}`;
    const riskScore = Math.floor(Math.random() * 100);
    return {
      id: `fallback-${i}`,
      playerName,
      playerId: `PLR${String(i + 1).padStart(6, '0')}`,
      game: GAME_TYPES[Math.floor(Math.random() * GAME_TYPES.length)],
      betAmount: Math.floor(Math.random() * 1900) + 100,
      totalWagered: Math.floor(Math.random() * 50000) + 5000,
      sessionDuration: Math.floor(Math.random() * 180) + 15,
      riskScore,
      riskLevel: calculateRiskLevel(riskScore),
      isActive: Math.random() > 0.3,
      lastBetTime: new Date(Date.now() - Math.random() * 3600000),
    };
  });
}

export function CasinoDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const casinoId = (user as any)?.casino_id as string | undefined;

  const [data, setData] = useState<CasinoData>({
    players: [],
    liveBets: [],
    interventions: [],
    totalWagered: 0,
    totalWon: 0,
    activePlayers: 0,
    totalPlayers: 0,
    avgBetSize: 0,
    riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
  });

  const getSATime = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));

  const generateBet = (players: Player[]): LiveBet => {
    const active = players.filter(p => p.isActive);
    const player = active[Math.floor(Math.random() * active.length)] || players[0];
    if (!player) {
      const fallback = SA_NAMES[Math.floor(Math.random() * SA_NAMES.length)];
      const betAmount = Math.floor(Math.random() * 1900) + 100;
      const isWin = Math.random() > 0.55;
      return {
        id: `${Date.now()}-${Math.random()}`,
        playerName: `${fallback.first} ${fallback.last}`,
        playerId: `PLR000001`,
        game: GAME_TYPES[Math.floor(Math.random() * GAME_TYPES.length)],
        betAmount,
        outcome: isWin ? 'win' : 'loss',
        winAmount: isWin ? Math.floor(betAmount * (1.5 + Math.random() * 2)) : 0,
        timestamp: getSATime(),
        riskScore: 50,
      };
    }
    const betAmount = Math.floor(Math.random() * 1900) + 100;
    const isWin = Math.random() > 0.55;
    return {
      id: `${Date.now()}-${Math.random()}`,
      playerName: player.playerName,
      playerId: player.playerId,
      game: player.game,
      betAmount,
      outcome: isWin ? 'win' : 'loss',
      winAmount: isWin ? Math.floor(betAmount * (1.5 + Math.random() * 2)) : 0,
      timestamp: getSATime(),
      riskScore: player.riskScore,
    };
  };

  const loadRealStats = async (players: Player[]) => {
    if (!casinoId) return;

    const [countResult, sessionResult, wagerResult] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('casino_id', casinoId),
      supabase.from('gaming_sessions').select('*', { count: 'exact', head: true }).eq('casino_id', casinoId).eq('is_active', true),
      supabase.from('players').select('total_wagered').eq('casino_id', casinoId).eq('status', 'active'),
    ]);

    const totalPlayers = countResult.count ?? players.length;
    const activeSessions = sessionResult.count ?? 0;
    const wagerData = wagerResult.data || [];
    const totalWagered = wagerData.reduce((sum, p) => sum + (Number(p.total_wagered) || 0), 0);
    const avgBetSize = wagerData.length > 0 ? Math.round(totalWagered / wagerData.length / 100) : 0;

    const activeCount = players.filter(p => p.isActive).length;

    setData(prev => ({
      ...prev,
      totalPlayers,
      activePlayers: activeSessions > 0 ? activeSessions : activeCount,
      totalWagered: totalWagered > 0 ? totalWagered : prev.totalWagered,
      avgBetSize: avgBetSize > 0 ? avgBetSize : prev.avgBetSize,
    }));
  };

  const initializePlayers = async (): Promise<Player[]> => {
    if (!casinoId) {
      return buildFallbackPlayers(50);
    }

    const { data: dbPlayers } = await supabase
      .from('players')
      .select('first_name, last_name, player_id, risk_score, status, total_wagered')
      .eq('casino_id', casinoId)
      .eq('status', 'active')
      .order('risk_score', { ascending: false })
      .limit(100);

    if (dbPlayers && dbPlayers.length > 0) {
      return buildSimulatedPlayers(dbPlayers);
    }

    return buildFallbackPlayers(50);
  };

  useEffect(() => {
    let betInterval: NodeJS.Timeout;
    let statsInterval: NodeJS.Timeout;

    const init = async () => {
      const players = await initializePlayers();

      const activePlayers = players.filter(p => p.isActive);
      const riskDist = {
        low: players.filter(p => p.riskLevel === 'low').length,
        medium: players.filter(p => p.riskLevel === 'medium').length,
        high: players.filter(p => p.riskLevel === 'high').length,
        critical: players.filter(p => p.riskLevel === 'critical').length,
      };
      const totalWagered = players.reduce((s, p) => s + p.totalWagered, 0);

      const initialBets = [generateBet(players), generateBet(players), generateBet(players)];

      setData(prev => ({
        ...prev,
        players,
        liveBets: initialBets,
        activePlayers: activePlayers.length,
        totalPlayers: players.length,
        totalWagered,
        totalWon: Math.round(totalWagered * 0.446),
        avgBetSize: players.length > 0 ? Math.round(totalWagered / players.length / 100) : 385,
        riskDistribution: riskDist,
      }));

      await loadRealStats(players);

      betInterval = setInterval(() => {
        setData(prev => {
          const newBet = generateBet(prev.players);
          return {
            ...prev,
            liveBets: [newBet, ...prev.liveBets].slice(0, 15),
            totalWagered: prev.totalWagered + newBet.betAmount,
            totalWon: prev.totalWon + (newBet.winAmount || 0),
          };
        });
      }, Math.random() * 2000 + 1500);

      statsInterval = setInterval(() => {
        setData(prev => ({
          ...prev,
          avgBetSize: Math.floor(300 + Math.random() * 200),
        }));
      }, 3000);
    };

    init();

    return () => {
      clearInterval(betInterval);
      clearInterval(statsInterval);
    };
  }, [casinoId]);

  const refreshData = async () => {
    const players = await initializePlayers();
    const activePlayers = players.filter(p => p.isActive);
    const riskDist = {
      low: players.filter(p => p.riskLevel === 'low').length,
      medium: players.filter(p => p.riskLevel === 'medium').length,
      high: players.filter(p => p.riskLevel === 'high').length,
      critical: players.filter(p => p.riskLevel === 'critical').length,
    };
    setData(prev => ({
      ...prev,
      players,
      activePlayers: activePlayers.length,
      totalPlayers: players.length,
      riskDistribution: riskDist,
    }));
    await loadRealStats(players);
  };

  return (
    <CasinoDataContext.Provider value={{ data, refreshData }}>
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
