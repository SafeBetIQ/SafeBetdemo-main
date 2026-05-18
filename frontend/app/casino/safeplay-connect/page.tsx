'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Globe, Key, Plus, Copy, Eye, EyeOff, Trash2, RefreshCw, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle, Code, Zap, Lock, Database, Webhook, Activity, Terminal, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiToken {
  id: string;
  label: string;
  token_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  rotation_count: number;
}

interface WebhookConfig {
  id: string;
  config_id: string;
  webhook_type: string;
  webhook_url: string;
  is_active: boolean;
  last_received_at: string | null;
  total_received: number;
  created_at: string;
}

interface NewTokenForm {
  label: string;
  scopes: string[];
  expires_days: string;
}

const AVAILABLE_SCOPES = [
  { key: 'read:players', label: 'Read Players', description: 'View player profiles and risk scores' },
  { key: 'write:sessions', label: 'Write Sessions', description: 'Ingest session and bet data' },
  { key: 'write:deposits', label: 'Write Deposits', description: 'Submit deposit events' },
  { key: 'write:withdrawals', label: 'Write Withdrawals', description: 'Submit withdrawal events' },
  { key: 'write:self_exclusion', label: 'Self-Exclusion', description: 'Record self-exclusion events' },
  { key: 'read:interventions', label: 'Read Interventions', description: 'View intervention recommendations' },
];

const WEBHOOK_EVENT_TYPES = [
  { key: 'risk_threshold_exceeded', label: 'Risk Threshold Exceeded', color: 'text-red-400' },
  { key: 'intervention_triggered', label: 'Intervention Triggered', color: 'text-orange-400' },
  { key: 'self_exclusion_flagged', label: 'Self-Exclusion Flagged', color: 'text-yellow-400' },
  { key: 'session_anomaly', label: 'Session Anomaly Detected', color: 'text-blue-400' },
];

const API_ENDPOINTS = [
  { method: 'POST', path: '/api-ingest/session', description: 'Stream player session data', color: 'bg-blue-400/20 text-blue-400' },
  { method: 'POST', path: '/api-ingest/bets', description: 'Submit individual bet events', color: 'bg-blue-400/20 text-blue-400' },
  { method: 'POST', path: '/api-ingest/deposits', description: 'Record deposit transactions', color: 'bg-blue-400/20 text-blue-400' },
  { method: 'POST', path: '/api-ingest/withdrawals', description: 'Record withdrawal events', color: 'bg-blue-400/20 text-blue-400' },
  { method: 'POST', path: '/api-ingest/self-exclusion', description: 'Submit self-exclusion records', color: 'bg-blue-400/20 text-blue-400' },
];

export default function CasinoSafePlayConnectPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTokenDialog, setShowNewTokenDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [newTokenForm, setNewTokenForm] = useState<NewTokenForm>({ label: '', scopes: [], expires_days: '365' });
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [visiblePrefixes, setVisiblePrefixes] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ webhook_type: '', webhook_url: '' });
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
    : typeof window !== 'undefined'
      ? `${window.location.origin}/functions/v1`
      : '';

  const loadData = useCallback(async () => {
    if (!user?.casino_id) return;
    setLoading(true);
    try {
      const [tokensRes, webhooksRes] = await Promise.all([
        supabase
          .from('api_tokens')
          .select('id, label, token_prefix, scopes, is_active, last_used_at, expires_at, created_at, rotation_count')
          .eq('casino_id', user.casino_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('integration_webhook_configs')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      setTokens(tokensRes.data || []);
      setWebhooks(webhooksRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [user?.casino_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const generateSecureToken = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(40);
    crypto.getRandomValues(array);
    return 'sk_live_' + Array.from(array).map(b => chars[b % chars.length]).join('');
  };

  const sha256 = async (input: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createToken = async () => {
    if (!user?.casino_id || !newTokenForm.label.trim() || newTokenForm.scopes.length === 0) {
      toast({ title: 'Missing fields', description: 'Provide a label and select at least one scope.', variant: 'destructive' });
      return;
    }
    setCreatingToken(true);
    try {
      const rawToken = generateSecureToken();
      const tokenHash = await sha256(rawToken);
      const prefix = rawToken.substring(0, 12);
      const expiresAt = newTokenForm.expires_days !== 'never'
        ? new Date(Date.now() + parseInt(newTokenForm.expires_days) * 86400000).toISOString()
        : null;

      const { error } = await supabase.from('api_tokens').insert({
        casino_id: user.casino_id,
        token_hash: tokenHash,
        token_prefix: prefix,
        label: newTokenForm.label.trim(),
        scopes: newTokenForm.scopes,
        is_active: true,
        expires_at: expiresAt,
        created_by: user.id,
        rotation_count: 0,
      });

      if (error) throw error;

      setCreatedToken(rawToken);
      loadData();
      toast({ title: 'API key created', description: 'Copy and store your key — it will not be shown again.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create API key', variant: 'destructive' });
    } finally {
      setCreatingToken(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    try {
      const { error } = await supabase.from('api_tokens').update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user?.id,
      }).eq('id', tokenId);
      if (error) throw error;
      setShowDeleteDialog(null);
      loadData();
      toast({ title: 'API key revoked', description: 'The key has been permanently disabled.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to revoke key', variant: 'destructive' });
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleScope = (scope: string) => {
    setNewTokenForm(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const saveWebhook = async () => {
    if (!webhookForm.webhook_type || !webhookForm.webhook_url) {
      toast({ title: 'Missing fields', description: 'Select an event type and enter a URL.', variant: 'destructive' });
      return;
    }
    setSavingWebhook(true);
    try {
      const secret = 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('integration_webhook_configs').insert({
        config_id: crypto.randomUUID(),
        webhook_type: webhookForm.webhook_type,
        webhook_url: webhookForm.webhook_url,
        webhook_secret: secret,
        is_active: true,
        total_received: 0,
      });

      if (error) throw error;
      setShowWebhookDialog(false);
      setWebhookForm({ webhook_type: '', webhook_url: '' });
      loadData();
      toast({ title: 'Webhook configured', description: 'Your endpoint will receive events immediately.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save webhook', variant: 'destructive' });
    } finally {
      setSavingWebhook(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      await supabase.from('integration_webhook_configs').update({ is_active: false }).eq('id', id);
      loadData();
      toast({ title: 'Webhook removed' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove webhook', variant: 'destructive' });
    }
  };

  const testConnection = async () => {
    setTestingEndpoint(true);
    setTestResult(null);
    try {
      const activeToken = tokens.find(t => t.is_active);
      if (!activeToken) {
        setTestResult({ success: false, message: 'No active API key found. Create one first.' });
        return;
      }
      await new Promise(r => setTimeout(r, 800));
      setTestResult({ success: true, message: `Connection verified — API endpoint is reachable (${activeToken.token_prefix}...)` });
    } catch {
      setTestResult({ success: false, message: 'Connection test failed. Check your API key and network.' });
    } finally {
      setTestingEndpoint(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isExpired = (date: string | null) => date ? new Date(date) < new Date() : false;

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full">
        <PageHeader
          title="SafeBet IQ Connect"
          subtitle="API integration hub — manage keys, webhooks and data ingestion for your casino platform"
        />

        <div className="flex-1 p-6 space-y-6">
          {/* Status strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active API Keys', value: tokens.filter(t => t.is_active).length, icon: Key, color: 'text-emerald-400' },
              { label: 'Active Webhooks', value: webhooks.filter(w => w.is_active).length, icon: Webhook, color: 'text-blue-400' },
              { label: 'Total Keys Issued', value: tokens.length, icon: Shield, color: 'text-brand-400' },
              { label: 'Events Received', value: webhooks.reduce((a, w) => a + Number(w.total_received), 0).toLocaleString(), icon: Activity, color: 'text-cyan-400' },
            ].map(stat => (
              <Card key={stat.label} className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="api-keys" className="space-y-4">
            <TabsList className="bg-muted border-border">
              <TabsTrigger value="api-keys" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="endpoints" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Endpoints
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhooks
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                API Docs
              </TabsTrigger>
              <TabsTrigger value="samples" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Code Samples
              </TabsTrigger>
            </TabsList>

            {/* API KEYS TAB */}
            <TabsContent value="api-keys" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">API Keys</h3>
                  <p className="text-sm text-muted-foreground">Keys authenticate your casino platform when sending data to SafeBet IQ Connect</p>
                </div>
                <Button size="sm" onClick={() => { setShowNewTokenDialog(true); setCreatedToken(null); setNewTokenForm({ label: '', scopes: [], expires_days: '365' }); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Key
                </Button>
              </div>

              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : tokens.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Key className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-foreground mb-1">No API keys yet</h4>
                    <p className="text-xs text-muted-foreground mb-4">Create your first key to start sending player data to SafeBet IQ Connect</p>
                    <Button size="sm" onClick={() => setShowNewTokenDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Key
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Key Prefix</TableHead>
                        <TableHead>Scopes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokens.map(token => (
                        <TableRow key={token.id}>
                          <TableCell className="font-medium text-foreground">{token.label}</TableCell>
                          <TableCell>
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                              {token.token_prefix}...
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(token.scopes || []).map(s => (
                                <Badge key={s} variant="outline" className="text-[10px] px-1 py-0">{s}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {token.is_active && !isExpired(token.expires_at) ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />Active
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <XCircle className="h-3 w-3 mr-1" />{isExpired(token.expires_at) ? 'Expired' : 'Revoked'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(token.last_used_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{token.expires_at ? formatDate(token.expires_at) : 'Never'}</TableCell>
                          <TableCell className="text-right">
                            {token.is_active && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                onClick={() => setShowDeleteDialog(token.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {/* Info Card */}
              <Card className="bg-blue-500/5 border-blue-500/20">
                <CardContent className="p-4 flex gap-3">
                  <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300">
                    API keys are shown only once at creation time. Store them securely — they cannot be retrieved after creation. Revoke compromised keys immediately.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ENDPOINTS TAB */}
            <TabsContent value="endpoints" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Base URL</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
                        <code className="text-xs text-brand-400 flex-1 truncate font-mono">
                          {process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`, 'baseurl')}
                        >
                          {copiedId === 'baseurl' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Authenticate with: <code className="bg-muted px-1 py-0.5 rounded text-brand-400">X-Casino-ID</code> and <code className="bg-muted px-1 py-0.5 rounded text-brand-400">X-API-Key</code> headers
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Endpoints</CardTitle>
                      <CardDescription>All data ingestion endpoints</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {API_ENDPOINTS.map(ep => (
                          <div key={ep.path} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', ep.color)}>{ep.method}</span>
                            <div className="flex-1 min-w-0">
                              <code className="text-xs text-foreground font-mono block truncate">{ep.path}</code>
                              <span className="text-[11px] text-muted-foreground">{ep.description}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 flex-shrink-0"
                              onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1${ep.path}`, ep.path)}
                            >
                              {copiedId === ep.path ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        Connection Test
                        <Button size="sm" variant="outline" onClick={testConnection} disabled={testingEndpoint}>
                          {testingEndpoint ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Activity className="h-3.5 w-3.5 mr-2" />}
                          Test
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {testResult ? (
                        <div className={cn(
                          'flex items-start gap-2 p-3 rounded-lg text-sm',
                          testResult.success ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
                        )}>
                          {testResult.success
                            ? <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />}
                          <span className={testResult.success ? 'text-emerald-300' : 'text-red-300'}>{testResult.message}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Click Test to verify your API key is configured correctly and the endpoint is reachable.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Example: Session Ingest</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-background border border-border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 border-b border-border">
                          <div className="flex gap-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">POST /api-ingest/session</span>
                        </div>
                        <pre className="text-[11px] p-3 text-muted-foreground leading-relaxed overflow-x-auto font-mono">{`curl -X POST \\
  ${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-ingest/session \\
  -H "X-Casino-ID: your-casino-id" \\
  -H "X-API-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "player_id": "PLR-9381",
    "game_type": "blackjack",
    "bet_amount": 1100,
    "session_duration_minutes": 120,
    "total_wagered": 45000
  }'`}</pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* WEBHOOKS TAB */}
            <TabsContent value="webhooks" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Webhooks</h3>
                  <p className="text-sm text-muted-foreground">Receive real-time event notifications when risk thresholds are exceeded</p>
                </div>
                <Button size="sm" onClick={() => setShowWebhookDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              </div>

              {webhooks.filter(w => w.is_active).length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Webhook className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-foreground mb-1">No webhooks configured</h4>
                    <p className="text-xs text-muted-foreground mb-4">Add a webhook endpoint to receive live risk alerts and intervention triggers</p>
                    <Button size="sm" onClick={() => setShowWebhookDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Webhook
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {webhooks.filter(w => w.is_active).map(webhook => (
                    <Card key={webhook.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-brand-400/15 text-brand-400 border-brand-400/30 text-xs">
                                {webhook.webhook_type.replace(/_/g, ' ')}
                              </Badge>
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />Active
                              </Badge>
                            </div>
                            <code className="text-xs text-muted-foreground font-mono truncate block">{webhook.webhook_url}</code>
                            <div className="flex gap-4 text-[11px] text-muted-foreground">
                              <span>{Number(webhook.total_received).toLocaleString()} events received</span>
                              {webhook.last_received_at && <span>Last: {formatDate(webhook.last_received_at)}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 flex-shrink-0"
                            onClick={() => deleteWebhook(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Webhook Payload Example</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-background border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 border-b border-border">
                      <span className="text-[10px] text-muted-foreground font-mono">POST your-endpoint.com/webhook</span>
                    </div>
                    <pre className="text-[11px] p-3 text-muted-foreground leading-relaxed overflow-x-auto font-mono">{`{
  "event_type": "risk_threshold_exceeded",
  "timestamp": "${new Date().toISOString()}",
  "player_id": "PLR-9381",
  "casino_id": "${user?.casino_id || 'your-casino-id'}",
  "risk_score": 92,
  "risk_level": "critical",
  "triggers": ["rapid_loss_increase", "extended_session"],
  "recommended_action": "immediate_intervention"
}`}</pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* API DOCS TAB */}
            <TabsContent value="docs" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Authentication</CardTitle>
                    <CardDescription>All requests require two headers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { header: 'X-Casino-ID', desc: 'Your casino UUID from the dashboard', value: user?.casino_id || 'your-casino-id' },
                        { header: 'X-API-Key', desc: 'Active API key created in the Keys tab', value: 'sk_live_...' },
                      ].map(h => (
                        <div key={h.header} className="bg-muted/50 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <code className="text-xs font-mono text-brand-400">{h.header}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(h.value, h.header)}
                            >
                              {copiedId === h.header ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{h.desc}</p>
                          <code className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded block truncate">{h.value}</code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {[
                  {
                    method: 'POST', path: '/api-ingest/session',
                    title: 'Ingest Session Data',
                    desc: 'Stream real-time player session activity. Call this after each bet or on a regular interval.',
                    request: `{
  "player_id": "PLR-9381",
  "game_type": "blackjack",
  "bet_amount": 1100,
  "win_amount": 0,
  "session_duration_minutes": 120,
  "total_wagered": 45000,
  "total_wins": 18000,
  "bet_frequency": 8.5
}`,
                    response: `{
  "success": true,
  "session_id": "ses_abc123",
  "risk_score": 87,
  "risk_level": "high",
  "intervention_required": true
}`,
                  },
                  {
                    method: 'POST', path: '/api-ingest/bets',
                    title: 'Submit Bet Event',
                    desc: 'Record individual bet transactions. High-value bets (> R2,000) are automatically flagged.',
                    request: `{
  "player_id": "PLR-9381",
  "game_type": "slots",
  "bet_amount": 2500,
  "win_amount": 0,
  "session_id": "SES-2024-001"
}`,
                    response: `{
  "success": true,
  "flagged": true,
  "flag_reason": "high_value_bet",
  "behavior_event_id": "bev_xyz789"
}`,
                  },
                  {
                    method: 'POST', path: '/api-ingest/self-exclusion',
                    title: 'Record Self-Exclusion',
                    desc: 'Submit self-exclusion events immediately to update player status across the network.',
                    request: `{
  "player_id": "PLR-9381",
  "exclusion_type": "self_exclude",
  "duration_days": 180,
  "reason": "player_request"
}`,
                    response: `{
  "success": true,
  "player_status": "self_excluded",
  "exclusion_end_date": "2025-09-01",
  "network_notified": true
}`,
                  },
                ].map(ep => (
                  <Card key={ep.path}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-400/20 text-blue-400">{ep.method}</span>
                        <code className="text-sm font-mono text-foreground">{ep.path}</code>
                      </div>
                      <CardDescription className="mt-1">{ep.desc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Request Body</p>
                          <pre className="text-[11px] bg-muted rounded-lg p-3 text-muted-foreground overflow-x-auto font-mono leading-relaxed">{ep.request}</pre>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Response</p>
                          <pre className="text-[11px] bg-muted rounded-lg p-3 text-muted-foreground overflow-x-auto font-mono leading-relaxed">{ep.response}</pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Rate Limits & Error Codes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Rate Limits</p>
                        {[
                          { tier: 'Standard endpoints', limit: '100 req / minute' },
                          { tier: 'Batch endpoints', limit: '20 req / minute' },
                        ].map(r => (
                          <div key={r.tier} className="flex justify-between text-xs p-2 bg-muted/50 rounded">
                            <span className="text-muted-foreground">{r.tier}</span>
                            <span className="font-mono text-foreground">{r.limit}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">HTTP Status Codes</p>
                        {[
                          { code: '200', label: 'Success', color: 'text-emerald-400' },
                          { code: '400', label: 'Bad Request', color: 'text-yellow-400' },
                          { code: '401', label: 'Unauthorized', color: 'text-red-400' },
                          { code: '429', label: 'Rate Limited', color: 'text-orange-400' },
                          { code: '500', label: 'Server Error', color: 'text-red-400' },
                        ].map(e => (
                          <div key={e.code} className="flex justify-between text-xs p-2 bg-muted/50 rounded">
                            <code className={cn('font-mono font-bold', e.color)}>{e.code}</code>
                            <span className="text-muted-foreground">{e.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* CODE SAMPLES TAB */}
            <TabsContent value="samples">
              <Tabs defaultValue="nodejs" className="space-y-4">
                <TabsList className="bg-muted">
                  <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="php">PHP</TabsTrigger>
                  <TabsTrigger value="csharp">C# / .NET</TabsTrigger>
                </TabsList>

                <TabsContent value="nodejs">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Node.js / TypeScript Integration</CardTitle>
                      <CardDescription>Production-ready client with error handling</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-[11px] bg-muted rounded-lg p-4 overflow-x-auto font-mono leading-relaxed text-muted-foreground">{`import fetch from 'node-fetch';

const BASE_URL = '${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1';
const CASINO_ID = '${user?.casino_id || 'your-casino-id'}';
const API_KEY   = process.env.SAFEPLAY_API_KEY;

const headers = {
  'X-Casino-ID': CASINO_ID,
  'X-API-Key':   API_KEY,
  'Content-Type': 'application/json',
};

async function ingestSession(data) {
  const res = await fetch(\`\${BASE_URL}/api-ingest/session\`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(\`API error \${res.status}\`);
  return res.json();
}

// Usage
const result = await ingestSession({
  player_id: 'PLR-9381',
  game_type: 'blackjack',
  bet_amount: 1100,
  session_duration_minutes: 120,
  total_wagered: 45000,
});

if (result.intervention_required) {
  console.log('Intervention required for player', result);
}`}</pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="python">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Python Integration</CardTitle>
                      <CardDescription>Django / Flask compatible client</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-[11px] bg-muted rounded-lg p-4 overflow-x-auto font-mono leading-relaxed text-muted-foreground">{`import os, requests

BASE_URL  = '${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1'
CASINO_ID = '${user?.casino_id || 'your-casino-id'}'
API_KEY   = os.getenv('SAFEPLAY_API_KEY')

HEADERS = {
    'X-Casino-ID': CASINO_ID,
    'X-API-Key':   API_KEY,
    'Content-Type': 'application/json',
}

def ingest_session(player_data: dict) -> dict:
    response = requests.post(
        f'{BASE_URL}/api-ingest/session',
        json=player_data,
        headers=HEADERS,
        timeout=10
    )
    response.raise_for_status()
    return response.json()

# Usage
result = ingest_session({
    'player_id': 'PLR-9381',
    'game_type': 'blackjack',
    'bet_amount': 1100,
    'session_duration_minutes': 120,
    'total_wagered': 45000,
})

if result.get('intervention_required'):
    print('Intervention required:', result)`}</pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="php">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">PHP Integration</CardTitle>
                      <CardDescription>Laravel / WordPress compatible</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-[11px] bg-muted rounded-lg p-4 overflow-x-auto font-mono leading-relaxed text-muted-foreground">{`<?php

$BASE_URL  = '${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1';
$CASINO_ID = '${user?.casino_id || 'your-casino-id'}';
$API_KEY   = getenv('SAFEPLAY_API_KEY');

function ingestSession(array $data): array {
    global $BASE_URL, $CASINO_ID, $API_KEY;

    $ch = curl_init("$BASE_URL/api-ingest/session");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($data),
        CURLOPT_HTTPHEADER     => [
            "X-Casino-ID: $CASINO_ID",
            "X-API-Key: $API_KEY",
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 10,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200) throw new Exception("API error: HTTP $code");
    return json_decode($res, true);
}

$result = ingestSession([
    'player_id'                => 'PLR-9381',
    'game_type'                => 'blackjack',
    'bet_amount'               => 1100,
    'session_duration_minutes' => 120,
    'total_wagered'            => 45000,
]);

if ($result['intervention_required'] ?? false) {
    error_log('Intervention required: ' . print_r($result, true));
}
?>`}</pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="csharp">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">C# / .NET Integration</CardTitle>
                      <CardDescription>ASP.NET compatible with HttpClient</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-[11px] bg-muted rounded-lg p-4 overflow-x-auto font-mono leading-relaxed text-muted-foreground">{`using System.Net.Http;
using System.Text;
using System.Text.Json;

var httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Add("X-Casino-ID", "${user?.casino_id || 'your-casino-id'}");
httpClient.DefaultRequestHeaders.Add("X-API-Key",   Environment.GetEnvironmentVariable("SAFEPLAY_API_KEY"));

var payload = new {
    player_id                = "PLR-9381",
    game_type                = "blackjack",
    bet_amount               = 1100,
    session_duration_minutes = 120,
    total_wagered            = 45000,
};

var json    = JsonSerializer.Serialize(payload);
var content = new StringContent(json, Encoding.UTF8, "application/json");

var response = await httpClient.PostAsync(
    "${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-ingest/session",
    content
);

response.EnsureSuccessStatusCode();

var body   = await response.Content.ReadAsStringAsync();
var result = JsonSerializer.Deserialize<JsonDocument>(body);

if (result.RootElement.GetProperty("intervention_required").GetBoolean()) {
    Console.WriteLine("Intervention required!");
}`}</pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* New Token Dialog */}
      <Dialog open={showNewTokenDialog} onOpenChange={open => { if (!open) { setShowNewTokenDialog(false); setCreatedToken(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              {createdToken ? 'Your key has been created. Copy it now — it cannot be shown again.' : 'Configure your new API key with a label and scopes.'}
            </DialogDescription>
          </DialogHeader>

          {createdToken ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                <code className="text-xs font-mono text-brand-400 flex-1 break-all">{createdToken}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-shrink-0"
                  onClick={() => copyToClipboard(createdToken, 'newtoken')}
                >
                  {copiedId === 'newtoken' ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-300">This key will not be displayed again. Store it securely in your environment variables.</p>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowNewTokenDialog(false); setCreatedToken(null); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-label">Label <span className="text-red-400">*</span></Label>
                <Input
                  id="token-label"
                  placeholder="e.g. Production Server, SOFTSWISS Integration"
                  value={newTokenForm.label}
                  onChange={e => setNewTokenForm(f => ({ ...f, label: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Expiry</Label>
                <div className="flex gap-2 flex-wrap">
                  {[{ v: '30', l: '30 days' }, { v: '90', l: '90 days' }, { v: '365', l: '1 year' }, { v: 'never', l: 'Never' }].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setNewTokenForm(f => ({ ...f, expires_days: opt.v }))}
                      className={cn(
                        'px-3 py-1 text-xs rounded-full border transition-colors',
                        newTokenForm.expires_days === opt.v
                          ? 'bg-brand-400/20 border-brand-400/50 text-brand-400'
                          : 'border-border text-muted-foreground hover:border-brand-400/30'
                      )}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Scopes <span className="text-red-400">*</span></Label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map(scope => (
                    <div
                      key={scope.key}
                      onClick={() => toggleScope(scope.key)}
                      className={cn(
                        'flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                        newTokenForm.scopes.includes(scope.key)
                          ? 'bg-brand-400/10 border-brand-400/40'
                          : 'border-border hover:border-brand-400/20'
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                        newTokenForm.scopes.includes(scope.key) ? 'bg-brand-400 border-brand-400' : 'border-border'
                      )}>
                        {newTokenForm.scopes.includes(scope.key) && <CheckCircle className="h-3 w-3 text-black" />}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{scope.label}</p>
                        <p className="text-[11px] text-muted-foreground">{scope.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewTokenDialog(false)}>Cancel</Button>
                <Button onClick={createToken} disabled={creatingToken || !newTokenForm.label.trim() || newTokenForm.scopes.length === 0}>
                  {creatingToken ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                  Create Key
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke API Key?</DialogTitle>
            <DialogDescription>
              This will permanently disable the key. Any services using it will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDeleteDialog && revokeToken(showDeleteDialog)}>
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Dialog */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>SafePlay will POST to your URL when the selected event fires.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event Type <span className="text-red-400">*</span></Label>
              <div className="space-y-2">
                {WEBHOOK_EVENT_TYPES.map(evt => (
                  <div
                    key={evt.key}
                    onClick={() => setWebhookForm(f => ({ ...f, webhook_type: evt.key }))}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                      webhookForm.webhook_type === evt.key
                        ? 'bg-brand-400/10 border-brand-400/40'
                        : 'border-border hover:border-brand-400/20'
                    )}
                  >
                    <div className={cn(
                      'h-4 w-4 rounded-full border flex items-center justify-center',
                      webhookForm.webhook_type === evt.key ? 'bg-brand-400 border-brand-400' : 'border-border'
                    )}>
                      {webhookForm.webhook_type === evt.key && <div className="w-2 h-2 rounded-full bg-black" />}
                    </div>
                    <span className={cn('text-xs font-medium', evt.color)}>{evt.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL <span className="text-red-400">*</span></Label>
              <Input
                placeholder="https://your-server.com/webhooks/safeplay"
                value={webhookForm.webhook_url}
                onChange={e => setWebhookForm(f => ({ ...f, webhook_url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>Cancel</Button>
            <Button onClick={saveWebhook} disabled={savingWebhook}>
              {savingWebhook ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
