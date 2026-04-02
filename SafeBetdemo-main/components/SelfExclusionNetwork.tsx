'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ShieldOff, ShieldCheck, Radio, Building2, TriangleAlert as AlertTriangle, Lock, RefreshCw, Send, CircleCheck as CheckCircle2, Clock, Circle as XCircle, Eye, ChevronRight, Users, Globe, Zap, FileWarning, Network, CircleDot, BadgeAlert, ArrowRight, Wifi } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExclusionEvent {
  id: string;
  submitting_casino_id: string;
  pseudonym_token: string;
  exclusion_type: string;
  exclusion_reason: string;
  duration_months: number;
  exclusion_start_date: string;
  exclusion_end_date: string;
  is_permanent: boolean;
  risk_score_at_exclusion: number;
  cross_operator_history: boolean;
  previous_exclusions: number;
  status: string;
  reported_to_nrgp: boolean;
  nrgp_reference: string | null;
  created_at: string;
  casino?: { name: string };
}

interface ProtectionBroadcast {
  id: string;
  originating_casino_id: string;
  pseudonym_token: string;
  broadcast_scope: string;
  protection_action: string;
  protection_level: string;
  confidence_score: number;
  exclusion_type: string;
  duration_months: number;
  is_permanent: boolean;
  risk_score_at_exclusion: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  operators_notified: number;
  acknowledgements_received: number;
  created_at: string;
  casino?: { name: string };
}

interface BreachDetection {
  id: string;
  broadcast_id: string;
  detecting_casino_id: string;
  originating_casino_id: string;
  pseudonym_token: string;
  detection_method: string;
  detection_context: string;
  response_action: string | null;
  response_time_minutes: number | null;
  amount_deposited_before_detection: number;
  session_duration_before_detection: number;
  severity: string;
  status: string;
  regulatory_report_filed: boolean;
  nrgp_notified: boolean;
  detected_at: string;
  responded_at: string | null;
  detecting?: { name: string };
  originating?: { name: string };
}

interface Subscriber {
  id: string;
  casino_id: string;
  subscription_type: string;
  is_active: boolean;
  receives_broadcasts: boolean;
  submits_events: boolean;
  enrolled_at: string;
  total_events_submitted: number;
  total_broadcasts_received: number;
  casino?: { name: string; province: string };
}

