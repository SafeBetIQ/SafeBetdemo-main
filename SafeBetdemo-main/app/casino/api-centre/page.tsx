'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Plug, Key, Code, Book, Copy, CheckCircle2, Globe, Webhook, FileCode,
  RefreshCw, Eye, EyeOff, AlertTriangle, Shield, Activity, Clock,
  Download, Upload, ChevronRight, Lock, Zap, FileText, Settings, Bell,
} from 'lucide-react';

interface APIKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  created: string;
  lastUsed: string | null;
  status: 'active' | 'revoked';
}

const MOCK_KEYS: APIKey[] = [
  { id: '1', name: 'Production Integration', key: 'sk_live_SB1q4...x9mK', scopes: ['players:read', 'sessions:write', 'events:write'], created: '2026-01-15', lastUsed: '2026-06-29T14:32:00Z', status: 'active' },
  { id: '2', name: 'Staging / Test', key: 'sk_test_SB2r7...p3nA', scopes: ['players:read', 'sessions:write'], created: '2026-03-01', lastUsed: '2026-06-28T09:11:00Z', status: 'active' },
  { id: '3', name: 'Legacy CMS Integration', key: 'sk_live_SB0m1...q7bP', scopes: ['players:read'], created: '2025-09-20', lastUsed: null, status: 'revoked' },
];

const API_ENDPOINTS = [
  {
    method: 'POST',
    path: '/v1/events/session',
    title: 'Ingest Session Event',
    description: 'Send a live gaming session event for real-time risk analysis.',
    scopes: ['sessions:write'],
    requestBody: `{
  "player_id": "PLY-100234",
  "session_id": "SES-9827465",
  "event_type": "bet_placed",
  "amount": 250.00,
  "currency": "ZAR",
  "game_code": "roulette_live_01",
  "timestamp": "2026-06-29T14:30:00Z",
  "metadata": {
    "machine_id": "MCH-0047",
    "session_duration_seconds": 1840
  }
}`,
    responseExample: `{
  "status": "accepted",
  "event_id": "EVT-882734",
  "risk_score": 74,
  "risk_band": "high",
  "triggers": ["velocity_increase", "loss_chasing"],
  "intervention_recommended": true,
  "processing_ms": 43
}`,
  },
  {
    method: 'POST',
    path: '/v1/players',
    title: 'Register Player',
    description: 'Register a casino player reference for risk monitoring. SafeBet IQ never receives or stores player identity — only an opaque reference, which the Identity Resolution Service hashes and maps to an anonymous SafeBet IQ Player ID.',
    scopes: ['players:write'],
    requestBody: `{
  "casino_player_ref": "opaque-host-system-reference",
  "registration_date": "2024-11-01",
  "vip_tier": "gold",
  "self_exclusion_history": false
}`,
    responseExample: `{
  "safebet_player_id": "SB-PLR-7C5D91E4",
  "status": "registered",
  "initial_risk_score": 12,
  "monitoring_active": true
}`,
  },
  {
    method: 'GET',
    path: '/v1/players/{player_id}/risk',
    title: 'Get Player Risk Score',
    description: 'Retrieve the current risk score and profile for a player.',
    scopes: ['players:read'],
    requestBody: null,
    responseExample: `{
  "player_id": "PLY-100234",
  "risk_score": 74,
  "risk_band": "high",
  "last_updated": "2026-06-29T14:32:00Z",
  "signals": {
    "velocity_increase": 0.82,
    "loss_chasing": 0.71,
    "session_duration_flag": 0.45
  },
  "intervention_status": "pending",
  "self_excluded": false
}`,
  },
  {
    method: 'POST',
    path: '/v1/interventions',
    title: 'Create Intervention Record',
    description: 'Record a responsible gambling intervention and its outcome.',
    scopes: ['interventions:write'],
    requestBody: `{
  "player_id": "PLY-100234",
  "intervention_type": "staff_approach",
  "triggered_by": "risk_score_threshold",
  "staff_id": "STF-0019",
  "outcome": "accepted",
  "notes": "Player acknowledged the concern and accepted a cooling off period.",
  "timestamp": "2026-06-29T15:10:00Z"
}`,
    responseExample: `{
  "intervention_id": "INT-445521",
  "status": "recorded",
  "compliance_reference": "NGA-26-2026-06-29-001",
  "risk_score_updated": 58
}`,
  },
  {
    method: 'POST',
    path: '/v1/exclusions',
    title: 'Register Self-Exclusion',
    description: 'Register a player self-exclusion with the national network.',
    scopes: ['exclusions:write'],
    requestBody: `{
  "player_id": "PLY-100234",
  "exclusion_type": "voluntary",
  "duration_months": 12,
  "counselling_referral": true,
  "counselling_provider": "SARGF",
  "effective_date": "2026-06-29"
}`,
    responseExample: `{
  "exclusion_id": "EXC-100234-2026",
  "nrgp_reference": "NRGP-2026-100234",
  "network_notified": true,
  "expiry_date": "2027-06-29",
  "status": "active"
}`,
  },
  {
    method: 'GET',
    path: '/v1/webhooks/events',
    title: 'Webhook Event Types',
    description: 'Subscribe to real-time events pushed to your endpoint.',
    scopes: ['webhooks:read'],
    requestBody: null,
    responseExample: `{
  "event_types": [
    "player.risk_score_critical",
    "player.risk_score_high",
    "intervention.required",
    "intervention.auto_dispatched",
    "exclusion.breach_detected",
    "exclusion.expiry_approaching",
    "compliance.threshold_breach"
  ]
}`,
  },
];

