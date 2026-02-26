'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { mlService, type RiskPrediction } from '@/lib/mlService';
import { formatPercentage } from '@/lib/utils';

export default function MLTestPage() {
  const [features, setFeatures] = useState({
    visits: 120,
    total_bet: 50000,
    avg_bet_size: 417,
    winnings: 45000,
    withdrawals: 40000,
    session_minutes: 145,
    game_type: 'slots',
    risky_behavior: 0,
  });

  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const result = await mlService.predictRisk(features);
      setPrediction(result);
    } catch (error) {
      alert('Failed to get prediction. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    try {
      const health = await mlService.healthCheck();
      setHealthStatus(health);
    } catch (error) {
      alert('Health check failed. Check console for details.');
    }
  };

  const loadExample = (example: 'low' | 'medium' | 'high' | 'critical') => {
    const examples = {
      low: {
        visits: 25,
        total_bet: 5000,
        avg_bet_size: 200,
        winnings: 4800,
        withdrawals: 4500,
        session_minutes: 45,
        game_type: 'blackjack',
        risky_behavior: 0,
      },
      medium: {
        visits: 75,
        total_bet: 25000,
        avg_bet_size: 333,
        winnings: 22000,
        withdrawals: 18000,
        session_minutes: 90,
        game_type: 'roulette',
        risky_behavior: 0,
      },
      high: {
        visits: 120,
        total_bet: 80000,
        avg_bet_size: 667,
        winnings: 65000,
        withdrawals: 50000,
        session_minutes: 150,
        game_type: 'slots',
        risky_behavior: 1,
      },
      critical: {
        visits: 180,
        total_bet: 150000,
        avg_bet_size: 833,
        winnings: 120000,
        withdrawals: 80000,
        session_minutes: 220,
        game_type: 'slots',
        risky_behavior: 1,
      },
    };

    setFeatures(examples[example]);
    setPrediction(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">SafeBet IQ Risk Engine</h1>
            <p className="text-gray-600 mt-2">Machine Learning Microservice for Gambling Risk Prediction</p>
          </div>
          <Button onClick={handleHealthCheck} variant="outline">
            Check Health
          </Button>
        </div>

        {healthStatus && (
          <Card className="bg-brand-50 border-brand-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-brand-500" />
                <div>
                  <div className="font-semibold text-brand-800">Service: {healthStatus.service}</div>
                  <div className="text-sm text-brand-600">
                    Status: {healthStatus.status} • Version: {healthStatus.version} • Model: {healthStatus.model}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Player Features Input</CardTitle>
              <CardDescription>Enter player gambling behavior data for risk prediction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Visits</Label>
                <Input
                  type="number"
                  value={features.visits}
                  onChange={(e) => setFeatures({ ...features, visits: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Total Bet (R)</Label>
                <Input
                  type="number"
                  value={features.total_bet}
                  onChange={(e) => setFeatures({ ...features, total_bet: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Average Bet Size (R)</Label>
                <Input
                  type="number"
                  value={features.avg_bet_size}
                  onChange={(e) => setFeatures({ ...features, avg_bet_size: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Winnings (R)</Label>
                <Input
                  type="number"
                  value={features.winnings}
                  onChange={(e) => setFeatures({ ...features, winnings: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Withdrawals (R)</Label>
                <Input
                  type="number"
                  value={features.withdrawals}
                  onChange={(e) => setFeatures({ ...features, withdrawals: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Session Minutes</Label>
                <Input
                  type="number"
                  value={features.session_minutes}
                  onChange={(e) => setFeatures({ ...features, session_minutes: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Game Type</Label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={features.game_type}
                  onChange={(e) => setFeatures({ ...features, game_type: e.target.value })}
                >
                  <option value="slots">Slots</option>
                  <option value="roulette">Roulette</option>
                  <option value="blackjack">Blackjack</option>
                  <option value="poker">Poker</option>
                  <option value="baccarat">Baccarat</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Risky Behavior Flag</Label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={features.risky_behavior}
                  onChange={(e) => setFeatures({ ...features, risky_behavior: parseInt(e.target.value) })}
                >
                  <option value={0}>No (0)</option>
                  <option value={1}>Yes (1)</option>
                </select>
              </div>

              <div className="pt-4 space-y-2">
                <Button onClick={handlePredict} disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700">
                  {loading ? (
                    <>
                      <Activity className="h-4 w-4 mr-2 animate-spin" />
                      Predicting...
                    </>
                  ) : (
                    'Predict Risk Score'
                  )}
                </Button>

                <div className="grid grid-cols-4 gap-2">
                  <Button onClick={() => loadExample('low')} variant="outline" size="sm" className="text-xs">
                    Low
                  </Button>
                  <Button onClick={() => loadExample('medium')} variant="outline" size="sm" className="text-xs">
                    Medium
                  </Button>
                  <Button onClick={() => loadExample('high')} variant="outline" size="sm" className="text-xs">
                    High
                  </Button>
                  <Button onClick={() => loadExample('critical')} variant="outline" size="sm" className="text-xs">
                    Critical
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {prediction ? (
              <>
                <Card className={
                  prediction.risk_label === 'CRITICAL'
                    ? 'bg-red-50 border-red-200'
                    : prediction.risk_label === 'HIGH'
                    ? 'bg-orange-50 border-orange-200'
                    : prediction.risk_label === 'MEDIUM'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-brand-50 border-brand-200'
                }>
                  <CardHeader>
                    <CardTitle>Risk Prediction Result</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-6">
                      <div className="text-6xl font-bold text-gray-900 mb-2">{prediction.risk_score}</div>
                      <Badge className={
                        prediction.risk_label === 'CRITICAL'
                          ? 'bg-red-100 text-red-700 border-0 text-lg px-4 py-1'
                          : prediction.risk_label === 'HIGH'
                          ? 'bg-orange-100 text-orange-700 border-0 text-lg px-4 py-1'
                          : prediction.risk_label === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-700 border-0 text-lg px-4 py-1'
                          : 'bg-brand-100 text-brand-600 border-0 text-lg px-4 py-1'
                      }>
                        {prediction.risk_label}
                      </Badge>
                      <div className="text-sm text-gray-600 mt-2">
                        Confidence: {formatPercentage(prediction.confidence * 100)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-semibold text-gray-900">Risk Factors:</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Visits Risk:</span>
                          <span className="font-semibold">{prediction.factors.visits_risk}/20</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bet Size Risk:</span>
                          <span className="font-semibold">{prediction.factors.bet_size_risk}/25</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Session Risk:</span>
                          <span className="font-semibold">{prediction.factors.session_risk}/20</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Loss Risk:</span>
                          <span className="font-semibold">{prediction.factors.loss_risk}/20</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Behavior Risk:</span>
                          <span className="font-semibold">{prediction.factors.behavior_risk}/15</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {prediction.recommendations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <span>Recommendations</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {prediction.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-cyan-600 mt-1">•</span>
                            <span className="text-sm text-gray-700">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-gray-50 border-dashed border-2">
                <CardContent className="p-12 text-center">
                  <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <div className="text-gray-500">Enter player features and click Predict to see results</div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-semibold text-gray-900 mb-2">Endpoints:</div>
              <div className="space-y-2 text-sm font-mono bg-gray-50 p-4 rounded-lg">
                <div>GET /safeplay-ai-risk-engine/health</div>
                <div>POST /safeplay-ai-risk-engine/predict</div>
                <div>POST /safeplay-ai-risk-engine/batch-predict</div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-900 mb-2">Model Information:</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div>• Training Samples: 250 players</div>
                <div>• Features: 8 behavioral indicators</div>
                <div>• Output: Risk score (0-100) and label (LOW/MEDIUM/HIGH/CRITICAL)</div>
                <div>• Algorithm: Rule-based ensemble with game-specific multipliers</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