interface NetworkStats {
  total_events: number;
  events_by_status: Record<string, number>;
  events_by_type: Record<string, number>;
  total_broadcasts: number;
  active_broadcasts: number;
  total_breaches: number;
  open_breaches: number;
  reported_breaches: number;
  operator_subscribers: number;
  permanent_exclusions: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const EXCLUSION_TYPE_LABELS: Record<string, string> = {
  voluntary_self_exclusion: 'Voluntary Self-Exclusion',
  operator_initiated:       'Operator Initiated',
  regulatory_order:         'Regulatory Order',
  family_requested:         'Family Requested',
  national_register:        'National Register',
};

const STATUS_CONFIG: Record<string, { badge: string; dot: string; label: string }> = {
  pending:   { badge: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-500',  label: 'Pending' },
  validated: { badge: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500',    label: 'Validated' },
  broadcast: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Broadcast' },
  expired:   { badge: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400',   label: 'Expired' },
  revoked:   { badge: 'bg-red-100 text-red-700',        dot: 'bg-red-500',     label: 'Revoked' },
};

const PROTECTION_ACTION_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  block_access:       { label: 'Block Access',       badge: 'bg-red-100 text-red-700',       icon: ShieldOff },
  flag_for_review:    { label: 'Flag for Review',    badge: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  restrict_deposits:  { label: 'Restrict Deposits',  badge: 'bg-yellow-100 text-yellow-700', icon: Zap },
  mandatory_check:    { label: 'Mandatory Check',    badge: 'bg-blue-100 text-blue-700',     icon: Eye },
  alert_operator:     { label: 'Alert Operator',     badge: 'bg-slate-100 text-slate-700',   icon: Radio },
};

const BREACH_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  open:      { badge: 'bg-red-100 text-red-700',       label: 'Open' },
  responded: { badge: 'bg-orange-100 text-orange-700', label: 'Responded' },
  reported:  { badge: 'bg-blue-100 text-blue-700',     label: 'Reported' },
  closed:    { badge: 'bg-emerald-100 text-emerald-700', label: 'Closed' },
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  full_network:          'Full Network',
  province_only:         'Province Only',
  mutual:                'Mutual',
  national_register_only: 'National Register',
};

function maskToken(token: string): string {
  if (!token || token.length < 12) return '***';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

// ─── Submit Event Dialog ──────────────────────────────────────────────────────

function SubmitEventDialog({
  open,
  onOpenChange,
  casinoId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  casinoId: string;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    exclusion_type: 'voluntary_self_exclusion',
    exclusion_reason: '',
    duration_months: '6',
    is_permanent: false,
    reported_to_nrgp: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ pseudonym_token: string; message: string } | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(
        `${supabaseUrl}/functions/v1/self-exclusion-network?action=submit-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          },
          body: JSON.stringify({
            casino_id: casinoId,
            exclusion_type: form.exclusion_type,
            exclusion_reason: form.exclusion_reason,
            duration_months: parseInt(form.duration_months),
            is_permanent: form.is_permanent,
            reported_to_nrgp: form.reported_to_nrgp,
          }),
        }
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      // Auto-broadcast
      const broadcastResp = await fetch(
        `${supabaseUrl}/functions/v1/self-exclusion-network?action=broadcast`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          },
          body: JSON.stringify({ event_id: data.event.id }),
        }
      );
      const broadcastData = await broadcastResp.json();

      setResult({
        pseudonym_token: data.pseudonym_token,
        message: broadcastData.message || 'Event submitted and broadcast.',
      });
      onSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setResult(null);
    setForm({ exclusion_type: 'voluntary_self_exclusion', exclusion_reason: '', duration_months: '6', is_permanent: false, reported_to_nrgp: false });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Submit Exclusion Event
          </DialogTitle>
          <DialogDescription>
            Submit a self-exclusion event to the SafeBet IQ network. Protection intelligence will be broadcast to all subscribed operators.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold text-emerald-700">Event Submitted & Broadcast</span>
              </div>
              <p className="text-sm text-emerald-700">{result.message}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-dashed">
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Assigned Pseudonym Token</span>
              </div>
              <p className="font-mono text-xs break-all">{result.pseudonym_token}</p>
            </div>
            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Exclusion Type</label>
                <Select value={form.exclusion_type} onValueChange={v => setForm(f => ({ ...f, exclusion_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXCLUSION_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Duration (months)</label>
                <Select value={form.duration_months} onValueChange={v => setForm(f => ({ ...f, duration_months: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['6', '12', '18', '24', '36', '60', '120'].map(m => (
                      <SelectItem key={m} value={m}>{m} months{m === '120' ? ' (10 years)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Reason (optional)</label>
                <Input
                  placeholder="Brief reason or context..."
                  value={form.exclusion_reason}
                  onChange={e => setForm(f => ({ ...f, exclusion_reason: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                <div>
                  <p className="text-sm font-medium">Reported to NRGP</p>
                  <p className="text-xs text-muted-foreground">Has this been filed with the national register?</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, reported_to_nrgp: !f.reported_to_nrgp }))}
                  className={`w-10 h-6 rounded-full transition-colors ${form.reported_to_nrgp ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${form.reported_to_nrgp ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
                Submit & Broadcast
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SelfExclusionNetworkProps {
  casinoId?: string;
}

export function SelfExclusionNetwork({ casinoId }: SelfExclusionNetworkProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState<ExclusionEvent[]>([]);
  const [broadcasts, setBroadcasts] = useState<ProtectionBroadcast[]>([]);
  const [breaches, setBreaches] = useState<BreachDetection[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExclusionEvent | null>(null);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [tokenCheckResult, setTokenCheckResult] = useState<{ status: string; message: string; active_broadcasts?: number } | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);

  const effectiveCasinoId = casinoId || user?.casino_id;
  const isAdmin = user?.role === 'super_admin';

  const loadData = useCallback(async () => {
    const [eventsRes, broadcastsRes, breachesRes, subscribersRes] = await Promise.all([
      supabase.from('sen_exclusion_events')
        .select('*, casino:casinos(name)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('sen_protection_broadcasts')
        .select('*, casino:casinos!originating_casino_id(name)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('sen_breach_detections')
        .select('*, detecting:casinos!detecting_casino_id(name), originating:casinos!originating_casino_id(name)')
        .order('detected_at', { ascending: false }).limit(50),
      supabase.from('sen_operator_subscriptions')
        .select('*, casino:casinos(name, province)')
        .order('enrolled_at', { ascending: false }),
    ]);

    // Compute stats from loaded data
    const evData = eventsRes.data || [];
    const brData = broadcastsRes.data || [];
    const bdData = breachesRes.data || [];

    setEvents(evData);
    setBroadcasts(brData);
    setBreaches(bdData);
    setSubscribers(subscribersRes.data || []);
    setStats({
      total_events: evData.length,
      events_by_status: evData.reduce((a: Record<string, number>, e) => { a[e.status] = (a[e.status] || 0) + 1; return a; }, {}),
      events_by_type: evData.reduce((a: Record<string, number>, e) => { a[e.exclusion_type] = (a[e.exclusion_type] || 0) + 1; return a; }, {}),
      total_broadcasts: brData.length,
      active_broadcasts: brData.filter(b => b.is_active && new Date(b.valid_until) > new Date()).length,
      total_breaches: bdData.length,
      open_breaches: bdData.filter(b => b.status === 'open').length,
      reported_breaches: bdData.filter(b => b.regulatory_report_filed).length,
      operator_subscribers: subscribersRes.data?.filter(s => s.is_active).length || 0,
      permanent_exclusions: evData.filter(e => e.is_permanent).length,
    });
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleCheckToken() {
    if (!tokenSearch.trim()) return;
    setCheckingToken(true);
    const { data: broadcasts } = await supabase
      .from('sen_protection_broadcasts')
      .select('id, protection_action, is_active, valid_until')
      .eq('pseudonym_token', tokenSearch.trim())
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString());
    setCheckingToken(false);
    if (!broadcasts || broadcasts.length === 0) {
      setTokenCheckResult({ status: 'clear', message: 'No active protection broadcasts found for this token.' });
    } else {
      setTokenCheckResult({
        status: 'protected',
        message: `Player token has ${broadcasts.length} active broadcast(s). Action required: ${broadcasts[0].protection_action.replace(/_/g, ' ')}.`,
        active_broadcasts: broadcasts.length,
      });
    }
  }

  // Build timeline chart from events (last 30 days)
  const timelineData = Array.from({ length: 10 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (9 - i) * 3);
    const label = d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
    const from = new Date(d); from.setDate(from.getDate() - 3);
    const count = events.filter(e => {
      const ed = new Date(e.created_at);
      return ed >= from && ed <= d;
    }).length;
    const bcount = broadcasts.filter(b => {
      const bd = new Date(b.created_at);
      return bd >= from && bd <= d;
    }).length;
    return { label, events: count, broadcasts: bcount };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center relative">
              <ShieldCheck className="h-5 w-5 text-white" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Self-Exclusion Monitoring Network</h2>
              <p className="text-sm text-muted-foreground">
                Cross-operator protection intelligence — distributed across {stats?.operator_subscribers || 0} operators
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <Wifi className="h-3 w-3" />
              Network Active
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {effectiveCasinoId && (
              <Button size="sm" onClick={() => setSubmitOpen(true)}>
                <Send className="h-4 w-4 mr-1.5" />
                Submit Exclusion
              </Button>
            )}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Network className="h-3.5 w-3.5 text-primary" />
                Operators in Network
              </p>
              <p className="text-3xl font-bold">{stats?.operator_subscribers || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Active subscribers</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Radio className="h-3.5 w-3.5 text-blue-500" />
                Active Broadcasts
              </p>
              <p className="text-3xl font-bold text-blue-600">{stats?.active_broadcasts || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats?.total_broadcasts || 0} total issued</p>
            </CardContent>
          </Card>

          <Card className={stats?.open_breaches ? 'border-red-200 bg-red-50/50' : ''}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Open Breaches
              </p>
              <p className="text-3xl font-bold text-red-600">{stats?.open_breaches || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats?.total_breaches || 0} detected total</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <ShieldOff className="h-3.5 w-3.5 text-orange-500" />
                Total Exclusions
              </p>
              <p className="text-3xl font-bold">{stats?.total_events || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats?.permanent_exclusions || 0} permanent</p>
            </CardContent>
          </Card>
        </div>

        {/* Token Check Bar */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="h-4 w-4 text-primary" />
                Token Protection Check
              </div>
              <div className="flex-1 flex items-center gap-2 min-w-[240px]">
                <Input
                  placeholder="Enter pseudonym token to check..."
                  value={tokenSearch}
                  onChange={e => { setTokenSearch(e.target.value); setTokenCheckResult(null); }}
                  className="font-mono text-xs h-8"
                />
                <Button size="sm" onClick={handleCheckToken} disabled={checkingToken || !tokenSearch.trim()}>
                  {checkingToken ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  Check
                </Button>
              </div>
              {tokenCheckResult && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${tokenCheckResult.status === 'clear' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {tokenCheckResult.status === 'clear'
                    ? <ShieldCheck className="h-3.5 w-3.5" />
                    : <ShieldOff className="h-3.5 w-3.5" />}
                  {tokenCheckResult.message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="overview" className="text-xs">
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              <FileWarning className="h-3.5 w-3.5 mr-1.5" />
              Events ({events.length})
            </TabsTrigger>
            <TabsTrigger value="breaches" className="text-xs">
              <BadgeAlert className="h-3.5 w-3.5 mr-1.5" />
              Breaches ({breaches.length})
            </TabsTrigger>
            <TabsTrigger value="operators" className="text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Operators ({subscribers.length})
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Timeline chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Events & Broadcasts (30 days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={timelineData} margin={{ left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="broadcasts" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Broadcasts" />
                      <Area type="monotone" dataKey="events" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.3} name="Events" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Exclusion type breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Exclusions by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={Object.entries(stats?.events_by_type || {}).map(([k, v]) => ({
                        name: EXCLUSION_TYPE_LABELS[k]?.replace('Self-Exclusion', 'Self-Excl.').replace(' Exclusion', ' Excl.') || k,
                        count: v,
                      }))}
                      margin={{ left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-10} textAnchor="end" height={45} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {Object.keys(stats?.events_by_type || {}).map((_, i) => (
                          <Cell key={i} fill={['#f97316','#3b82f6','#ef4444','#10b981','#eab308'][i % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Recent broadcasts feed */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  Latest Protection Broadcasts
                </CardTitle>
                <CardDescription className="text-xs">
                  Distributed to all subscribed operators in real time — player identities are pseudonymised
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {broadcasts.slice(0, 8).map(b => {
                    const actionCfg = PROTECTION_ACTION_CONFIG[b.protection_action] || PROTECTION_ACTION_CONFIG.mandatory_check;
                    const ActionIcon = actionCfg.icon;
                    const isExpired = !b.is_active || new Date(b.valid_until) < new Date();
                    return (
                      <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isExpired ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <ActionIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium truncate">{b.casino?.name || 'Unknown'}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">{b.operators_notified} operators</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{maskToken(b.pseudonym_token)}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{EXCLUSION_TYPE_LABELS[b.exclusion_type] || b.exclusion_type}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`${actionCfg.badge} border-0 text-xs`}>{actionCfg.label}</Badge>
                          {isExpired
                            ? <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Expired</Badge>
                            : <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 hidden md:block">
                          {new Date(b.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                  {broadcasts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No broadcasts issued yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EVENTS ── */}
          <TabsContent value="events" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="hidden md:table-cell">Operator</TableHead>
                        <TableHead className="hidden md:table-cell">Duration</TableHead>
                        <TableHead className="hidden lg:table-cell">Risk Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">NRGP</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-12">No exclusion events</TableCell>
                        </TableRow>
                      ) : events.map(e => {
                        const statusCfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.pending;
                        return (
                          <TableRow
                            key={e.id}
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => { setSelectedEvent(e); setEventSheetOpen(true); }}
                          >
                            <TableCell>
                              <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Lock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground">{maskToken(e.pseudonym_token)}</span>
                              </div>
                              {e.is_permanent && (
                                <span className="text-xs text-red-600 font-medium">Permanent</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{EXCLUSION_TYPE_LABELS[e.exclusion_type] || e.exclusion_type}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{e.casino?.name || '—'}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{e.duration_months}m</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex items-center gap-1.5">
                                <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${e.risk_score_at_exclusion >= 80 ? 'bg-red-500' : e.risk_score_at_exclusion >= 60 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                                    style={{ width: `${e.risk_score_at_exclusion}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono">{e.risk_score_at_exclusion}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusCfg.badge} border-0 text-xs`}>{statusCfg.label}</Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {e.reported_to_nrgp
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
                            </TableCell>
                            <TableCell className="text-right">
                              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BREACHES ── */}
          <TabsContent value="breaches" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {breaches.filter(b => b.status === 'open').length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">
                      <strong>{breaches.filter(b => b.status === 'open').length} open breach{breaches.filter(b => b.status === 'open').length > 1 ? 'es' : ''}</strong> require immediate response. Accounts must be suspended and NRGP notified within 24 hours.
                    </p>
                  </div>
                )}
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Token</TableHead>
                        <TableHead>Detected At</TableHead>
                        <TableHead className="hidden md:table-cell">Originating</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="hidden md:table-cell">Amount</TableHead>
                        <TableHead className="hidden lg:table-cell">Response</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">NRGP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breaches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-12">No breach detections</TableCell>
                        </TableRow>
                      ) : breaches.map(b => {
                        const statusCfg = BREACH_STATUS_CONFIG[b.status] || BREACH_STATUS_CONFIG.open;
                        return (
                          <TableRow key={b.id} className={`hover:bg-muted/20 transition-colors ${b.status === 'open' ? 'bg-red-50/50' : ''}`}>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Lock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground">{maskToken(b.pseudonym_token)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground/60 mt-0.5">{b.detecting?.name}</div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(b.detected_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {b.originating?.name || '—'}
                            </TableCell>
                            <TableCell className="text-sm capitalize">{b.detection_method.replace(/_/g, ' ')}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm font-medium">
                              {b.amount_deposited_before_detection > 0
                                ? <span className="text-red-600">R{b.amount_deposited_before_detection.toLocaleString()}</span>
                                : '—'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                              {b.response_action ? b.response_action.replace(/_/g, ' ') : <span className="text-red-600 font-medium">No action</span>}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusCfg.badge} border-0 text-xs`}>{statusCfg.label}</Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {b.nrgp_notified
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                : <XCircle className="h-4 w-4 text-red-400" />}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── OPERATORS ── */}
          <TabsContent value="operators" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Network Operator Subscriptions
                </CardTitle>
                <CardDescription className="text-xs">
                  All operators enrolled in the SafeBet IQ Self-Exclusion Monitoring Network
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Operator</TableHead>
                        <TableHead className="hidden md:table-cell">Province</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead className="hidden md:table-cell text-center">Submits</TableHead>
                        <TableHead className="hidden md:table-cell text-center">Receives</TableHead>
                        <TableHead className="hidden lg:table-cell">Events Submitted</TableHead>
                        <TableHead className="hidden lg:table-cell">Broadcasts Received</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscribers.map(s => (
                        <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-medium text-sm">{s.casino?.name || '—'}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{s.casino?.province || '—'}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                              {SUBSCRIPTION_LABELS[s.subscription_type] || s.subscription_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center">
                            {s.submits_events ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center">
                            {s.receives_broadcasts ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-center font-medium">{s.total_events_submitted}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-center">{s.total_broadcasts_received}</TableCell>
                          <TableCell>
                            {s.is_active
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>
                              : <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Inactive</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Privacy notice */}
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Privacy-by-design:</strong> The Self-Exclusion Monitoring Network distributes protection intelligence using pseudonymised tokens only. No personally identifiable information (PII) is transmitted between operators. Player identities are mapped to pseudonym tokens locally within each operator&apos;s secure environment. Self-exclusion records comply with the National Gambling Act and NRGP reporting obligations.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Event Detail Sheet */}
        <Sheet open={eventSheetOpen} onOpenChange={setEventSheetOpen}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            {selectedEvent && (
              <>
                <SheetHeader className="pb-4 border-b">
                  <SheetTitle>Exclusion Event Detail</SheetTitle>
                  <SheetDescription>
                    {EXCLUSION_TYPE_LABELS[selectedEvent.exclusion_type] || selectedEvent.exclusion_type}
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-5 pt-4">
                  <div className="p-3 rounded-lg bg-muted/40 border border-dashed">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Pseudonym Token</span>
                    </div>
                    <p className="font-mono text-xs break-all">{selectedEvent.pseudonym_token}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${(STATUS_CONFIG[selectedEvent.status] || STATUS_CONFIG.pending).badge} border-0`}>
                      {(STATUS_CONFIG[selectedEvent.status] || STATUS_CONFIG.pending).label}
                    </Badge>
                    {selectedEvent.is_permanent && (
                      <Badge className="bg-red-700 text-white border-0">Permanent</Badge>
                    )}
                    {selectedEvent.reported_to_nrgp && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">NRGP Reported</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30 border">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-xl font-bold mt-0.5">{selectedEvent.duration_months}m</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border">
                      <p className="text-xs text-muted-foreground">Risk Score</p>
                      <p className="text-xl font-bold mt-0.5">{selectedEvent.risk_score_at_exclusion}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border">
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-medium mt-0.5">{selectedEvent.exclusion_start_date}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border">
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="text-sm font-medium mt-0.5">{selectedEvent.exclusion_end_date}</p>
                    </div>
                  </div>

                  {selectedEvent.exclusion_reason && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Reason</h4>
                      <p className="text-sm">{selectedEvent.exclusion_reason}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cross-operator history</span>
                      <span>{selectedEvent.cross_operator_history ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Previous exclusions</span>
                      <span>{selectedEvent.previous_exclusions}</span>
                    </div>
                    {selectedEvent.nrgp_reference && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">NRGP Reference</span>
                        <span className="font-mono">{selectedEvent.nrgp_reference}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Submitting operator</span>
                      <span>{selectedEvent.casino?.name || '—'}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Submit Event Dialog */}
        <SubmitEventDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          casinoId={effectiveCasinoId || ''}
          onSuccess={handleRefresh}
        />
      </div>
    </TooltipProvider>
  );
}