const WEBHOOK_EXAMPLE = `// Example webhook handler (Node.js / Express)
app.post('/safebet-webhook', (req, res) => {
  const signature = req.headers['x-safebet-signature'];

  // Verify signature using your webhook secret
  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Unauthorized');
  }

  const { event_type, data } = req.body;

  switch (event_type) {
    case 'player.risk_score_critical':
      // Trigger immediate staff alert
      alertStaffMember(data.player_id, data.risk_score);
      break;
    case 'intervention.auto_dispatched':
      // Log intervention in your system
      logIntervention(data.intervention_id, data.player_id);
      break;
    case 'exclusion.breach_detected':
      // Block player access immediately
      blockPlayer(data.player_id);
      notifySecurity(data);
      break;
  }

  res.status(200).json({ received: true });
});`;

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    POST: 'bg-blue-100 text-blue-700 border-blue-200',
    PUT: 'bg-amber-100 text-amber-700 border-amber-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <Badge variant="outline" className={`text-xs font-mono font-bold ${colors[method] || 'bg-slate-100 text-slate-700'}`}>
      {method}
    </Badge>
  );
}

export default function APICentrePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showKey, setShowKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<typeof API_ENDPOINTS[0] | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('Copied to clipboard');
    });
  }

  function testConnection() {
    if (!webhookUrl) { toast.error('Enter a webhook URL first'); return; }
    setConnectionStatus('testing');
    setTimeout(() => {
      setConnectionStatus('success');
      toast.success('Webhook test event sent successfully');
    }, 1800);
  }

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="flex min-h-full flex-col">

          {/* Header */}
          <div className="border-b bg-card px-6 py-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Plug className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">API & Integration Centre</h1>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      v1.0 — Stable
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">SafePlay Connect REST API · Webhooks · CSV Import · Developer documentation</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  API Operational
                </div>
              </div>
            </div>

            {/* Status Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {[
                { label: 'API Uptime (30d)', value: '99.98%', color: 'text-emerald-600' },
                { label: 'Avg Response', value: '43ms', color: 'text-blue-600' },
                { label: 'Active API Keys', value: MOCK_KEYS.filter(k => k.status === 'active').length.toString(), color: '' },
                { label: 'Events Today', value: '8,432', color: '' },
              ].map(k => (
                <div key={k.label} className="flex flex-col px-3 py-2 rounded-lg bg-muted/30 border">
                  <span className="text-[10px] text-muted-foreground mb-0.5">{k.label}</span>
                  <span className={`text-lg font-bold ${k.color}`}>{k.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 overflow-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b bg-card px-6 pt-2 pb-0">
                <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                  {[
                    { id: 'overview', label: 'Overview', icon: Globe },
                    { id: 'api-keys', label: 'API Keys', icon: Key },
                    { id: 'endpoints', label: 'API Reference', icon: Code },
                    { id: 'webhooks', label: 'Webhooks', icon: Zap },
                    { id: 'import', label: 'CSV Import', icon: Upload },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-none border-b-2 transition-colors ${isActive ? 'border-primary text-foreground bg-transparent' : 'border-transparent text-muted-foreground hover:text-foreground bg-transparent'}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <div className="flex-1 p-6 min-w-0">

                {/* ── OVERVIEW ── */}
                <TabsContent value="overview" className="mt-0 space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { icon: Activity, title: 'Real-Time Event Stream', desc: 'Push live betting session events — bets, wins, deposits, game changes — and receive instant risk scores within 50ms.', tag: 'REST API', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                      { icon: Zap, title: 'Webhook Alerts', desc: 'Receive instant push notifications when a player crosses risk thresholds, needs intervention, or triggers exclusion alerts.', tag: 'WebHook', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                      { icon: Shield, title: 'Compliance Automation', desc: 'Automatically record interventions, exclusions, and outcomes via API — eliminating manual data entry and audit risk.', tag: 'Automated', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    ].map((card, i) => {
                      const Icon = card.icon;
                      return (
                        <Card key={i} className={`border ${card.color.split(' ').slice(2).join(' ')}`}>
                          <CardContent className="pt-5 pb-5">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${card.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-semibold mb-1">{card.title}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
                            <Badge variant="outline" className="mt-3 text-[10px]">{card.tag}</Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Quick Start */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Quick Start — 5 Steps to Integration
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { step: '01', title: 'Generate your API key', desc: 'Go to API Keys tab → Create Key → Select scopes → Copy key securely.' },
                          { step: '02', title: 'Authenticate requests', desc: 'Include your key as a Bearer token: Authorization: Bearer sk_live_YOUR_KEY' },
                          { step: '03', title: 'Register your players', desc: 'POST /v1/players to register each player profile in the SafeBet IQ system.' },
                          { step: '04', title: 'Stream session events', desc: 'POST /v1/events/session for each bet, win, deposit, or game change. Receive real-time risk scores.' },
                          { step: '05', title: 'Handle webhook alerts', desc: 'Configure your webhook URL to receive push alerts for critical risk events, interventions, and exclusion breaches.' },
                        ].map((s, i) => (
                          <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-muted/20 border">
                            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {s.step}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{s.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Authentication */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lock className="h-4 w-4 text-primary" />
                        Authentication
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">All API requests must be authenticated using your API key as a Bearer token in the Authorization header.</p>
                      <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs relative">
                        <div className="text-slate-400 mb-1"># Example cURL request</div>
                        <div>curl -X POST https://api.safebetiq.com/v1/events/session \</div>
                        <div className="pl-4">-H "Authorization: Bearer sk_live_YOUR_API_KEY" \</div>
                        <div className="pl-4">-H "Content-Type: application/json" \</div>
                        <div className="pl-4">-d '&#123;"player_id": "PLY-100234", ...&#125;'</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-7 text-slate-400 hover:text-white"
                          onClick={() => copyToClipboard('curl -X POST https://api.safebetiq.com/v1/events/session -H "Authorization: Bearer sk_live_YOUR_API_KEY" -H "Content-Type: application/json"', 'auth-curl')}
                        >
                          {copiedId === 'auth-curl' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">Never expose API keys in client-side code or public repositories. Store keys securely in environment variables on your server.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── API KEYS ── */}
                <TabsContent value="api-keys" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold flex items-center gap-2"><Key className="h-5 w-5 text-primary" />API Keys</h2>
                      <p className="text-sm text-muted-foreground">Manage your integration keys and their scopes</p>
                    </div>
                    <Button size="sm">
                      <Key className="h-4 w-4 mr-1.5" />
                      Create New Key
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {MOCK_KEYS.map(apiKey => (
                      <Card key={apiKey.id} className={apiKey.status === 'revoked' ? 'opacity-60' : ''}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{apiKey.name}</p>
                                <Badge className={`text-xs border-0 ${apiKey.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {apiKey.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                  {showKey === apiKey.id ? 'sk_live_FULL_KEY_REDACTED_FOR_SECURITY' : apiKey.key}
                                </code>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowKey(showKey === apiKey.id ? null : apiKey.id)}>
                                  {showKey === apiKey.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(apiKey.key, `key-${apiKey.id}`)}>
                                  {copiedId === `key-${apiKey.id}` ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                {apiKey.scopes.map(s => (
                                  <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-xs text-right text-muted-foreground">
                              <p>Created {apiKey.created}</p>
                              <p className="mt-0.5">{apiKey.lastUsed ? `Last used ${new Date(apiKey.lastUsed).toLocaleDateString('en-ZA')}` : 'Never used'}</p>
                              {apiKey.status === 'active' && (
                                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
                                  Revoke
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center">
                      <Key className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Create a new API key for a new integration or environment</p>
                      <Button size="sm" className="mt-3">Create API Key</Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── API REFERENCE ── */}
                <TabsContent value="endpoints" className="mt-0 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h2 className="text-base font-semibold flex items-center gap-2"><Code className="h-5 w-5 text-primary" />API Reference</h2>
                      <p className="text-sm text-muted-foreground">SafePlay Connect REST API — Base URL: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">https://api.safebetiq.com</code></p>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-5 gap-4">
                    {/* Endpoint List */}
                    <div className="lg:col-span-2 space-y-2">
                      {API_ENDPOINTS.map((ep, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/30 ${selectedEndpoint?.path === ep.path ? 'border-primary bg-primary/5' : 'hover:bg-muted/20'}`}
                          onClick={() => setSelectedEndpoint(ep)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <MethodBadge method={ep.method} />
                            <code className="text-xs font-mono text-muted-foreground">{ep.path}</code>
                          </div>
                          <p className="text-xs font-medium">{ep.title}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {ep.scopes.map(s => <Badge key={s} variant="outline" className="text-[9px] font-mono px-1 py-0">{s}</Badge>)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Endpoint Detail */}
                    <div className="lg:col-span-3">
                      {selectedEndpoint ? (
                        <Card className="sticky top-0">
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <MethodBadge method={selectedEndpoint.method} />
                              <code className="text-sm font-mono">{selectedEndpoint.path}</code>
                            </div>
                            <CardTitle className="text-sm mt-2">{selectedEndpoint.title}</CardTitle>
                            <CardDescription className="text-xs">{selectedEndpoint.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {selectedEndpoint.requestBody && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Request Body</p>
                                <div className="relative">
                                  <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto max-h-52 font-mono">
                                    {selectedEndpoint.requestBody}
                                  </pre>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-2 right-2 h-6 text-slate-400 hover:text-white"
                                    onClick={() => copyToClipboard(selectedEndpoint.requestBody!, `req-${selectedEndpoint.path}`)}
                                  >
                                    {copiedId === `req-${selectedEndpoint.path}` ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                  </Button>
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Response Example</p>
                              <div className="relative">
                                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto max-h-52 font-mono">
                                  {selectedEndpoint.responseExample}
                                </pre>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-2 right-2 h-6 text-slate-400 hover:text-white"
                                  onClick={() => copyToClipboard(selectedEndpoint.responseExample, `res-${selectedEndpoint.path}`)}
                                >
                                  {copiedId === `res-${selectedEndpoint.path}` ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="h-full flex items-center justify-center p-12 border rounded-lg border-dashed">
                          <div className="text-center">
                            <Code className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-sm text-muted-foreground">Select an endpoint to view its documentation</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* ── WEBHOOKS ── */}
                <TabsContent value="webhooks" className="mt-0 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Webhook Configuration</h2>
                    <p className="text-sm text-muted-foreground">Receive real-time push notifications for critical risk events</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Webhook Endpoint URL</CardTitle>
                        <CardDescription className="text-xs">We will POST events to this URL in real time</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://your-system.co.za/api/safebet-webhook"
                            value={webhookUrl}
                            onChange={e => setWebhookUrl(e.target.value)}
                            className="text-sm flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={testConnection}
                            disabled={connectionStatus === 'testing'}
                          >
                            {connectionStatus === 'testing' ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Test'}
                          </Button>
                        </div>
                        {connectionStatus === 'success' && (
                          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Test event delivered successfully
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Subscribe to events:</p>
                          <div className="space-y-2">
                            {[
                              { event: 'player.risk_score_critical', desc: 'Player crosses 80 threshold' },
                              { event: 'player.risk_score_high', desc: 'Player crosses 60 threshold' },
                              { event: 'intervention.required', desc: 'AI recommends intervention' },
                              { event: 'exclusion.breach_detected', desc: 'Self-excluded player detected' },
                              { event: 'compliance.threshold_breach', desc: 'Compliance score drops' },
                            ].map(ev => (
                              <div key={ev.event} className="flex items-center gap-2 text-xs">
                                <div className="h-3 w-3 rounded border border-primary bg-primary/80 flex items-center justify-center">
                                  <CheckCircle2 className="h-2 w-2 text-white" />
                                </div>
                                <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{ev.event}</code>
                                <span className="text-muted-foreground">{ev.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button className="w-full" size="sm">Save Webhook Configuration</Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Example Handler</CardTitle>
                        <CardDescription className="text-xs">Node.js / Express webhook handler</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          <pre className="text-[10px] bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto max-h-[340px] font-mono leading-relaxed">
                            {WEBHOOK_EXAMPLE}
                          </pre>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-6 text-slate-400 hover:text-white"
                            onClick={() => copyToClipboard(WEBHOOK_EXAMPLE, 'webhook-example')}
                          >
                            {copiedId === 'webhook-example' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* ── CSV IMPORT ── */}
                <TabsContent value="import" className="mt-0 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />CSV Data Import</h2>
                    <p className="text-sm text-muted-foreground">For casinos not yet on live API — import player and session data via CSV</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      {
                        title: 'Player Register Import',
                        icon: Shield,
                        description: 'Upload your player register (opaque references only — no identity data) to enable monitoring.',
                        fields: 'casino_player_ref, registration_date, vip_tier',
                        template: 'player_register_template.csv',
                        color: 'text-blue-600 bg-blue-50 border-blue-200',
                      },
                      {
                        title: 'Session History Import',
                        icon: Activity,
                        description: 'Upload historical session data for retroactive risk analysis.',
                        fields: 'player_id, session_date, duration_minutes, game_type, total_bet, total_win, deposits',
                        template: 'session_history_template.csv',
                        color: 'text-orange-600 bg-orange-50 border-orange-200',
                      },
                      {
                        title: 'Intervention History',
                        icon: Bell,
                        description: 'Import historical intervention records for compliance continuity.',
                        fields: 'player_id, intervention_date, intervention_type, staff_id, outcome, notes',
                        template: 'intervention_history_template.csv',
                        color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
                      },
                      {
                        title: 'Self-Exclusion Register',
                        icon: Shield,
                        description: 'Import your existing self-exclusion records to the national network.',
                        fields: 'player_id, exclusion_date, duration, counselling_provider, expiry_date',
                        template: 'self_exclusion_template.csv',
                        color: 'text-red-600 bg-red-50 border-red-200',
                      },
                    ].map((imp, i) => {
                      const Icon = imp.icon;
                      return (
                        <Card key={i} className={`border ${imp.color.split(' ').slice(2).join(' ')}`}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${imp.color}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{imp.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{imp.description}</p>
                              </div>
                            </div>
                            <div className="bg-muted/30 rounded p-2 mb-3">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Required columns</p>
                              <p className="text-xs font-mono text-muted-foreground">{imp.fields}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5">
                                <Download className="h-3 w-3" />
                                Template
                              </Button>
                              <Button size="sm" className="flex-1 h-8 text-xs gap-1.5">
                                <Upload className="h-3 w-3" />
                                Upload CSV
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <Card className="border-amber-200 bg-amber-50/20">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">Data Import Guidelines</p>
                          <ul className="text-xs text-amber-700 mt-1.5 space-y-1">
                            <li>• All personal data must be hashed (SHA-256) before upload — we store hashes only, not raw PII</li>
                            <li>• Maximum file size: 50 MB per upload (approximately 250,000 rows)</li>
                            <li>• Files are validated and processed within 30 minutes — you will receive a confirmation email</li>
                            <li>• All imports are logged to the Audit Centre for POPIA §8 compliance</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

              </div>
            </Tabs>
          </div>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
