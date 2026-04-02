import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

interface PredictionResult {
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

function calculateRiskScore(features: PlayerFeatures): PredictionResult {
  let riskScore = 0;
  const factors = {
    visits_risk: 0,
    bet_size_risk: 0,
    session_risk: 0,
    loss_risk: 0,
    behavior_risk: 0,
  };

  if (features.visits > 150) {
    factors.visits_risk = 20;
  } else if (features.visits > 100) {
    factors.visits_risk = 15;
  } else if (features.visits > 50) {
    factors.visits_risk = 10;
  } else {
    factors.visits_risk = 5;
  }

  if (features.avg_bet_size > 2000) {
    factors.bet_size_risk = 25;
  } else if (features.avg_bet_size > 1000) {
    factors.bet_size_risk = 18;
  } else if (features.avg_bet_size > 500) {
    factors.bet_size_risk = 12;
  } else {
    factors.bet_size_risk = 5;
  }

  if (features.session_minutes > 180) {
    factors.session_risk = 20;
  } else if (features.session_minutes > 120) {
    factors.session_risk = 15;
  } else if (features.session_minutes > 60) {
    factors.session_risk = 10;
  } else {
    factors.session_risk = 5;
  }

  const netLoss = features.total_bet - features.withdrawals;
  const lossRatio = features.total_bet > 0 ? netLoss / features.total_bet : 0;

  if (lossRatio > 0.5) {
    factors.loss_risk = 20;
  } else if (lossRatio > 0.3) {
    factors.loss_risk = 15;
  } else if (lossRatio > 0.1) {
    factors.loss_risk = 10;
  } else {
    factors.loss_risk = 5;
  }

  if (features.risky_behavior === 1) {
    factors.behavior_risk = 15;
  }

  const gameMultipliers: Record<string, number> = {
    slots: 1.2,
    roulette: 1.1,
    blackjack: 0.9,
    poker: 1.0,
    baccarat: 1.0,
  };

  const gameMultiplier = gameMultipliers[features.game_type.toLowerCase()] || 1.0;

  riskScore = (
    factors.visits_risk +
    factors.bet_size_risk +
    factors.session_risk +
    factors.loss_risk +
    factors.behavior_risk
  ) * gameMultiplier;

  riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

  let riskLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (riskScore >= 80) {
    riskLabel = 'CRITICAL';
  } else if (riskScore >= 60) {
    riskLabel = 'HIGH';
  } else if (riskScore >= 40) {
    riskLabel = 'MEDIUM';
  } else {
    riskLabel = 'LOW';
  }

  const confidence = Math.min(0.95, 0.7 + (features.visits / 500));

  const recommendations: string[] = [];
  if (factors.session_risk >= 15) {
    recommendations.push('Take regular breaks - session duration is high');
  }
  if (factors.bet_size_risk >= 18) {
    recommendations.push('Consider reducing bet sizes');
  }
  if (factors.loss_risk >= 15) {
    recommendations.push('Set a loss limit - net losses are significant');
  }
  if (factors.visits_risk >= 15) {
    recommendations.push('Monitor play frequency - visit count is elevated');
  }
  if (features.risky_behavior === 1) {
    recommendations.push('Previous risk indicators detected - exercise caution');
  }

  return {
    risk_score: riskScore,
    risk_label: riskLabel,
    confidence: Math.round(confidence * 100) / 100,
    factors,
    recommendations,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    if (url.pathname === '/safeplay-ai-risk-engine/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: 'SafeBet IQ Risk Engine',
          version: '1.0.0',
          model: 'Demo Risk Predictor',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (url.pathname === '/safeplay-ai-risk-engine/predict' && req.method === 'POST') {
      const body = await req.json();
      const { features } = body;

      if (!features) {
        return new Response(
          JSON.stringify({
            error: 'Missing required field: features',
            example: {
              features: {
                visits: 120,
                total_bet: 50000,
                avg_bet_size: 417,
                winnings: 45000,
                withdrawals: 40000,
                session_minutes: 145,
                game_type: 'slots',
                risky_behavior: 0,
              },
            },
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const prediction = calculateRiskScore(features);

      return new Response(
        JSON.stringify({
          success: true,
          prediction,
          model_info: {
            name: 'SafePlay Risk Predictor v1.0',
            type: 'rule-based ensemble',
            training_samples: 250,
          },
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (url.pathname === '/safeplay-ai-risk-engine/batch-predict' && req.method === 'POST') {
      const body = await req.json();
      const { players } = body;

      if (!players || !Array.isArray(players)) {
        return new Response(
          JSON.stringify({
            error: 'Missing or invalid field: players (must be an array)',
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const predictions = players.map((player: any) => ({
        player_id: player.player_id,
        prediction: calculateRiskScore(player.features),
      }));

      return new Response(
        JSON.stringify({
          success: true,
          predictions,
          count: predictions.length,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Not Found',
        available_endpoints: [
          'GET /safeplay-ai-risk-engine/health',
          'POST /safeplay-ai-risk-engine/predict',
          'POST /safeplay-ai-risk-engine/batch-predict',
        ],
      }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in SafeBet IQ Risk Engine:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});