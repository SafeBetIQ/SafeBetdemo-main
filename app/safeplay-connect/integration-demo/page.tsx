'use client';

import MainNavigation from '@/components/MainNavigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Zap, AlertCircle } from 'lucide-react';

export default function IntegrationDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <MainNavigation />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center space-x-3 mb-6">
          <Code className="h-10 w-10 text-brand-400" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-400 to-teal-500 text-transparent bg-clip-text">
            Integration Code Samples
          </h1>
        </div>
        <p className="text-xl text-gray-400 mb-12">Production-ready code examples for integrating SafeBet IQ into your casino platform</p>

        <Tabs defaultValue="nodejs" className="space-y-8">
          <TabsList className="bg-gray-900 border border-gray-800">
            <TabsTrigger value="nodejs">Node.js / TypeScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="php">PHP</TabsTrigger>
            <TabsTrigger value="csharp">C# / .NET</TabsTrigger>
          </TabsList>

          <TabsContent value="nodejs" className="space-y-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-2xl">Setup & Configuration</CardTitle>
                <CardDescription className="text-gray-400">Install dependencies and configure the client</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Install Dependencies</h3>
                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-gray-300">{`npm install axios dotenv`}</pre>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Environment Variables (.env)</h3>
                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-gray-300">{`SAFEPLAY_API_KEY=sk_prod_your_api_key_here
SAFEPLAY_BASE_URL=https://api.safeplay.ai/v1`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-2xl">SafePlay Client Class</CardTitle>
                <CardDescription className="text-gray-400">Reusable client for all API operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`import axios, { AxiosInstance } from 'axios';

class SafePlayClient {
  private client: AxiosInstance;

  constructor(apiKey: string, baseURL: string = 'https://api.safeplay.ai/v1') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async syncPlayer(playerData: {
    player_id: string;
    session_id?: string;
    timestamp?: string;
    game_type: string;
    bet_amount: number;
    win_amount?: number;
    session_duration_minutes: number;
    total_wagered: number;
    total_wins?: number;
    total_losses?: number;
    bet_frequency?: number;
    player_metadata?: {
      email?: string;
      phone?: string;
      join_date?: string;
    };
  }) {
    try {
      const response = await this.client.post('/players/sync', playerData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async batchSyncPlayers(players: any[]) {
    try {
      const response = await this.client.post('/players/batch-sync', { players });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getPlayerRisk(playerId: string) {
    try {
      const response = await this.client.get(\`/players/\${playerId}/risk\`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default SafePlayClient;`}</pre>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-2xl flex items-center space-x-2">
                  <Zap className="h-6 w-6 text-brand-400" />
                  <span>Real-Time Integration Example</span>
                </CardTitle>
                <CardDescription className="text-gray-400">Send player data after each bet is placed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`import SafePlayClient from './SafePlayClient';

const safeplay = new SafePlayClient(process.env.SAFEPLAY_API_KEY!);

// Call this function after a player places a bet
async function onBetPlaced(bet: {
  playerId: string;
  gameType: string;
  betAmount: number;
  winAmount: number;
}) {
  // Get current session data for the player
  const session = await getPlayerSession(bet.playerId);

  try {
    const result = await safeplay.syncPlayer({
      player_id: bet.playerId,
      session_id: session.id,
      timestamp: new Date().toISOString(),
      game_type: bet.gameType,
      bet_amount: bet.betAmount,
      win_amount: bet.winAmount,
      session_duration_minutes: session.durationMinutes,
      total_wagered: session.totalWagered + bet.betAmount,
      total_wins: session.totalWins + (bet.winAmount || 0),
      total_losses: session.totalLosses + (bet.winAmount ? 0 : bet.betAmount),
      bet_frequency: session.betCount / session.durationMinutes,
      player_metadata: {
        email: session.player.email,
        phone: session.player.phone,
        join_date: session.player.joinDate,
      }
    });

    // Check if intervention is needed
    if (result.intervention?.required) {
      await handleIntervention(bet.playerId, result);
    }

    return result;
  } catch (error) {
    // Continue game operation even if risk check fails
    return null;
  }
}

async function handleIntervention(playerId: string, riskData: any) {
  // Trigger intervention based on recommended channels
  const channels = riskData.intervention.channels || ['email'];

  if (channels.includes('whatsapp')) {
    await sendWhatsAppIntervention(playerId, riskData);
  }

  if (channels.includes('email')) {
    await sendEmailIntervention(playerId, riskData);
  }

  // Log intervention for compliance
  await logIntervention({
    player_id: playerId,
    risk_score: riskData.risk_score,
    risk_level: riskData.risk_level,
    triggers: riskData.triggers,
    channels: channels,
    timestamp: new Date().toISOString(),
  });
}`}</pre>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-2xl">Webhook Handler</CardTitle>
                <CardDescription className="text-gray-400">Receive real-time notifications from SafePlay</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`import { Request, Response } from 'express';
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// Express route handler
export async function handleSafePlayWebhook(req: Request, res: Response) {
  const signature = req.headers['x-safeplay-signature'] as string;
  const payload = JSON.stringify(req.body);

  // Verify webhook signature
  const isValid = verifyWebhookSignature(
    payload,
    signature,
    process.env.SAFEPLAY_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  switch (event.event_type) {
    case 'risk_threshold_exceeded':
      await handleRiskThresholdExceeded(event);
      break;

    case 'intervention_triggered':
      await handleInterventionTriggered(event);
      break;

    default:
      break;
  }

  res.json({ received: true });
}

async function handleRiskThresholdExceeded(event: any) {
  // Take immediate action
  if (event.risk_level === 'critical') {
    // Implement cool-off period
    await setCoolOffPeriod(event.player_id, 24); // 24 hours

    // Send emergency intervention
    await sendEmergencyIntervention(event.player_id);

    // Alert compliance team
    await notifyComplianceTeam(event);
  }
}`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="python" className="space-y-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-2xl">Python Client</CardTitle>
                <CardDescription className="text-gray-400">Django/Flask integration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`import requests
from typing import Dict, Any, Optional

class SafePlayClient:
    def __init__(self, api_key: str, base_url: str = "https://api.safeplay.ai/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def sync_player(self, player_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sync player activity and get risk assessment"""
        try:
            response = requests.post(
                f"{self.base_url}/players/sync",
                json=player_data,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"SafePlay API Error: {e}")
            raise

    def get_player_risk(self, player_id: str) -> Dict[str, Any]:
        """Get current risk score for a player"""
        try:
            response = requests.get(
                f"{self.base_url}/players/{player_id}/risk",
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"SafePlay API Error: {e}")
            raise

# Usage example
safeplay = SafePlayClient(api_key="sk_prod_your_api_key")

result = safeplay.sync_player({
    "player_id": "PLR-9381",
    "game_type": "blackjack",
    "bet_amount": 1100,
    "session_duration_minutes": 120,
    "total_wagered": 45000
})

if result.get("intervention", {}).get("required"):
    # Handle intervention
    print(f"Intervention required for player {result['player_id']}")
    print(f"Risk level: {result['risk_level']}")`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="php" className="space-y-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-2xl">PHP Client</CardTitle>
                <CardDescription className="text-gray-400">Laravel/WordPress integration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`<?php

class SafePlayClient {
    private $apiKey;
    private $baseUrl;

    public function __construct($apiKey, $baseUrl = 'https://api.safeplay.ai/v1') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }

    public function syncPlayer($playerData) {
        $ch = curl_init($this->baseUrl . '/players/sync');

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($playerData),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json'
            ],
            CURLOPT_TIMEOUT => 10
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("SafePlay API Error: HTTP $httpCode");
        }

        return json_decode($response, true);
    }

    public function getPlayerRisk($playerId) {
        $ch = curl_init($this->baseUrl . '/players/' . $playerId . '/risk');

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey
            ],
            CURLOPT_TIMEOUT => 10
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("SafePlay API Error: HTTP $httpCode");
        }

        return json_decode($response, true);
    }
}

// Usage
$safeplay = new SafePlayClient($_ENV['SAFEPLAY_API_KEY']);

$result = $safeplay->syncPlayer([
    'player_id' => 'PLR-9381',
    'game_type' => 'blackjack',
    'bet_amount' => 1100,
    'session_duration_minutes' => 120,
    'total_wagered' => 45000
]);

if ($result['intervention']['required'] ?? false) {
    // Handle intervention
    error_log("Intervention required for player " . $result['player_id']);
}

?>`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="csharp" className="space-y-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-2xl">C# / .NET Client</CardTitle>
                <CardDescription className="text-gray-400">ASP.NET integration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300">{`using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class SafePlayClient
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public SafePlayClient(string apiKey, string baseUrl = "https://api.safeplay.ai/v1")
    {
        _apiKey = apiKey;
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(baseUrl),
            Timeout = TimeSpan.FromSeconds(10)
        };
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    public async Task<RiskResponse> SyncPlayer(PlayerData playerData)
    {
        var json = JsonSerializer.Serialize(playerData);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("/players/sync", content);
        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<RiskResponse>(responseJson);
    }

    public async Task<RiskResponse> GetPlayerRisk(string playerId)
    {
        var response = await _httpClient.GetAsync($"/players/{playerId}/risk");
        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<RiskResponse>(responseJson);
    }
}

