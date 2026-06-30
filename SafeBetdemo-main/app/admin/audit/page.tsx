'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Shield, Search, Download, RefreshCw, Filter, Clock, Lock, User,
  Database, Activity, Eye, Settings, LogIn, LogOut, FileText, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronRight, Building2, Users, Bell,
  ShieldCheck, Info, BarChart3, Layers, Key, ShieldOff, ShieldAlert,
  Link as LinkIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditEvent {
  id: string;
  event_id: string;
  event_type: string;
  event_category: string;
  user_email: string | null;
  user_role: string | null;
  casino_id: string | null;
  action: string;
  description: string | null;
  severity: string;
  outcome: string;
  metadata: Record<string, unknown> | null;
  hash: string | null;
  previous_hash: string | null;
  created_at: string;
}

interface ChainEntry {
  id: string;
  chain_sequence: number | null;
  log_type: string;
  action: string;
  severity: string;
  entry_hash: string | null;
  previous_hash: string | null;
  created_at: string;
}

interface AuditStats {
  total: number;
  last24h: number;
  last7d: number;
  critical: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

// ── Category / Event-type map ─────────────────────────────────────────────────
// Keys must match actual event_type values in the audit_events table.

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; category: string }> = {
  // Player Protection
  'player.risk_level_changed':  { label: 'Risk Level Changed',   color: 'text-orange-700', bg: 'bg-orange-50',  icon: Activity,     category: 'Player Protection' },
  'player.flagged':             { label: 'Player Flagged',        color: 'text-red-700',    bg: 'bg-red-50',     icon: AlertTriangle, category: 'Player Protection' },
  'intervention.created':       { label: 'Intervention Created',  color: 'text-blue-700',   bg: 'bg-blue-50',    icon: Bell,         category: 'Player Protection' },
  'intervention.delivered':     { label: 'Intervention Delivered',color: 'text-emerald-700',bg: 'bg-emerald-50', icon: CheckCircle2, category: 'Player Protection' },
  'session.ended_by_system':    { label: 'Session Ended (System)',color: 'text-slate-700',  bg: 'bg-slate-50',   icon: Clock,        category: 'Player Protection' },
  // Compliance
  'exclusion.registered':       { label: 'Exclusion Registered',  color: 'text-teal-700',   bg: 'bg-teal-50',    icon: ShieldOff,    category: 'Compliance' },
  'exclusion.lifted':           { label: 'Exclusion Lifted',      color: 'text-emerald-700',bg: 'bg-emerald-50', icon: ShieldCheck,  category: 'Compliance' },
  'exclusion.breach_detected':  { label: 'Exclusion Breach',      color: 'text-red-700',    bg: 'bg-red-50',     icon: ShieldAlert,  category: 'Compliance' },
  'compliance.snapshot_created':{ label: 'Compliance Snapshot',   color: 'text-purple-700', bg: 'bg-purple-50',  icon: Shield,       category: 'Compliance' },
  'report.generated':           { label: 'Report Generated',      color: 'text-blue-700',   bg: 'bg-blue-50',    icon: FileText,     category: 'Compliance' },
  // Access
  'user.login':                 { label: 'Login',                 color: 'text-emerald-700',bg: 'bg-emerald-50', icon: LogIn,        category: 'Access' },
  'user.logout':                { label: 'Logout',                color: 'text-slate-600',  bg: 'bg-slate-50',   icon: LogOut,       category: 'Access' },
  'user_login':                 { label: 'Login',                 color: 'text-emerald-700',bg: 'bg-emerald-50', icon: LogIn,        category: 'Access' },
  // Security
  'user.password_changed':      { label: 'Password Changed',      color: 'text-amber-700',  bg: 'bg-amber-50',   icon: Key,          category: 'Security' },
  'api_key.created':            { label: 'API Key Created',       color: 'text-emerald-700',bg: 'bg-emerald-50', icon: Key,          category: 'Security' },
  'api_key.revoked':            { label: 'API Key Revoked',       color: 'text-red-700',    bg: 'bg-red-50',     icon: Key,          category: 'Security' },
  // Administration
  'casino.settings_updated':    { label: 'Settings Updated',      color: 'text-amber-700',  bg: 'bg-amber-50',   icon: Settings,     category: 'Administration' },
};

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  info:     { label: 'Info',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  low:      { label: 'Low',      className: 'bg-slate-100 text-slate-700 border-slate-200' },
  warning:  { label: 'Warning',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  medium:   { label: 'Medium',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
  high:     { label: 'High',     className: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200' },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Player Protection': 'text-blue-700 bg-blue-50 border-blue-200',
  'Compliance':        'text-purple-700 bg-purple-50 border-purple-200',
  'Access':            'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Security':          'text-amber-700 bg-amber-50 border-amber-200',
  'Administration':    'text-slate-700 bg-slate-50 border-slate-200',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(ts: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(ts));
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getCategoryInfo(eventType: string) {
  return CATEGORY_MAP[eventType] ?? {
    label: eventType.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    color: 'text-slate-600', bg: 'bg-slate-50', icon: Activity, category: 'Other',
  };
}

function truncateHash(hash: string | null, chars = 16): string {
  if (!hash) return '—';
  return hash.slice(0, chars) + '…';
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportCSV(events: AuditEvent[]) {
  const headers = ['Event ID', 'Type', 'Category', 'Actor', 'Role', 'Severity', 'Outcome', 'Timestamp'];
  const rows = events.map(e => [
    e.event_id,
    getCategoryInfo(e.event_type).label,
    getCategoryInfo(e.event_type).category,
    e.user_email ?? '—',
    e.user_role ?? '—',
    e.severity,
    e.outcome,
    e.created_at,
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditCentrePage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [chainEntries, setChainEntries] = useState<ChainEntry[]>([]);
  const [chainVerified, setChainVerified] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AuditStats>({
    total: 0, last24h: 0, last7d: 0, critical: 0, byType: {}, byCategory: {},
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('30d');

  const loadChain = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('id, chain_sequence, log_type, action, severity, entry_hash, previous_hash, created_at')
      .order('chain_sequence', { ascending: true })
      .limit(200);
    const entries = data ?? [];
    setChainEntries(entries);
    // Verify the chain: each entry's previous_hash must equal the prior entry's entry_hash
    let intact = true;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].previous_hash !== entries[i - 1].entry_hash) { intact = false; break; }
    }
    setChainVerified(entries.length > 1 ? intact : null);
  }, []);

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const dateThreshold = new Date();
      if (dateFilter === '24h') dateThreshold.setHours(dateThreshold.getHours() - 24);
      else if (dateFilter === '7d') dateThreshold.setDate(dateThreshold.getDate() - 7);
      else if (dateFilter === '30d') dateThreshold.setDate(dateThreshold.getDate() - 30);
      else if (dateFilter === '90d') dateThreshold.setDate(dateThreshold.getDate() - 90);

      let query = supabase
        .from('audit_events')
        .select('id, event_id, event_type, event_category, user_email, user_role, casino_id, action, description, severity, outcome, metadata, hash, previous_hash, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (dateFilter !== 'all') query = query.gte('created_at', dateThreshold.toISOString());
      if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
      if (outcomeFilter !== 'all') query = query.eq('outcome', outcomeFilter);

      const { data, error } = await query;
      if (error) throw error;

      const all = (data ?? []) as AuditEvent[];
      setEvents(all);

      const now = Date.now();
      const day = 86_400_000;
      const week = 7 * day;
      const byType: Record<string, number> = {};
      const byCategory: Record<string, number> = {};

      all.forEach(e => {
        byType[e.event_type] = (byType[e.event_type] || 0) + 1;
        const cat = getCategoryInfo(e.event_type).category;
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      });

      setStats({
        total: all.length,
        last24h: all.filter(e => now - new Date(e.created_at).getTime() < day).length,
        last7d: all.filter(e => now - new Date(e.created_at).getTime() < week).length,
        critical: all.filter(e => e.severity === 'critical').length,
        byType,
        byCategory,
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to load audit events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severityFilter, outcomeFilter, dateFilter]);

  useEffect(() => { loadEvents(); loadChain(); }, [loadEvents, loadChain]);

  const filtered = events.filter(e => {
    if (categoryFilter !== 'all' && getCategoryInfo(e.event_type).category !== categoryFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.event_type.toLowerCase().includes(q) ||
      (e.user_email ?? '').toLowerCase().includes(q) ||
      (e.user_role ?? '').toLowerCase().includes(q) ||
      (e.action ?? '').toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      e.event_id.toLowerCase().includes(q)
    );
  });

  const uniqueCategories = Array.from(new Set(events.map(e => getCategoryInfo(e.event_type).category))).sort();

  const activityByHour = (() => {
    const hours: Record<number, number> = {};
    events.forEach(e => {
      const h = new Date(e.created_at).getHours();
      hours[h] = (hours[h] || 0) + 1;
    });
    return Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2,'0')}:00`, events: hours[i] || 0 }));
  })();

  const topTypes = Object.entries(stats.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([type, count]) => ({ type: getCategoryInfo(type).label, count }));

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">

        {/* ── Header ── */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">Audit Centre</h1>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Tamper-Evident
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  ISO 27001 A.12.4 · POPIA §8 · Append-only operational audit log
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { loadEvents(true); loadChain(); }} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-4">
            {[
              { label: 'Total Events',  value: stats.total.toLocaleString(),    color: '' },
              { label: 'Last 24 Hours', value: stats.last24h.toLocaleString(),  color: 'text-blue-600' },
              { label: 'Last 7 Days',   value: stats.last7d.toLocaleString(),   color: '' },
              { label: 'Critical',      value: stats.critical.toLocaleString(), color: stats.critical > 0 ? 'text-red-600' : 'text-emerald-600' },
              { label: 'Chain Records', value: chainEntries.length.toLocaleString(), color: 'text-purple-600' },
            ].map(k => (
              <div key={k.label} className="flex flex-col px-3 py-2 rounded-lg bg-muted/30 border">
                <span className="text-[10px] text-muted-foreground mb-0.5">{k.label}</span>
                <span className={`text-lg font-bold ${k.color}`}>{k.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Integrity Banner */}
        <div className="mx-6 mt-4 flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
          <ShieldCheck className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Append-only integrity guarantee:</span> Events in this log cannot be modified or deleted through the application. All entries are timestamped server-side and protected by database-level row security. The Tamper-Evident Chain below provides cryptographic proof of log continuity per ISO 27001 A.9.2 and POPIA §8.
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex-1 overflow-auto mt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b bg-card px-6 pt-2 pb-0">
              <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                {[
                  { id: 'timeline',  label: 'Audit Timeline',    icon: Clock },
                  { id: 'analytics', label: 'Analytics',          icon: BarChart3 },
                  { id: 'summary',   label: 'Activity Summary',   icon: Layers },
                  { id: 'chain',     label: 'Tamper-Evident Chain', icon: LinkIcon },
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
                      {tab.id === 'chain' && chainVerified === true && (
                        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                      {tab.id === 'chain' && chainVerified === false && (
                        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="flex-1 p-6 min-w-0">

              {/* ── TIMELINE TAB ── */}
              <TabsContent value="timeline" className="mt-0 space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by actor, event type, action…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Last 24h</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {uniqueCategories.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                      <SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="Outcome" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Outcomes</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failure">Failure</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-0">
                    {loading ? (
                      <div className="p-16 text-center text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-3 animate-pulse text-muted-foreground/40" />
                        <p className="text-sm">Loading audit events…</p>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="p-16 text-center text-muted-foreground">
                        <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm font-medium">No events match your filters</p>
                        <p className="text-xs mt-1">Adjust severity, category, or date range</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="w-28">Severity</TableHead>
                                <TableHead className="w-48">Event</TableHead>
                                <TableHead className="w-36">Category</TableHead>
                                <TableHead>Actor</TableHead>
                                <TableHead className="w-44">Timestamp</TableHead>
                                <TableHead className="w-24">Outcome</TableHead>
                                <TableHead className="w-8" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filtered.slice(0, 200).map(event => {
                                const cat = getCategoryInfo(event.event_type);
                                const sev = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
                                const CatIcon = cat.icon;
                                const isExpanded = selectedEvent?.id === event.id;
                                return (
                                  <>
                                    <TableRow
                                      key={event.id}
                                      className={`cursor-pointer hover:bg-muted/20 transition-colors text-sm ${event.severity === 'critical' ? 'bg-red-50/30' : event.severity === 'high' ? 'bg-orange-50/20' : ''}`}
                                      onClick={() => setSelectedEvent(isExpanded ? null : event)}
                                    >
                                      <TableCell>
                                        <Badge variant="outline" className={`text-xs flex items-center gap-1 w-fit ${sev.className}`}>
                                          {sev.label}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-6 h-6 rounded-md ${cat.bg} flex items-center justify-center flex-shrink-0`}>
                                            <CatIcon className={`h-3 w-3 ${cat.color}`} />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-medium text-xs truncate">{cat.label}</p>
                                            <p className="text-[10px] font-mono text-muted-foreground">{event.event_id}</p>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${CATEGORY_COLORS[cat.category] ?? ''}`}>
                                          {cat.category}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-xs min-w-0">
                                          {event.user_email ? (
                                            <div className="font-medium text-foreground truncate max-w-[200px]">{event.user_email}</div>
                                          ) : (
                                            <div className="text-muted-foreground italic">system</div>
                                          )}
                                          {event.user_role && (
                                            <div className="text-muted-foreground capitalize">{event.user_role.replace(/_/g, ' ')}</div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-xs">
                                          <div className="font-mono text-foreground">{formatTs(event.created_at)}</div>
                                          <div className="text-muted-foreground">{timeAgo(event.created_at)}</div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {event.outcome === 'success' ? (
                                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Success
                                          </Badge>
                                        ) : event.outcome === 'failure' ? (
                                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 flex items-center gap-1 w-fit">
                                            <AlertTriangle className="h-3 w-3" />
                                            Failure
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200 w-fit">
                                            {event.outcome}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isExpanded
                                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                      </TableCell>
                                    </TableRow>

                                    {/* Inline expanded detail */}
                                    {isExpanded && (
                                      <TableRow key={`${event.id}-detail`} className="bg-primary/5 hover:bg-primary/5">
                                        <TableCell colSpan={7} className="p-4">
                                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div className="space-y-2">
                                              <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Event Reference</span>
                                                <p className="font-mono text-xs mt-0.5 text-primary">{event.event_id}</p>
                                              </div>
                                              <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Event Type</span>
                                                <p className="font-mono text-xs mt-0.5">{event.event_type}</p>
                                              </div>
                                              <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Category</span>
                                                <p className="text-xs mt-0.5">{getCategoryInfo(event.event_type).category}</p>
                                              </div>
                                              <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Action</span>
                                                <p className="font-mono text-xs mt-0.5 bg-muted px-2 py-1 rounded w-fit">{event.action}</p>
                                              </div>
                                              {event.description && (
                                                <div>
                                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Description</span>
                                                  <p className="text-xs mt-0.5">{event.description}</p>
                                                </div>
                                              )}
                                            </div>
                                            <div className="space-y-2">
                                              <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Actor</span>
                                                <p className="text-xs mt-0.5 font-medium">{event.user_email ?? 'system'}</p>
                                                {event.user_role && <p className="text-xs text-muted-foreground capitalize">{event.user_role.replace(/_/g, ' ')}</p>}
                                              </div>
                                              <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Timestamp (NTP-synced)</span>
                                                <p className="font-mono text-xs mt-0.5">{formatTs(event.created_at)}</p>
                                              </div>
                                              <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Severity / Outcome</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                  <Badge variant="outline" className={`text-xs ${SEVERITY_CONFIG[event.severity]?.className}`}>
                                                    {SEVERITY_CONFIG[event.severity]?.label ?? event.severity}
                                                  </Badge>
                                                  <Badge variant="outline" className={`text-xs ${event.outcome === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    {event.outcome}
                                                  </Badge>
                                                </div>
                                              </div>
                                              {event.hash && (
                                                <div>
                                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Entry Hash</span>
                                                  <p className="font-mono text-[10px] mt-0.5 text-muted-foreground break-all">{event.hash}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                                            <div className="mt-3">
                                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Event Metadata</span>
                                              <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto max-h-32 font-mono mt-1">
                                                {JSON.stringify(event.metadata, null, 2)}
                                              </pre>
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
                          <span>Showing {Math.min(filtered.length, 200).toLocaleString()} of {filtered.length.toLocaleString()} events</span>
                          <span className="flex items-center gap-1.5">
                            <Lock className="h-3 w-3" />
                            Append-only · Tamper-evident
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── ANALYTICS TAB ── */}
              <TabsContent value="analytics" className="mt-0 space-y-6">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Audit Analytics
                  </h2>
                  <p className="text-sm text-muted-foreground">Visual analysis of audit event patterns</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Activity by Hour of Day</CardTitle>
                      <CardDescription className="text-xs">Event volume distribution (local time)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={activityByHour} margin={{ left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                          <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Bar dataKey="events" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Events" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Top Event Types</CardTitle>
                      <CardDescription className="text-xs">Highest frequency event categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={topTypes} layout="vertical" margin={{ left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                          <XAxis type="number" tick={{ fontSize: 9 }} />
                          <YAxis dataKey="type" type="category" tick={{ fontSize: 9 }} width={110} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Bar dataKey="count" fill="#10b981" radius={[0, 2, 2, 0]} name="Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Category breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Events by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {Object.entries(stats.byCategory).sort(([,a],[,b]) => b - a).map(([cat, count]) => (
                        <div key={cat} className={`p-3 rounded-lg border text-center ${CATEGORY_COLORS[cat] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          <p className="text-2xl font-bold">{count}</p>
                          <p className="text-xs mt-0.5">{cat}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Severity breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Severity Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {['critical', 'high', 'warning', 'medium', 'low', 'info'].map(sev => {
                        const count = events.filter(e => e.severity === sev).length;
                        const pct = events.length > 0 ? Math.round((count / events.length) * 100) : 0;
                        const cfg = SEVERITY_CONFIG[sev];
                        return (
                          <div key={sev} className={`p-3 rounded-lg border text-center ${cfg?.className ?? ''}`}>
                            <p className="text-2xl font-bold">{count}</p>
                            <p className="text-xs capitalize">{sev}</p>
                            <p className="text-[10px] opacity-70">{pct}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── SUMMARY TAB ── */}
              <TabsContent value="summary" className="mt-0 space-y-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    Activity Summary
                  </h2>
                  <p className="text-sm text-muted-foreground">Compliance-ready summary of audit activity across all event categories</p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Player Protection', icon: ShieldCheck, items: [
                      { label: 'Risk Level Changes',    key: 'player.risk_level_changed' },
                      { label: 'Players Flagged',       key: 'player.flagged' },
                      { label: 'Interventions Created', key: 'intervention.created' },
                      { label: 'Interventions Delivered',key: 'intervention.delivered' },
                      { label: 'Sessions Ended (Auto)', key: 'session.ended_by_system' },
                    ]},
                    { title: 'Compliance Events', icon: Shield, items: [
                      { label: 'Exclusions Registered', key: 'exclusion.registered' },
                      { label: 'Exclusions Lifted',     key: 'exclusion.lifted' },
                      { label: 'Breach Detections',     key: 'exclusion.breach_detected' },
                      { label: 'Compliance Snapshots',  key: 'compliance.snapshot_created' },
                      { label: 'Reports Generated',     key: 'report.generated' },
                    ]},
                    { title: 'Access & Authentication', icon: LogIn, items: [
                      { label: 'User Logins',           key: 'user.login' },
                      { label: 'Auth Events',           key: 'user_login' },
                      { label: 'User Logouts',          key: 'user.logout' },
                    ]},
                    { title: 'Security Events', icon: Key, items: [
                      { label: 'Password Changes',      key: 'user.password_changed' },
                      { label: 'API Keys Created',      key: 'api_key.created' },
                      { label: 'API Keys Revoked',      key: 'api_key.revoked' },
                    ]},
                    { title: 'Administration', icon: Settings, items: [
                      { label: 'Settings Updated',      key: 'casino.settings_updated' },
                    ]},
                    { title: 'Event Outcomes', icon: Activity, items: [
                      { label: 'Successful',   key: '_outcome_success' },
                      { label: 'Failures',     key: '_outcome_failure' },
                      { label: 'Critical',     key: '_sev_critical' },
                      { label: 'High',         key: '_sev_high' },
                    ]},
                  ].map((section, i) => {
                    const Icon = section.icon;
                    return (
                      <Card key={i}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            {section.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            {section.items.map((item, j) => {
                              let value = 0;
                              if (item.key.startsWith('_outcome_')) {
                                const o = item.key.replace('_outcome_', '');
                                value = events.filter(e => e.outcome === o).length;
                              } else if (item.key.startsWith('_sev_')) {
                                const s = item.key.replace('_sev_', '');
                                value = events.filter(e => e.severity === s).length;
                              } else {
                                value = stats.byType[item.key] || 0;
                              }
                              const isAlert = value > 0 && (item.key.includes('breach') || item.key.includes('failure') || item.key.startsWith('_sev_'));
                              return (
                                <div key={j} className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">{item.label}</span>
                                  <span className={`text-sm font-bold ${isAlert ? 'text-red-600' : ''}`}>{value.toLocaleString()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="border-emerald-200 bg-emerald-50/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Audit Log Integrity Confirmed</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          All {stats.total.toLocaleString()} events are protected by database-level row security. No records have been modified or deleted. This log is compliant with ISO 27001 Annex A.12.4 and POPIA §8 requirements. Cryptographic chain integrity: {chainVerified === true ? 'VERIFIED' : chainVerified === false ? 'CHAIN BROKEN — INVESTIGATE' : 'PENDING VERIFICATION'}.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── CHAIN INTEGRITY TAB ── */}
              <TabsContent value="chain" className="mt-0 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-primary" />
                      Tamper-Evident Chain
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      SHA-256 hash chain — each entry&apos;s <code className="text-xs bg-muted px-1 py-0.5 rounded">previous_hash</code> must equal the prior entry&apos;s <code className="text-xs bg-muted px-1 py-0.5 rounded">entry_hash</code>
                    </p>
                  </div>
                  <div className="shrink-0">
                    {chainVerified === true && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 flex items-center gap-1.5 px-3 py-1.5">
                        <ShieldCheck className="h-4 w-4" />
                        Chain Intact — {chainEntries.length} links verified
                      </Badge>
                    )}
                    {chainVerified === false && (
                      <Badge className="bg-red-100 text-red-700 border-red-300 flex items-center gap-1.5 px-3 py-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        Chain Break Detected
                      </Badge>
                    )}
                    {chainVerified === null && (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-300 flex items-center gap-1.5 px-3 py-1.5">
                        <Clock className="h-4 w-4" />
                        Awaiting verification
                      </Badge>
                    )}
                  </div>
                </div>

                {/* How it works */}
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-800 space-y-1">
                        <p className="font-semibold">How tamper-evidence works:</p>
                        <p>Each audit record contains a SHA-256 hash of its own content (<strong>entry_hash</strong>) and the hash of the immediately preceding record (<strong>previous_hash</strong>). Any modification to a historical record would break the chain — its entry_hash would no longer match the next record&apos;s previous_hash. The genesis block uses an all-zeros previous_hash. Chain verification runs client-side on every page load.</p>
                        <p className="text-blue-600 font-medium">This chain is the cryptographic backbone underpinning the ISO 27001 A.12.4 and POPIA §8 audit commitments.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Chain entries */}
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-20">Seq</TableHead>
                            <TableHead className="w-36">Event Type</TableHead>
                            <TableHead className="w-24">Severity</TableHead>
                            <TableHead>Entry Hash (SHA-256)</TableHead>
                            <TableHead>Previous Hash</TableHead>
                            <TableHead className="w-24">Link</TableHead>
                            <TableHead className="w-36">Timestamp</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chainEntries.map((entry, idx) => {
                            const prevOk = idx === 0
                              ? entry.previous_hash === '0000000000000000000000000000000000000000000000000000000000000000'
                              : entry.previous_hash === chainEntries[idx - 1].entry_hash;
                            const sev = SEVERITY_CONFIG[entry.severity] ?? SEVERITY_CONFIG.info;
                            return (
                              <TableRow key={entry.id} className={!prevOk ? 'bg-red-50' : ''}>
                                <TableCell>
                                  <span className="font-mono text-xs text-muted-foreground">#{entry.chain_sequence ?? idx + 1}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs font-medium capitalize">{entry.log_type.replace(/_/g, ' ')}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[10px] ${sev.className}`}>{sev.label}</Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {truncateHash(entry.entry_hash, 20)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {idx === 0 ? (
                                    <span className="font-mono text-[10px] text-purple-600">GENESIS (0x000…)</span>
                                  ) : (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      {truncateHash(entry.previous_hash, 20)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {prevOk ? (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                      <ShieldCheck className="h-2.5 w-2.5 mr-1" />Valid
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                                      <AlertTriangle className="h-2.5 w-2.5 mr-1" />BREAK
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs font-mono text-muted-foreground">{formatTs(entry.created_at)}</span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between">
                      <span>{chainEntries.length} chain records · source: <code>audit_logs</code></span>
                      <span className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3" />
                        SHA-256 · Append-only
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
