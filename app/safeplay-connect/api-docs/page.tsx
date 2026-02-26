'use client';

import MainNavigation from '@/components/MainNavigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code, Lock, Zap, Database, AlertCircle, CheckCircle } from 'lucide-react';

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <MainNavigation />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center space-x-3 mb-6">
          <Code className="h-10 w-10 text-brand-400" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-400 to-teal-500 text-transparent bg-clip-text">
            API Documentation
          </h1>
        </div>
        <p className="text-xl text-gray-400 mb-12">Complete REST API reference for SafeBet IQ Connect integration</p>

        <div className="space-y-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-2xl">Getting Started</CardTitle>
                  <CardDescription className="text-gray-400">Authentication and base configuration</CardDescription>
                </div>
                <Badge className="bg-brand-400/20 text-brand-400 border-brand-400/30">REST API</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Base URL</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <code className="text-brand-400">https://api.safeplay.ai/v1</code>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Authentication</h3>
                <p className="text-gray-400 mb-3">All requests require a Bearer token in the Authorization header:</p>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <pre className="text-sm text-gray-300">{`Authorization: Bearer sk_prod_your_api_key_here`}</pre>
                </div>
              </div>
              <div className="flex items-start space-x-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-300">
                  <span className="font-semibold">API Keys:</span> Obtain your API keys from the Casino Dashboard Settings tab.
                  Keep them secure and never expose them in client-side code.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl flex items-center space-x-2">
                <Zap className="h-6 w-6 text-brand-400" />
                <span>POST /players/sync</span>
              </CardTitle>
              <CardDescription className="text-gray-400">Submit real-time player activity data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Request Body</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`{
  "player_id": "PLR-9381",
  "session_id": "SES-2024-001",
  "timestamp": "2024-11-25T14:30:00Z",
  "game_type": "blackjack",
  "bet_amount": 1100,
  "win_amount": 0,
  "session_duration_minutes": 120,
  "total_wagered": 45000,
  "total_wins": 18000,
  "total_losses": 27000,
  "bet_frequency": 8.5,
  "player_metadata": {
    "email": "player@example.com",
    "phone": "+27821234567",
    "join_date": "2024-01-15"
  }
}`}</pre>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Response</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`{
  "success": true,
  "player_id": "PLR-9381",
  "risk_score": 87,
  "risk_level": "high",
  "recommendation": "intervention_suggested",
  "triggers": [
    "extended_session_duration",
    "increasing_bet_pattern",
    "loss_chasing_behavior"
  ],
  "intervention": {
    "required": true,
    "type": "immediate",
    "channels": ["whatsapp", "email"],
    "message_template": "high_risk_alert"
  }
}`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl flex items-center space-x-2">
                <Database className="h-6 w-6 text-brand-400" />
                <span>POST /players/batch-sync</span>
              </CardTitle>
              <CardDescription className="text-gray-400">Sync multiple players at once (up to 100 per request)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Request Body</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`{
  "players": [
    {
      "player_id": "PLR-9381",
      "session_duration_minutes": 120,
      "bet_amount": 1100,
      "total_wagered": 45000
    },
    {
      "player_id": "PLR-9382",
      "session_duration_minutes": 45,
      "bet_amount": 250,
      "total_wagered": 8500
    }
  ]
}`}</pre>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Response</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`{
  "success": true,
  "processed": 2,
  "results": [
    {
      "player_id": "PLR-9381",
      "risk_score": 87,
      "risk_level": "high"
    },
    {
      "player_id": "PLR-9382",
      "risk_score": 34,
      "risk_level": "low"
    }
  ]
}`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-brand-400" />
                <span>GET /players/:player_id/risk</span>
              </CardTitle>
              <CardDescription className="text-gray-400">Retrieve current risk assessment for a player</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Request</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <code className="text-brand-400">GET /players/PLR-9381/risk</code>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Response</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`{
  "player_id": "PLR-9381",
  "risk_score": 87,
  "risk_level": "high",
  "last_updated": "2024-11-25T14:32:15Z",
  "session_metrics": {
    "duration_minutes": 120,
    "total_wagered": 45000,
    "win_loss_ratio": 0.67
  },
  "historical_trend": "increasing",
  "interventions_sent": 2
}`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Webhooks</CardTitle>
              <CardDescription className="text-gray-400">Receive real-time notifications when risk thresholds are exceeded</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Configure Webhook Endpoint</h3>
                <p className="text-gray-400 mb-3">Set up your webhook URL in the Casino Dashboard Settings. SafePlay will POST to your endpoint when:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>Player risk score exceeds threshold (default: 85)</li>
                  <li>Critical risk pattern detected</li>
                  <li>Intervention is automatically triggered</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Webhook Payload</h3>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`{
  "event_type": "risk_threshold_exceeded",
  "timestamp": "2024-11-25T14:35:00Z",
  "player_id": "PLR-9381",
  "risk_score": 92,
  "risk_level": "critical",
  "triggers": ["rapid_loss_increase", "extended_session"],
  "recommended_action": "immediate_intervention"
}`}</pre>
                </div>
              </div>
              <div className="flex items-start space-x-2 p-4 bg-brand-400/10 border border-brand-400/30 rounded-lg">
                <Lock className="h-5 w-5 text-brand-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-brand-300">
                  <span className="font-semibold">Webhook Security:</span> All webhook requests include an HMAC signature
                  in the X-SafePlay-Signature header. Verify this signature using your webhook secret.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Rate Limits & Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Rate Limits</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Standard: 1,000 requests/minute</li>
                    <li>• Batch: 100 requests/minute</li>
                    <li>• Webhooks: No limit (we call you)</li>
                  </ul>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Best Practices</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Use batch endpoints for bulk syncs</li>
                    <li>• Cache risk scores (TTL: 60s)</li>
                    <li>• Implement exponential backoff</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Error Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded">
                  <code className="text-brand-400">200</code>
                  <span className="text-gray-300">Success</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded">
                  <code className="text-yellow-400">400</code>
                  <span className="text-gray-300">Bad Request - Invalid parameters</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded">
                  <code className="text-red-400">401</code>
                  <span className="text-gray-300">Unauthorized - Invalid API key</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded">
                  <code className="text-red-400">429</code>
                  <span className="text-gray-300">Too Many Requests - Rate limit exceeded</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded">
                  <code className="text-red-400">500</code>
                  <span className="text-gray-300">Server Error - Contact support</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
