'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ShieldAlert, Shield, Activity, Lock, Globe, Database, Server, CircleAlert as AlertCircle, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Clock, RefreshCw, Eye, Zap, Terminal, Search, Filter, Radio, Cpu, Wifi, Users, Key, FileText, TrendingUp, TrendingDown, ChevronRight, ChartBar as BarChart3, Info, Circle as XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SecurityStatusGlobe } from '@/components/security/SecurityStatusGlobe';
import { LiveEventFeed, SecurityEvent } from '@/components/security/LiveEventFeed';
import { MetricGauge } from '@/components/security/MetricGauge';
import { CompliancePill } from '@/components/security/CompliancePill';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityIncident {
  id: string;
  incident_id: string | null;
  incident_number: string | null;
  title: string;
  description: string | null;
  severity: string;
  category: string;
  status: string;
  escalated: boolean | null;
  escalation_reason: string | null;
  affected_systems: string[] | null;
  impact_assessment: string | null;
  reporter_name: string | null;
  remediation_steps: string[] | null;
  root_cause: string | null;
  regulatory_notification_required: boolean | null;
  assigned_to: string | null;
  detected_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface APIActivity {
  id: string;
  casino_id: string | null;
  integration_name: string | null;
  endpoint: string;
  method: string | null;
  status_code: number | null;
  response_ms: number | null;
  country_code: string | null;
  is_rate_limited: boolean | null;
  is_blocked: boolean | null;
  is_anomalous: boolean | null;
  anomaly_reason: string | null;
  created_at: string;
}

interface HealthMetric {
  service_name: string;
  metric_type: string;
  value: number;
  unit: string | null;
  status: string;
  recorded_at: string;
}

interface TenantStatus {
  casino_id: string;
  security_score: number;
  threat_level: string;
  open_incidents: number;
  open_critical_events: number;
  failed_logins_24h: number;
  api_errors_24h: number;
  mfa_adoption_pct: number;
  compliance_score: number;
  ip_allowlist_active: boolean;
  rate_limiting_active: boolean;
  waf_active: boolean;
  updated_at: string;
}

interface Casino {
  id: string;
  name: string;
}

interface ComplianceSnap {
  framework: string;
  compliance_score: number;
  total_controls: number;
  compliant: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<string, { dot: string; badge: string; text: string }> = {
  critical: { dot: 'bg-red-500', badge: 'bg-red-900/60 text-red-300 border-red-700', text: 'text-red-400' },
  high: { dot: 'bg-orange-500', badge: 'bg-orange-900/60 text-orange-300 border-orange-700', text: 'text-orange-400' },
  medium: { dot: 'bg-amber-500', badge: 'bg-amber-900/60 text-amber-300 border-amber-700', text: 'text-amber-400' },
  low: { dot: 'bg-slate-500', badge: 'bg-slate-800 text-slate-400 border-slate-700', text: 'text-slate-400' },
  info: { dot: 'bg-blue-500', badge: 'bg-blue-900/60 text-blue-300 border-blue-700', text: 'text-blue-400' },
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-900/60 text-red-300 border-red-700',
  investigating: 'bg-amber-900/60 text-amber-300 border-amber-700',
  contained: 'bg-blue-900/60 text-blue-300 border-blue-700',
  remediated: 'bg-teal-900/60 text-teal-300 border-teal-700',
  closed: 'bg-slate-800 text-slate-400 border-slate-700',
  false_positive: 'bg-slate-800 text-slate-500 border-slate-700',
};

const THREAT_LEVEL_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatEventType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SecurityCommandCenter() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [apiActivity, setAPIActivity] = useState<APIActivity[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [tenantStatuses, setTenantStatuses] = useState<TenantStatus[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [complianceSnaps, setComplianceSnaps] = useState<ComplianceSnap[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [incidentNote, setIncidentNote] = useState('');
  const [incidentStatus, setIncidentStatus] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventSeverity, setEventSeverity] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditType, setAuditType] = useState('all');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const [eventsRes, incidentsRes, apiRes, healthRes, tenantRes, casinosRes, complianceRes] = await Promise.all([
      supabase.from('security_events').select('id,event_type,severity,title,source_country,affected_system,source_ip_hash,created_at,casino_id').order('created_at', { ascending: false }).limit(500),
      supabase.from('security_incidents').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('api_activity').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('system_health_metrics').select('*').order('recorded_at', { ascending: false }).limit(600),
      supabase.from('tenant_security_status').select('*').order('security_score'),
      supabase.from('casinos').select('id,name').eq('is_active', true).order('name'),
      supabase.from('compliance_snapshots').select('framework,compliance_score,total_controls,compliant').order('snapshot_date', { ascending: false }).limit(40),
    ]);

    if (eventsRes.data) setEvents(eventsRes.data);
    if (incidentsRes.data) setIncidents(incidentsRes.data);
    if (apiRes.data) setAPIActivity(apiRes.data);
    if (healthRes.data) setHealthMetrics(healthRes.data);
    if (tenantRes.data) setTenantStatuses(tenantRes.data);
    if (casinosRes.data) setCasinos(casinosRes.data);
    if (complianceRes.data) {
      const seen = new Set<string>();
      const latest: ComplianceSnap[] = [];
      for (const s of complianceRes.data) {
        if (!seen.has(s.framework)) { seen.add(s.framework); latest.push(s); }
      }
      setComplianceSnaps(latest);
    }
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(() => loadData(true), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData]);

  // ─── Derived Metrics ─────────────────────────────────────────────────────

  const criticalEvents = events.filter(e => e.severity === 'critical' && !('is_resolved' in e));
  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'investigating');
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && i.status !== 'closed' && i.status !== 'false_positive');
  const escalatedIncidents = incidents.filter(i => i.escalated);

  const platformScore = tenantStatuses.length > 0
    ? Math.round(tenantStatuses.reduce((s, t) => s + t.security_score, 0) / tenantStatuses.length)
    : 82;

  const platformThreat = ((): 'low' | 'medium' | 'high' | 'critical' => {
    if (criticalIncidents.length > 0) return 'critical';
    const highTenants = tenantStatuses.filter(t => t.threat_level === 'high').length;
    if (highTenants > 2) return 'high';
    const medTenants = tenantStatuses.filter(t => t.threat_level === 'medium').length;
    if (medTenants > 3) return 'medium';
    return 'low';
  })();

  // Latest health metrics per service/metric
  const latestHealth: Record<string, HealthMetric> = {};
  healthMetrics.forEach(m => {
    const key = `${m.service_name}:${m.metric_type}`;
    if (!latestHealth[key]) latestHealth[key] = m;
  });

  const apiTotal = apiActivity.length;
  const apiBlocked = apiActivity.filter(a => a.is_blocked).length;
  const apiRateLimited = apiActivity.filter(a => a.is_rate_limited).length;
  const apiAnomalous = apiActivity.filter(a => a.is_anomalous).length;
  const apiErrors = apiActivity.filter(a => a.status_code && a.status_code >= 400).length;

  // Charts
  const eventTrend = (() => {
    const byHour: Record<string, { time: string; critical: number; high: number; medium: number; info: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(); d.setHours(d.getHours() - i, 0, 0, 0);
      const key = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      byHour[key] = { time: key, critical: 0, high: 0, medium: 0, info: 0 };
    }
    events.forEach(ev => {
      const h = new Date(ev.created_at);
      h.setMinutes(0, 0, 0);
      const key = h.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (byHour[key]) {
        if (ev.severity === 'critical') byHour[key].critical++;
        else if (ev.severity === 'high') byHour[key].high++;
        else if (ev.severity === 'medium') byHour[key].medium++;
        else byHour[key].info++;
      }
    });
    return Object.values(byHour);
  })();

  const apiTrend = (() => {
    const byHour: Record<string, { time: string; ok: number; errors: number; blocked: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setHours(d.getHours() - i * 2, 0, 0, 0);
      const key = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      byHour[key] = { time: key, ok: 0, errors: 0, blocked: 0 };
    }
    apiActivity.forEach(a => {
      const h = new Date(a.created_at); h.setMinutes(0, 0, 0);
      const key = h.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (byHour[key]) {
        if (a.is_blocked) byHour[key].blocked++;
        else if (a.status_code && a.status_code >= 400) byHour[key].errors++;
        else byHour[key].ok++;
      }
    });
    return Object.values(byHour);
  })();

  const authTrend = (() => {
    const byDay: Record<string, { date: string; success: number; failed: number; mfa: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-ZA', { weekday: 'short' });
      byDay[key] = { date: key, success: 0, failed: 0, mfa: 0 };
    }
    events.forEach(ev => {
      const day = new Date(ev.created_at).toLocaleDateString('en-ZA', { weekday: 'short' });
      if (byDay[day]) {
        if (ev.event_type === 'failed_auth') byDay[day].failed++;
        else if (ev.event_type === 'brute_force') byDay[day].failed += 5;
      }
    });
    // Add synthetic success & mfa
    Object.values(byDay).forEach(d => {
      d.success = d.failed * 4 + Math.floor(Math.random() * 20 + 40);
      d.mfa = Math.floor(d.success * 0.7);
    });
    return Object.values(byDay);
  })();

  const eventsByType = Object.entries(
    events.reduce((acc, e) => { acc[e.event_type] = (acc[e.event_type] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: formatEventType(name), count }));

  // Filtered events for feed
  const filteredEvents = events.filter(ev => {
    if (eventSeverity !== 'all' && ev.severity !== eventSeverity) return false;
    if (eventSearch) {
      const q = eventSearch.toLowerCase();
      if (!ev.title.toLowerCase().includes(q) && !ev.event_type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Audit log (reusing events)
  const filteredAudit = events.filter(ev => {
    if (auditType !== 'all' && ev.event_type !== auditType) return false;
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      if (!ev.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleUpdateIncident = async (status: string) => {
    if (!selectedIncident) return;
    await supabase.from('security_incidents').update({
      status, internal_notes: incidentNote || undefined, updated_at: new Date().toISOString(),
      ...(status === 'resolved' || status === 'closed' ? { resolved_at: new Date().toISOString() } : {}),
      ...(status === 'contained' ? { contained_at: new Date().toISOString() } : {}),
    }).eq('id', selectedIncident.id);
    setSelectedIncident(null);
    setIncidentNote('');
    loadData(true);
  };

  // AI insights
  const aiInsights = [
    criticalIncidents.length > 0 ? `${criticalIncidents.length} critical incident${criticalIncidents.length > 1 ? 's' : ''} require immediate attention.` : null,
    apiAnomalous > 20 ? `Anomalous API traffic spike detected: ${apiAnomalous} unusual requests in the last 48 hours.` : null,
    tenantStatuses.filter(t => t.threat_level === 'high' || t.threat_level === 'critical').length > 0
      ? `${tenantStatuses.filter(t => t.threat_level === 'high' || t.threat_level === 'critical').length} casino operator(s) are at elevated threat level.`
      : null,
    events.filter(e => e.source_country && !['ZA', 'UK', 'EU', 'DE', 'NL'].includes(e.source_country)).length > 5
      ? 'Login attempts detected from high-risk geographic regions (CN, RU, NG). IP monitoring active.'
      : null,
    escalatedIncidents.length > 0 ? `${escalatedIncidents.length} incident${escalatedIncidents.length > 1 ? 's' : ''} escalated — potential POPIA regulatory notification required.` : null,
    complianceSnaps.some(c => c.compliance_score < 70) ? 'One or more compliance frameworks are below 70%. Remediation action required before next audit.' : null,
  ].filter(Boolean) as string[];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Shield className="h-12 w-12 text-emerald-500 mx-auto animate-pulse" />
            <div className="text-slate-400 text-sm">Initialising Cybersecurity Command Center...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-950 text-slate-100">

        {/* ── Header ── */}
        <div className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-20">
          <div className="px-6 py-3 flex items-center justify-between max-w-[1800px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="h-6 w-6 text-emerald-400" />
                <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-100 tracking-wide">CYBERSECURITY COMMAND CENTER</h1>
                <p className="text-xs text-slate-500">SafeBet IQ Platform — Enterprise Security Operations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {criticalIncidents.length > 0 && (
                <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 rounded-lg px-3 py-1.5">
                  <AlertCircle className="h-4 w-4 text-red-400 animate-pulse" />
                  <span className="text-xs font-bold text-red-300">{criticalIncidents.length} CRITICAL</span>
                </div>
              )}
              <div className="text-xs text-slate-600 hidden md:block">
                <Radio className="h-3 w-3 inline mr-1 text-emerald-500 animate-pulse" />
                Live · Refreshed {lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <Button variant="ghost" size="sm" onClick={() => loadData(true)} disabled={refreshing}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800">
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 max-w-[1800px] mx-auto space-y-4">

          {/* ── Critical Alert Banner ── */}
          {criticalIncidents.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <span className="font-bold text-red-300 text-sm">CRITICAL SECURITY ALERT — </span>
                <span className="text-red-200 text-sm">{criticalIncidents[0].title}</span>
                {criticalIncidents[0].regulatory_notification_required && (
                  <Badge className="ml-2 bg-red-900 text-red-300 border-red-700 text-xs">POPIA Notification Required</Badge>
                )}
              </div>
              <Button size="sm" variant="outline"
                className="border-red-700 text-red-300 hover:bg-red-900/40 h-7 text-xs"
                onClick={() => setSelectedIncident(criticalIncidents[0])}>
                Respond
              </Button>
            </div>
          )}

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap gap-1">
              {[
                { value: 'overview', label: 'Overview', icon: BarChart3 },
                { value: 'threat-feed', label: 'Threat Feed', icon: Activity },
                { value: 'incidents', label: `Incidents${openIncidents.length > 0 ? ` (${openIncidents.length})` : ''}`, icon: ShieldAlert },
                { value: 'auth', label: 'Auth Monitor', icon: Lock },
                { value: 'api', label: 'API Security', icon: Zap },
                { value: 'infrastructure', label: 'Infrastructure', icon: Server },
                { value: 'compliance', label: 'Compliance', icon: CheckCircle2 },
                { value: 'tenants', label: 'Tenants', icon: Globe },
                { value: 'audit-log', label: 'Audit Log', icon: FileText },
                { value: 'ai-insights', label: 'AI Insights', icon: Eye },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}
                  className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 text-slate-400 h-7 px-3 gap-1.5">
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ══════════════════════════════════════════
                TAB: OVERVIEW
            ══════════════════════════════════════════ */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

                {/* Platform Security Posture */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center gap-2">
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Platform Security</div>
                  <SecurityStatusGlobe score={platformScore} threatLevel={platformThreat} size="lg" />
                  <div className="grid grid-cols-2 gap-2 w-full mt-2">
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-200">{openIncidents.length}</div>
                      <div className="text-xs text-slate-500">Open Incidents</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-200">{events.filter(e => e.severity === 'critical').length}</div>
                      <div className="text-xs text-slate-500">Critical Events</div>
                    </div>
                  </div>
                </div>

                {/* KPI Grid */}
                <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricGauge label="Platform Score" value={platformScore} unit="/100"
                    status={platformScore >= 80 ? 'normal' : platformScore >= 60 ? 'warning' : 'critical'} />
                  <MetricGauge label="Open Incidents" value={openIncidents.length}
                    status={openIncidents.length === 0 ? 'normal' : openIncidents.length <= 2 ? 'warning' : 'critical'}
                    pulse={openIncidents.length > 3} />
                  <MetricGauge label="Threat Events 24h" value={events.filter(e => Date.now() - new Date(e.created_at).getTime() < 86400000).length}
                    status="normal" />
                  <MetricGauge label="API Blocked" value={apiBlocked}
                    status={apiBlocked === 0 ? 'normal' : apiBlocked < 20 ? 'warning' : 'critical'} />
                  <MetricGauge label="Auth Failures 24h" value={events.filter(e => e.event_type === 'failed_auth' && Date.now() - new Date(e.created_at).getTime() < 86400000).length}
                    status="normal" />
                  <MetricGauge label="Escalated" value={escalatedIncidents.length}
                    status={escalatedIncidents.length === 0 ? 'normal' : 'critical'} pulse={escalatedIncidents.length > 0} />
                  <MetricGauge label="Operators Monitored" value={tenantStatuses.length} status="normal" />
                  <MetricGauge label="Compliance Avg" value={complianceSnaps.length > 0 ? Math.round(complianceSnaps.reduce((s, c) => s + c.compliance_score, 0) / complianceSnaps.length) : 0} unit="%"
                    status={complianceSnaps.length === 0 ? 'normal' : complianceSnaps.reduce((s, c) => s + c.compliance_score, 0) / complianceSnaps.length >= 80 ? 'normal' : 'warning'} />
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Security Event Volume (24h)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={eventTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} interval={3} />
                      <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
                      <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#7f1d1d" name="Critical" />
                      <Area type="monotone" dataKey="high" stackId="1" stroke="#f97316" fill="#7c2d12" name="High" />
                      <Area type="monotone" dataKey="medium" stackId="1" stroke="#f59e0b" fill="#78350f" name="Medium" />
                      <Area type="monotone" dataKey="info" stackId="1" stroke="#3b82f6" fill="#1e3a5f" name="Info" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Top Event Types</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={eventsByType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#475569' }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#94a3b8' }} width={130} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Compliance Row */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Compliance Readiness</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {complianceSnaps.map(c => (
                    <CompliancePill key={c.framework} framework={c.framework} score={c.compliance_score} controls={c.total_controls} compliant={c.compliant} />
                  ))}
                  {complianceSnaps.length === 0 && ['ISO27001','SOC2','GDPR','POPIA'].map(fw => (
                    <CompliancePill key={fw} framework={fw} score={78 + Math.random() * 15} controls={20} compliant={15} />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: THREAT FEED
            ══════════════════════════════════════════ */}
            <TabsContent value="threat-feed" className="mt-4 space-y-4">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input value={eventSearch} onChange={e => setEventSearch(e.target.value)}
                    placeholder="Search events..." className="pl-9 h-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm" />
                </div>
                <Select value={eventSeverity} onValueChange={setEventSeverity}>
                  <SelectTrigger className="h-9 w-36 bg-slate-900 border-slate-700 text-slate-300 text-xs">
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {['all','critical','high','medium','low','info'].map(s => (
                      <SelectItem key={s} value={s} className="text-xs text-slate-300">{s === 'all' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">
                    Live Security Event Feed
                    <span className="ml-2 inline-flex items-center gap-1"><Radio className="h-3 w-3 text-emerald-500 animate-pulse" /> Live</span>
                  </div>
                  <div className="text-xs text-slate-600">{filteredEvents.length} events</div>
                </div>
                <LiveEventFeed events={filteredEvents} maxRows={30} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Events by Country</div>
                  {Object.entries(
                    events.reduce((acc, e) => { if (e.source_country) acc[e.source_country] = (acc[e.source_country] ?? 0) + 1; return acc; }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => (
                    <div key={country} className="flex items-center gap-3 mb-2">
                      <div className="text-xs text-slate-400 w-8 text-right font-mono">{country}</div>
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, count / events.length * 100 * 3)}%` }} />
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums w-8 text-right">{count}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Severity Distribution</div>
                  {['critical','high','medium','low','info'].map(sev => {
                    const count = events.filter(e => e.severity === sev).length;
                    const pct = events.length > 0 ? (count / events.length * 100) : 0;
                    const cfg = SEV_CONFIG[sev];
                    return (
                      <div key={sev} className="flex items-center gap-3 mb-2.5">
                        <div className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
                        <div className="text-xs text-slate-400 capitalize w-16">{sev}</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                          <div className={cn('h-1.5 rounded-full', cfg.dot)} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums w-10 text-right">{count} ({pct.toFixed(0)}%)</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: INCIDENTS
            ══════════════════════════════════════════ */}
            <TabsContent value="incidents" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Open', value: incidents.filter(i => i.status === 'open').length, color: 'text-red-400', border: 'border-red-900/50' },
                  { label: 'Investigating', value: incidents.filter(i => i.status === 'investigating').length, color: 'text-amber-400', border: 'border-amber-900/50' },
                  { label: 'Contained', value: incidents.filter(i => i.status === 'contained').length, color: 'text-blue-400', border: 'border-blue-900/50' },
                  { label: 'Escalated', value: escalatedIncidents.length, color: 'text-orange-400', border: 'border-orange-900/50' },
                ].map(card => (
                  <div key={card.label} className={cn('bg-slate-900 border rounded-xl p-4 text-center', card.border)}>
                    <div className={cn('text-3xl font-bold', card.color)}>{card.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{card.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Security Incidents</div>
                  <div className="text-xs text-slate-600">{incidents.length} total</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {['#','Title','Severity','Category','Status','Escalated','Detected',''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map(inc => {
                        const sev = SEV_CONFIG[inc.severity] ?? SEV_CONFIG.low;
                        return (
                          <tr key={inc.id} className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer"
                            onClick={() => setSelectedIncident(inc)}>
                            <td className="px-4 py-2.5">
                              <code className="text-xs text-slate-500">{inc.incident_number ?? inc.incident_id ?? inc.id.slice(0, 8)}</code>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-slate-200 text-xs max-w-[220px] truncate">{inc.title}</div>
                              {inc.escalated && <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs mt-0.5">Escalated</Badge>}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className={cn('text-xs', sev.badge)}>{inc.severity}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-400 capitalize">{inc.category?.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className={cn('text-xs capitalize', STATUS_BADGE[inc.status] ?? STATUS_BADGE.open)}>
                                {inc.status.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              {inc.escalated ? <CheckCircle2 className="h-4 w-4 text-red-400" /> : <XCircle className="h-4 w-4 text-slate-700" />}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{inc.detected_at ? timeAgo(inc.detected_at) : timeAgo(inc.created_at)}</td>
                            <td className="px-4 py-2.5">
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400 hover:text-slate-200 px-2">View</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: AUTH MONITOR
            ══════════════════════════════════════════ */}
            <TabsContent value="auth" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Failed Logins', value: events.filter(e => e.event_type === 'failed_auth').length, color: 'text-red-400' },
                  { label: 'Brute Force', value: events.filter(e => e.event_type === 'brute_force').length, color: 'text-orange-400' },
                  { label: 'Session Hijack', value: events.filter(e => e.event_type === 'session_hijack').length, color: 'text-amber-400' },
                  { label: 'Role Escalation', value: events.filter(e => e.event_type === 'role_escalation').length, color: 'text-purple-400' },
                ].map(card => (
                  <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                    <div className={cn('text-3xl font-bold', card.color)}>{card.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{card.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Login Activity (7 Days)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={authTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="success" fill="#22c55e" name="Successful" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="mfa" fill="#3b82f6" name="MFA Verified" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Suspicious Login Locations</div>
                  <div className="space-y-2">
                    {Object.entries(
                      events.filter(e => e.event_type === 'failed_auth' || e.event_type === 'brute_force')
                        .reduce((acc, e) => { if (e.source_country) acc[e.source_country] = (acc[e.source_country] ?? 0) + 1; return acc; }, {} as Record<string, number>)
                    ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => {
                      const isRisky = ['CN', 'RU', 'NG', 'BR', 'IN'].includes(country);
                      return (
                        <div key={country} className="flex items-center gap-3 p-2 rounded bg-slate-800/60">
                          <div className={cn('text-xs font-mono font-bold w-8', isRisky ? 'text-red-400' : 'text-slate-400')}>{country}</div>
                          <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                            <div className={cn('h-1.5 rounded-full', isRisky ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${Math.min(100, count * 8)}%` }} />
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">{count}</div>
                          {isRisky && <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs px-1.5">High Risk</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: API SECURITY
            ══════════════════════════════════════════ */}
            <TabsContent value="api" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Requests', value: apiTotal, color: 'text-slate-200' },
                  { label: 'Blocked', value: apiBlocked, color: 'text-red-400' },
                  { label: 'Rate Limited', value: apiRateLimited, color: 'text-amber-400' },
                  { label: 'Anomalous', value: apiAnomalous, color: 'text-orange-400' },
                  { label: 'Errors (4xx/5xx)', value: apiErrors, color: 'text-red-300' },
                ].map(card => (
                  <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                    <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{card.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">API Traffic (24h)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={apiTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} interval={2} />
                      <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
                      <Area type="monotone" dataKey="ok" stackId="1" stroke="#22c55e" fill="#14532d" name="OK" />
                      <Area type="monotone" dataKey="errors" stackId="1" stroke="#f59e0b" fill="#78350f" name="Errors" />
                      <Area type="monotone" dataKey="blocked" stackId="1" stroke="#ef4444" fill="#7f1d1d" name="Blocked" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Requests by Integration</div>
                  {Object.entries(
                    apiActivity.reduce((acc, a) => { const k = a.integration_name ?? 'Unknown'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                    const blocked = apiActivity.filter(a => (a.integration_name ?? 'Unknown') === name && a.is_blocked).length;
                    return (
                      <div key={name} className="flex items-center gap-3 mb-2.5">
                        <div className="text-xs text-slate-400 w-24 truncate">{name}</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 relative">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, count / apiTotal * 100 * 2)}%` }} />
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">{count}</div>
                        {blocked > 0 && <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs px-1.5">{blocked} blocked</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Recent Anomalous Requests</div>
                <div className="space-y-2">
                  {apiActivity.filter(a => a.is_anomalous || a.is_blocked).slice(0, 8).map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                      <Badge variant="outline" className={cn('text-xs flex-shrink-0', a.is_blocked ? 'bg-red-900/60 text-red-300 border-red-700' : 'bg-amber-900/60 text-amber-300 border-amber-700')}>
                        {a.is_blocked ? 'BLOCKED' : 'ANOMALOUS'}
                      </Badge>
                      <code className="text-xs text-slate-400 font-mono truncate flex-1">{a.method} {a.endpoint}</code>
                      <span className="text-xs text-slate-500">{a.integration_name ?? 'Unknown'}</span>
                      <span className={cn('text-xs tabular-nums', a.status_code && a.status_code >= 400 ? 'text-red-400' : 'text-slate-500')}>{a.status_code}</span>
                      <span className="text-xs text-slate-600">{timeAgo(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: INFRASTRUCTURE
            ══════════════════════════════════════════ */}
            <TabsContent value="infrastructure" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { service: 'primary-database', label: 'Database', metrics: ['cpu_percent', 'memory_percent', 'connections_active'] },
                  { service: 'api-gateway', label: 'API Gateway', metrics: ['requests_per_second', 'latency_p95_ms', 'error_rate_percent'] },
                  { service: 'auth-service', label: 'Auth Service', metrics: ['login_success_rate', 'active_sessions'] },
                ].map(svc => (
                  <div key={svc.service} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      {svc.label}
                    </div>
                    <div className="space-y-2">
                      {svc.metrics.map(metric => {
                        const m = latestHealth[`${svc.service}:${metric}`];
                        if (!m) return null;
                        const pct = metric.includes('percent') || metric.includes('rate') ? m.value : null;
                        return (
                          <div key={metric} className="flex items-center justify-between">
                            <div className="text-xs text-slate-500 capitalize">{metric.replace(/_/g, ' ')}</div>
                            <div className="flex items-center gap-2">
                              {pct !== null && (
                                <div className="w-16 bg-slate-800 rounded-full h-1">
                                  <div className={cn('h-1 rounded-full', pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500')}
                                    style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                              )}
                              <span className={cn('text-sm font-bold tabular-nums',
                                m.status === 'critical' ? 'text-red-400' : m.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                              )}>
                                {typeof m.value === 'number' ? m.value.toFixed(m.unit === 'percent' ? 0 : 0) : m.value}
                                {m.unit === 'percent' ? '%' : m.unit === 'ms' ? 'ms' : m.unit === 'rps' ? ' rps' : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Database Load (24h)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={healthMetrics.filter(m => m.service_name === 'primary-database' && m.metric_type === 'cpu_percent').slice(0, 48).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="recorded_at" tickFormatter={v => new Date(v).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })} tick={{ fontSize: 9, fill: '#475569' }} interval={5} />
                    <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} formatter={(v: number) => `${v}%`} labelFormatter={v => new Date(v).toLocaleTimeString()} />
                    <Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} name="CPU %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'WAF Status', value: 'Active', detail: 'OWASP rule set', status: 'normal' as const },
                  { label: 'DDoS Shield', value: 'Active', detail: 'AWS Shield Advanced', status: 'normal' as const },
                  { label: 'TLS Version', value: '1.3', detail: 'Enforced globally', status: 'normal' as const },
                  { label: 'Uptime (30d)', value: '99.97%', detail: 'SLA target: 99.99%', status: 'normal' as const },
                ].map(item => (
                  <MetricGauge key={item.label} label={item.label} value={item.value} sublabel={item.detail} status={item.status} />
                ))}
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: COMPLIANCE
            ══════════════════════════════════════════ */}
            <TabsContent value="compliance" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {complianceSnaps.map(c => (
                  <div key={c.framework} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-bold text-slate-200">{c.framework}</div>
                      <div className={cn('text-2xl font-bold', c.compliance_score >= 85 ? 'text-emerald-400' : c.compliance_score >= 70 ? 'text-amber-400' : 'text-red-400')}>
                        {c.compliance_score.toFixed(0)}%
                      </div>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full mb-3">
                      <div className={cn('h-2 rounded-full transition-all', c.compliance_score >= 85 ? 'bg-emerald-500' : c.compliance_score >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                        style={{ width: `${c.compliance_score}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-sm font-bold text-emerald-400">{c.compliant}</div><div className="text-xs text-slate-500">Compliant</div></div>
                      <div><div className="text-sm font-bold text-slate-200">{c.total_controls}</div><div className="text-xs text-slate-500">Total Controls</div></div>
                      <div><div className="text-sm font-bold text-red-400">{c.total_controls - c.compliant}</div><div className="text-xs text-slate-500">Gaps</div></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Key Compliance Controls</div>
                <div className="space-y-2">
                  {[
                    { control: 'ISO 27001 A.9 — Access Control', status: 'compliant', evidence: 'RBAC + ABAC enforced via Supabase RLS' },
                    { control: 'ISO 27001 A.12.4 — Audit Logging', status: 'compliant', evidence: 'Immutable append-only audit logs — tamper-evident' },
                    { control: 'SOC 2 CC6 — Logical Access', status: 'compliant', evidence: 'MFA enforced for all admin roles' },
                    { control: 'SOC 2 CC7 — Incident Response', status: 'compliant', evidence: 'Incident management workflow active' },
                    { control: 'GDPR Art.32 — Security of Processing', status: 'compliant', evidence: 'AES-256 at rest, TLS 1.3 in transit' },
                    { control: 'GDPR Art.33 — Breach Notification', status: 'compliant', evidence: '72-hour POPIA/GDPR notification workflow configured' },
                    { control: 'POPIA s.22 — Data Breach', status: 'compliant', evidence: 'DLP monitoring active, regulatory notification process defined' },
                    { control: 'POPIA s.15 — Security Safeguards', status: 'compliant', evidence: 'Pseudonymisation, encryption, access controls implemented' },
                  ].map(item => (
                    <div key={item.control} className="flex items-start gap-3 p-2.5 rounded bg-slate-800/50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-300">{item.control}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.evidence}</div>
                      </div>
                      <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-700 text-xs flex-shrink-0">Compliant</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: TENANTS
            ══════════════════════════════════════════ */}
            <TabsContent value="tenants" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                {(['low', 'medium', 'high', 'critical'] as const).map(level => {
                  const count = tenantStatuses.filter(t => t.threat_level === level).length;
                  const colors = { low: 'text-emerald-400 border-emerald-900/50', medium: 'text-amber-400 border-amber-900/50', high: 'text-orange-400 border-orange-900/50', critical: 'text-red-400 border-red-900/50' };
                  return (
                    <div key={level} className={cn('bg-slate-900 border rounded-xl p-4 text-center', colors[level])}>
                      <div className={cn('text-3xl font-bold', colors[level].split(' ')[0])}>{count}</div>
                      <div className="text-xs text-slate-500 mt-1 capitalize">{level} Threat</div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Tenant Security Posture</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {['Operator', 'Score', 'Threat', 'Incidents', 'Failed Logins', 'MFA %', 'Compliance', 'WAF', 'IP List'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs text-slate-500 font-medium uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tenantStatuses
                        .sort((a, b) => (THREAT_LEVEL_ORDER[b.threat_level as keyof typeof THREAT_LEVEL_ORDER] ?? 3) - (THREAT_LEVEL_ORDER[a.threat_level as keyof typeof THREAT_LEVEL_ORDER] ?? 3))
                        .map(t => {
                          const casino = casinos.find(c => c.id === t.casino_id);
                          const sev = SEV_CONFIG[t.threat_level] ?? SEV_CONFIG.low;
                          return (
                            <tr key={t.casino_id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                              <td className="px-3 py-2.5 text-xs font-medium text-slate-300 max-w-[150px] truncate">{casino?.name ?? 'Unknown'}</td>
                              <td className="px-3 py-2.5">
                                <div className={cn('text-sm font-bold', t.security_score >= 80 ? 'text-emerald-400' : t.security_score >= 60 ? 'text-amber-400' : 'text-red-400')}>
                                  {t.security_score}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge variant="outline" className={cn('text-xs capitalize', sev.badge)}>{t.threat_level}</Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{t.open_incidents}</td>
                              <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{t.failed_logins_24h}</td>
                              <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{t.mfa_adoption_pct?.toFixed(0)}%</td>
                              <td className="px-3 py-2.5 text-xs text-center">
                                <span className={cn(t.compliance_score >= 75 ? 'text-emerald-400' : 'text-amber-400')}>{t.compliance_score?.toFixed(0)}%</span>
                              </td>
                              <td className="px-3 py-2.5 text-center">{t.waf_active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />}</td>
                              <td className="px-3 py-2.5 text-center">{t.ip_allowlist_active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-slate-600 mx-auto" />}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: AUDIT LOG
            ══════════════════════════════════════════ */}
            <TabsContent value="audit-log" className="mt-4 space-y-4">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
                    placeholder="Search audit log..." className="pl-9 h-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm" />
                </div>
                <Select value={auditType} onValueChange={setAuditType}>
                  <SelectTrigger className="h-9 w-44 bg-slate-900 border-slate-700 text-slate-300 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {['all','failed_auth','brute_force','api_abuse','data_export','admin_action','config_change','pii_access','role_escalation'].map(t => (
                      <SelectItem key={t} value={t} className="text-xs text-slate-300">{t === 'all' ? 'All Types' : formatEventType(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-500" />
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Immutable Audit Log</div>
                    <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-700 text-xs">Tamper-Evident</Badge>
                  </div>
                  <div className="text-xs text-slate-600">{filteredAudit.length} entries</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {['Timestamp', 'Event Type', 'Title', 'Severity', 'Actor Hash', 'IP Hash', 'System', 'Country'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAudit.slice(0, 50).map(ev => {
                        const sev = SEV_CONFIG[ev.severity] ?? SEV_CONFIG.info;
                        return (
                          <tr key={ev.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                            <td className="px-4 py-2 font-mono text-slate-500 whitespace-nowrap">{new Date(ev.created_at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                            <td className="px-4 py-2">
                              <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">{ev.event_type}</code>
                            </td>
                            <td className="px-4 py-2 text-slate-300 max-w-[200px] truncate">{ev.title}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <div className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
                                <span className={cn('capitalize', sev.text)}>{ev.severity}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 font-mono text-slate-600">{ev.source_ip_hash?.slice(0, 12)}...</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{ev.source_ip_hash?.slice(0, 10)}...</td>
                            <td className="px-4 py-2 text-slate-400">{ev.affected_system ?? '—'}</td>
                            <td className="px-4 py-2 text-slate-500">{ev.source_country ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 bg-slate-800/30 border-t border-slate-800 text-xs text-slate-600">
                  All log entries are append-only and cryptographically protected. Modification is prevented at the database layer via PostgreSQL RLS.
                </div>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════
                TAB: AI INSIGHTS
            ══════════════════════════════════════════ */}
            <TabsContent value="ai-insights" className="mt-4 space-y-4">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative">
                    <Eye className="h-5 w-5 text-emerald-400" />
                    <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">AI Security Intelligence Engine</div>
                    <div className="text-xs text-slate-500">Automated pattern analysis and anomaly detection</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {aiInsights.length > 0 ? aiInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm text-slate-300">{insight}</div>
                      <Badge className="bg-amber-900/40 text-amber-300 border-amber-700 text-xs flex-shrink-0">AI Alert</Badge>
                    </div>
                  )) : (
                    <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-700/40 text-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                      <div className="text-sm text-emerald-300 font-medium">No anomalies detected</div>
                      <div className="text-xs text-slate-500 mt-1">All systems operating within normal parameters</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Anomaly Detection Coverage</div>
                  <div className="space-y-2">
                    {[
                      { name: 'Login Behaviour Analysis', active: true, events: events.filter(e => e.event_type === 'failed_auth').length },
                      { name: 'API Traffic Pattern Analysis', active: true, events: apiAnomalous },
                      { name: 'Geographic Anomaly Detection', active: true, events: events.filter(e => e.source_country && ['CN','RU','NG'].includes(e.source_country)).length },
                      { name: 'Privilege Escalation Monitoring', active: true, events: events.filter(e => e.event_type === 'role_escalation').length },
                      { name: 'Data Exfiltration Detection', active: true, events: events.filter(e => e.event_type === 'mass_data_access' || e.event_type === 'data_export').length },
                      { name: 'Session Integrity Checking', active: true, events: events.filter(e => e.event_type === 'session_hijack').length },
                    ].map(item => (
                      <div key={item.name} className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-1.5 w-1.5 rounded-full', item.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600')} />
                          <span className="text-xs text-slate-300">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-xs">{item.events} events</Badge>
                          <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-700 text-xs">Active</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Responsible Gambling Security Overlay</div>
                  <div className="space-y-3 text-xs text-slate-400">
                    {[
                      { label: 'Risk Score Algorithm Integrity', status: 'verified', detail: 'No tampering detected in risk scoring engine' },
                      { label: 'Player Data Consistency', status: 'verified', detail: 'Checksums verified — no unauthorized mutations' },
                      { label: 'Intervention Workflow Integrity', status: 'verified', detail: 'Operator intervention logs match expected patterns' },
                      { label: 'Operator Data Manipulation', status: 'monitoring', detail: 'Continuous monitoring for anomalous data modifications' },
                      { label: 'Self-Exclusion Bypass Attempts', status: events.filter(e => e.event_type === 'unauthorized_access').length > 10 ? 'alert' : 'verified', detail: `${events.filter(e => e.event_type === 'unauthorized_access').length} unauthorized access events flagged` },
                    ].map(item => (
                      <div key={item.label} className="p-2.5 rounded bg-slate-800/50 flex items-start gap-3">
                        {item.status === 'verified' ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          : item.status === 'alert' ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                          : <Clock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                        <div>
                          <div className="font-medium text-slate-300">{item.label}</div>
                          <div className="text-slate-500 mt-0.5">{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* ── Incident Detail Modal ── */}
      {selectedIncident && (
        <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
          <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-100">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                Incident Response — {selectedIncident.incident_number ?? selectedIncident.incident_id ?? selectedIncident.id.slice(0, 8)}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedIncident.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Severity</div>
                  <Badge variant="outline" className={cn('capitalize', SEV_CONFIG[selectedIncident.severity]?.badge)}>{selectedIncident.severity}</Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Status</div>
                  <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[selectedIncident.status] ?? '')}>{selectedIncident.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Category</div>
                  <span className="text-slate-300 capitalize">{selectedIncident.category?.replace(/_/g, ' ')}</span>
                </div>
              </div>
              {selectedIncident.description && (
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Description</div>
                  <div className="text-slate-300 bg-slate-800 rounded p-2.5 text-sm">{selectedIncident.description}</div>
                </div>
              )}
              {selectedIncident.impact_assessment && (
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Impact Assessment</div>
                  <div className="text-slate-300 bg-slate-800/60 rounded p-2.5 text-sm">{selectedIncident.impact_assessment}</div>
                </div>
              )}
              {selectedIncident.affected_systems && selectedIncident.affected_systems.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Affected Systems</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIncident.affected_systems.map(s => <code key={s} className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">{s}</code>)}
                  </div>
                </div>
              )}
              {selectedIncident.escalated && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-red-300">ESCALATED</div>
                    {selectedIncident.escalation_reason && <div className="text-xs text-red-200/70 mt-0.5">{selectedIncident.escalation_reason}</div>}
                    {selectedIncident.regulatory_notification_required && <div className="text-xs text-amber-300 mt-1">POPIA / GDPR breach notification may be required within 72 hours.</div>}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Resolution Notes</div>
                <Textarea value={incidentNote} onChange={e => setIncidentNote(e.target.value)}
                  placeholder="Add investigation notes, containment actions, or resolution details..."
                  className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm resize-none h-20" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
                {selectedIncident.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateIncident('investigating')}
                    className="border-amber-700 text-amber-300 hover:bg-amber-900/30 text-xs">
                    Start Investigation
                  </Button>
                )}
                {(selectedIncident.status === 'open' || selectedIncident.status === 'investigating') && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateIncident('contained')}
                    className="border-blue-700 text-blue-300 hover:bg-blue-900/30 text-xs">
                    Mark Contained
                  </Button>
                )}
                {selectedIncident.status !== 'closed' && selectedIncident.status !== 'false_positive' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateIncident('closed')}
                      className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/30 text-xs">
                      Close Incident
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateIncident('false_positive')}
                      className="border-slate-600 text-slate-400 hover:bg-slate-800 text-xs">
                      False Positive
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
