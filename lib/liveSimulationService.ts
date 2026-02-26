'use client';

import { supabase } from './supabase';

export interface LiveEvent {
  id: string;
  player_id: string;
  casino_id: string;
  player_name: string;
  event_type: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  risk_score: number;
  timestamp: string;
  metadata?: any;
}

const EVENT_TEMPLATES = [
  { type: 'session_escalation', desc: 'Betting session escalated beyond normal patterns', risk: 'high' },
  { type: 'loss_chasing', desc: 'Rapid re-deposits after significant losses', risk: 'critical' },
  { type: 'spend_spike', desc: 'Sudden increase in spending detected', risk: 'high' },
  { type: 'late_night_play', desc: 'Extended gambling during late hours', risk: 'medium' },
  { type: 'rapid_deposits', desc: 'Multiple deposits in short time period', risk: 'high' },
  { type: 'affordability_concern', desc: 'Spending patterns suggest affordability issues', risk: 'high' },
  { type: 'time_spent_increase', desc: 'Significant increase in time spent gambling', risk: 'medium' },
  { type: 'bet_size_increase', desc: 'Unusual increase in bet sizes', risk: 'high' },
  { type: 'emotional_betting', desc: 'Erratic betting patterns detected', risk: 'high' },
  { type: 'multi_channel_play', desc: 'Simultaneous play across multiple channels', risk: 'medium' }
];

class LiveSimulationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private listeners: Array<(event: LiveEvent) => void> = [];

  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private calculateRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  async generateLiveEvent(): Promise<LiveEvent | null> {
    try {
      // Get a random player from the database
      const { data: players, error } = await supabase
        .from('players')
        .select('id, player_id, first_name, last_name, casino_id, risk_score')
        .eq('is_active', true)
        .limit(50);

      if (error || !players || players.length === 0) {
        console.error('Error fetching players for simulation:', error);
        return null;
      }

      const player = this.getRandomElement(players);
      const template = this.getRandomElement(EVENT_TEMPLATES);

      const riskScore = player.risk_score || 50;
      const playerName = `${player.first_name} ${player.last_name}`;

      const event: LiveEvent = {
        id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        player_id: player.player_id,
        casino_id: player.casino_id,
        player_name: playerName,
        event_type: template.type,
        risk_level: this.calculateRiskLevel(riskScore),
        description: template.desc,
        risk_score: riskScore,
        timestamp: new Date().toISOString(),
        metadata: {
          amount: Math.floor(Math.random() * 4900 + 100),
          duration_minutes: Math.floor(Math.random() * 225 + 15),
          simulated: true
        }
      };

      // Insert into demo_live_events table
      await supabase
        .from('demo_live_events')
        .insert({
          player_id: player.player_id,
          casino_id: player.casino_id,
          player_name: playerName,
          event_type: event.event_type,
          risk_level: event.risk_level,
          description: event.description,
          risk_score: event.risk_score,
          timestamp: event.timestamp,
          metadata: event.metadata
        });

      return event;
    } catch (error) {
      console.error('Error generating live event:', error);
      return null;
    }
  }

  start(intervalSeconds = 15) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Generate initial events immediately
    this.generateBatchEvents(3);

    // Then continue generating events at intervals
    this.intervalId = setInterval(async () => {
      const eventCount = Math.floor(Math.random() * 3) + 1; // 1-3 events
      await this.generateBatchEvents(eventCount);
    }, intervalSeconds * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  private async generateBatchEvents(count: number) {
    for (let i = 0; i < count; i++) {
      const event = await this.generateLiveEvent();
      if (event) {
        this.notifyListeners(event);
      }
      // Small delay between events to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  subscribe(callback: (event: LiveEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: LiveEvent) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in simulation listener:', error);
      }
    });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      listenerCount: this.listeners.length
    };
  }
}

export const liveSimulationService = new LiveSimulationService();
