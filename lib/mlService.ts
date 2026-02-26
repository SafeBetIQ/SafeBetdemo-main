interface PlayerFeatures {
  visits: number;
  total_bet: number;
  avg_bet_size: number;
  winnings: number;
  withdrawals: number;
  session_minutes: number;
  game_type: string;
  risky_behavior: number;
}

interface RiskPrediction {
  risk_score: number;
  risk_label: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  factors: {
    visits_risk: number;
    bet_size_risk: number;
    session_risk: number;
    loss_risk: number;
    behavior_risk: number;
  };
  recommendations: string[];
}

interface PredictionResponse {
  success: boolean;
  prediction: RiskPrediction;
  model_info: {
    name: string;
    type: string;
    training_samples: number;
  };
  timestamp: string;
}

interface BatchPredictionResponse {
  success: boolean;
  predictions: Array<{
    player_id: string;
    prediction: RiskPrediction;
  }>;
  count: number;
  timestamp: string;
}

class SafePlayMLService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/safeplay-ai-risk-engine`;
    this.apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML Service health check failed:', error);
      throw error;
    }
  }

  async predictRisk(features: PlayerFeatures): Promise<RiskPrediction> {
    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ features }),
      });

      if (!response.ok) {
        throw new Error(`Prediction failed: ${response.status}`);
      }

      const data: PredictionResponse = await response.json();
      return data.prediction;
    } catch (error) {
      console.error('ML Service prediction failed:', error);
      throw error;
    }
  }

  async batchPredict(
    players: Array<{ player_id: string; features: PlayerFeatures }>
  ): Promise<BatchPredictionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/batch-predict`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ players }),
      });

      if (!response.ok) {
        throw new Error(`Batch prediction failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML Service batch prediction failed:', error);
      throw error;
    }
  }

  calculateFeaturesFromPlayer(player: any): PlayerFeatures {
    return {
      visits: player.session_count || 1,
      total_bet: player.total_wagered || 0,
      avg_bet_size: player.avg_bet_size || player.betAmount || 0,
      winnings: player.total_won || 0,
      withdrawals: player.total_won * 0.8 || 0,
      session_minutes: player.sessionDuration || player.avg_session_duration || 0,
      game_type: player.game || 'slots',
      risky_behavior: player.risky_behavior || 0,
    };
  }
}

export const mlService = new SafePlayMLService();
export type { PlayerFeatures, RiskPrediction };