// Data models
public class PlayerData
{
    public string player_id { get; set; }
    public string game_type { get; set; }
    public decimal bet_amount { get; set; }
    public int session_duration_minutes { get; set; }
    public decimal total_wagered { get; set; }
}

public class RiskResponse
{
    public bool success { get; set; }
    public string player_id { get; set; }
    public int risk_score { get; set; }
    public string risk_level { get; set; }
    public Intervention intervention { get; set; }
}

public class Intervention
{
    public bool required { get; set; }
    public string type { get; set; }
    public string[] channels { get; set; }
}

// Usage
var safeplay = new SafePlayClient(Environment.GetEnvironmentVariable("SAFEPLAY_API_KEY"));

var result = await safeplay.SyncPlayer(new PlayerData
{
    player_id = "PLR-9381",
    game_type = "blackjack",
    bet_amount = 1100,
    session_duration_minutes = 120,
    total_wagered = 45000
});

if (result.intervention?.required == true)
{
    Console.WriteLine($"Intervention required for player {result.player_id}");
}`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-blue-900/20 border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-blue-400 mt-1 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">Need Help with Integration?</h3>
                <p className="text-gray-300">
                  Our technical team is available to assist with your integration. Contact us for:
                </p>
                <ul className="text-gray-300 space-y-1 ml-4 list-disc">
                  <li>Custom integration support</li>
                  <li>Performance optimization guidance</li>
                  <li>Compliance consultation</li>
                  <li>Testing environment access</li>
                </ul>
                <p className="text-brand-400 font-semibold">support@safeplay.ai</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
