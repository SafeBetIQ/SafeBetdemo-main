'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

export function CasinoDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CasinoData>({
    players: [],
    liveBets: [],
    interventions: [],
    totalWagered: 1847250,
    totalWon: 823580,
    activePlayers: 0,
    avgBetSize: 385,
    riskDistribution: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
  });

  const getSATime = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
  };

  const calculateRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  const generatePlayers = (): Player[] => {
    const players: Player[] = [];
    const playerCount = 127;
    const usedNames = new Set<string>();

    for (let i = 0; i < playerCount; i++) {
      let playerName: string;
      let attempts = 0;

      do {
        const nameIndex = (i + attempts) % SA_NAMES.length;
        const name = SA_NAMES[nameIndex];
        const suffix = Math.floor((i + attempts) / SA_NAMES.length);
        playerName = suffix > 0 ? `${name.first} ${name.last} ${suffix + 1}` : `${name.first} ${name.last}`;
        attempts++;
      } while (usedNames.has(playerName) && attempts < 200);

      usedNames.add(playerName);

      const riskScore = Math.floor(Math.random() * 100);
      const totalWagered = Math.floor(Math.random() * 50000) + 5000;
      const isActive = Math.random() > 0.3;

      players.push({
        id: `player-${i}`,
        playerName,
        playerId: `PLR${String(i + 1).padStart(6, '0')}`,
        game: GAME_TYPES[Math.floor(Math.random() * GAME_TYPES.length)],
        betAmount: Math.floor(Math.random() * 1900) + 100,
        totalWagered,
        sessionDuration: Math.floor(Math.random() * 180) + 15,
        riskScore,
        riskLevel: calculateRiskLevel(riskScore),
        isActive,
        lastBetTime: new Date(Date.now() - Math.random() * 3600000),
      });
    }

    return players;
  };

  const generateBet = (players: Player[]): LiveBet => {
    const activePlayers = players.filter(p => p.isActive);
    const player = activePlayers[Math.floor(Math.random() * activePlayers.length)] || players[0];
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

  const generateInterventions = (players: Player[]): Intervention[] => {
    const interventions: Intervention[] = [];
    const highRiskPlayers = players.filter(p => p.riskScore >= 60);

    const triggerReasons = {
      high_risk: 'High-risk activity detected (Risk Score: ',
      rapid_betting: 'Rapid betting pattern detected - ',
      session_duration: 'Extended session duration - ',
      loss_chasing: 'Loss chasing behavior detected - ',
      bet_escalation: 'Bet amount escalation pattern - ',
    };

    const channels: Array<'WhatsApp' | 'Email' | 'SMS'> = ['WhatsApp', 'WhatsApp', 'Email', 'SMS'];
    const statuses: Array<'sent' | 'delivered' | 'failed' | 'pending'> = ['sent', 'delivered', 'sent', 'delivered', 'sent', 'pending'];

    const interventionCount = Math.min(45, highRiskPlayers.length);

    for (let i = 0; i < interventionCount; i++) {
      const player = highRiskPlayers[i % highRiskPlayers.length];
      const triggerTypes: Array<'high_risk' | 'rapid_betting' | 'session_duration' | 'loss_chasing' | 'bet_escalation'> =
        ['high_risk', 'rapid_betting', 'session_duration', 'loss_chasing', 'bet_escalation'];
      const triggerType = triggerTypes[Math.floor(Math.random() * triggerTypes.length)];
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      let reason = '';
      switch (triggerType) {
        case 'high_risk':
          reason = `${triggerReasons.high_risk}${player.riskScore}/100)`;
          break;
        case 'rapid_betting':
          reason = `${triggerReasons.rapid_betting}${Math.floor(Math.random() * 15) + 10} bets in ${Math.floor(Math.random() * 10) + 5} minutes`;
          break;
        case 'session_duration':
          reason = `${triggerReasons.session_duration}${player.sessionDuration} minutes active`;
          break;
        case 'loss_chasing':
          reason = `${triggerReasons.loss_chasing}R${Math.floor(Math.random() * 5000) + 2000} in losses`;
          break;
        case 'bet_escalation':
          reason = `${triggerReasons.bet_escalation}${Math.floor(Math.random() * 150) + 50}% increase`;
          break;
      }

      const minutesAgo = Math.floor(Math.random() * 240) + 2;

      interventions.push({
        id: `intervention-${i}-${Date.now()}`,
        playerName: player.playerName,
        playerId: player.playerId,
        channel,
        status,
        timestamp: new Date(Date.now() - minutesAgo * 60000),
        reason,
        riskScore: player.riskScore,
        automated: true,
        triggerType,
      });
    }

    return interventions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  useEffect(() => {
    const initialPlayers = generatePlayers();
    const initialBets = [
      generateBet(initialPlayers),
      generateBet(initialPlayers),
      generateBet(initialPlayers),
    ];
    const initialInterventions = generateInterventions(initialPlayers);

    const activePlayers = initialPlayers.filter(p => p.isActive);
    const riskDist = {
      low: activePlayers.filter(p => p.riskLevel === 'low').length,
      medium: activePlayers.filter(p => p.riskLevel === 'medium').length,
      high: activePlayers.filter(p => p.riskLevel === 'high').length,
      critical: activePlayers.filter(p => p.riskLevel === 'critical').length,
    };

    setData(prev => ({
      ...prev,
      players: initialPlayers,
      liveBets: initialBets,
      interventions: initialInterventions,
      activePlayers: activePlayers.length,
      riskDistribution: riskDist,
    }));

    const betInterval = setInterval(() => {
      setData(prev => {
        const newBet = generateBet(prev.players);
        const updatedBets = [newBet, ...prev.liveBets].slice(0, 15);

        return {
          ...prev,
          liveBets: updatedBets,
          totalWagered: prev.totalWagered + newBet.betAmount,
          totalWon: prev.totalWon + (newBet.winAmount || 0),
        };
      });
    }, Math.random() * 2000 + 1500);

    const statsInterval = setInterval(() => {
      setData(prev => ({
        ...prev,
        avgBetSize: Math.floor(300 + Math.random() * 200),
      }));
    }, 3000);

    const interventionInterval = setInterval(() => {
      setData(prev => {
        const highRiskPlayers = prev.players.filter(p => p.riskScore >= 60 && p.isActive);

        if (highRiskPlayers.length === 0) return prev;

        const player = highRiskPlayers[Math.floor(Math.random() * highRiskPlayers.length)];
        const triggerTypes: Array<'high_risk' | 'rapid_betting' | 'session_duration' | 'loss_chasing' | 'bet_escalation'> =
          ['high_risk', 'rapid_betting', 'session_duration', 'loss_chasing', 'bet_escalation'];
        const triggerType = triggerTypes[Math.floor(Math.random() * triggerTypes.length)];
        const channels: Array<'WhatsApp' | 'Email' | 'SMS'> = ['WhatsApp', 'WhatsApp', 'Email', 'SMS'];
        const channel = channels[Math.floor(Math.random() * channels.length)];

        let reason = '';
        switch (triggerType) {
          case 'high_risk':
            reason = `High-risk activity detected (Risk Score: ${player.riskScore}/100)`;
            break;
          case 'rapid_betting':
            reason = `Rapid betting pattern detected - ${Math.floor(Math.random() * 15) + 10} bets in ${Math.floor(Math.random() * 10) + 5} minutes`;
            break;
          case 'session_duration':
            reason = `Extended session duration - ${player.sessionDuration} minutes active`;
            break;
          case 'loss_chasing':
            reason = `Loss chasing behavior detected - R${Math.floor(Math.random() * 5000) + 2000} in losses`;
            break;
          case 'bet_escalation':
            reason = `Bet amount escalation pattern - ${Math.floor(Math.random() * 150) + 50}% increase`;
            break;
        }

        const newIntervention: Intervention = {
          id: `intervention-${Date.now()}-${Math.random()}`,
          playerName: player.playerName,
          playerId: player.playerId,
          channel,
          status: 'sent',
          timestamp: getSATime(),
          reason,
          riskScore: player.riskScore,
          automated: true,
          triggerType,
        };

        const updatedInterventions = [newIntervention, ...prev.interventions].slice(0, 50);

        return {
          ...prev,
          interventions: updatedInterventions,
        };
      });
    }, Math.random() * 30000 + 45000);

    return () => {
      clearInterval(betInterval);
      clearInterval(statsInterval);
      clearInterval(interventionInterval);
    };
  }, []);

  const refreshData = () => {
    const newPlayers = generatePlayers();
    const newInterventions = generateInterventions(newPlayers);
    const activePlayers = newPlayers.filter(p => p.isActive);
    const riskDist = {
      low: activePlayers.filter(p => p.riskLevel === 'low').length,
      medium: activePlayers.filter(p => p.riskLevel === 'medium').length,
      high: activePlayers.filter(p => p.riskLevel === 'high').length,
      critical: activePlayers.filter(p => p.riskLevel === 'critical').length,
    };

    setData(prev => ({
      ...prev,
      players: newPlayers,
      interventions: newInterventions,
      activePlayers: activePlayers.length,
      riskDistribution: riskDist,
    }));
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
