'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CircleAlert as AlertCircle, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, RefreshCw, Radio, Activity, Lock, Globe, Database, Server, Zap, Eye, FileText, ChartBar as BarChart3, Cpu, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OverviewTab } from '@/components/security/OverviewTab';
import { ThreatFeedTab } from '@/components/security/ThreatFeedTab';
import { IncidentsTab } from '@/components/security/IncidentsTab';
import { AuthMonitorTab } from '@/components/security/AuthMonitorTab';
import { APISecurityTab } from '@/components/security/APISecurityTab';
import { InfrastructureTab } from '@/components/security/InfrastructureTab';
import { ComplianceTab } from '@/components/security/ComplianceTab';
import { TenantsTab } from '@/components/security/TenantsTab';
import { AuditLogTab } from '@/components/security/AuditLogTab';
import { AIInsightsTab } from '@/components/security/AIInsightsTab';
import { DataSecurityTab } from '@/components/security/DataSecurityTab';
import { RGSecurityTab } from '@/components/security/RGSecurityTab';
import type { SecurityEvent, SecurityIncident, APIActivity, HealthMetric, TenantStatus, Casino, ComplianceSnap, DataSecurityEvent, AIInsight, AWSMetric, RGOverlay } from '@/components/security/securityUtils';



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

const TABS = [
  { value: 'overview',       label: 'Overview',       icon: BarChart3 },
  { value: 'threat-feed',    label: 'Threat Feed',    icon: Activity },
  { value: 'incidents',      label: 'Incidents',      icon: ShieldAlert },
  { value: 'auth',           label: 'Auth Monitor',   icon: Lock },
  { value: 'api',            label: 'API Security',   icon: Zap },
  { value: 'data-security',  label: 'Data Security',  icon: Database },
  { value: 'infrastructure', label: 'Infrastructure', icon: Server },
  { value: 'compliance',     label: 'Compliance',     icon: CheckCircle2 },
  { value: 'tenants',        label: 'Tenants',        icon: Globe },
  { value: 'audit-log',      label: 'Audit Log',      icon: FileText },
  { value: 'ai-insights',    label: 'AI Insights',    icon: Eye },
  { value: 'rg-security',    label: 'RG Security',    icon: Cpu },
];

export default function SecurityCommandCenter() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [apiActivity, setAPIActivity] = useState<APIActivity[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [tenantStatuses, setTenantStatuses] = useState<TenantStatus[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [complianceSnaps, setComplianceSnaps] = useState<ComplianceSnap[]>([]);
  const [dataSecEvents, setDataSecEvents] = useState<DataSecurityEvent[]>([]);
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);
  const [awsMetrics, setAWSMetrics] = useState<AWSMetric[]>([]);
  const [rgOverlay, setRGOverlay] = useState<RGOverlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const [eventsRes, incidentsRes, apiRes, healthRes, tenantRes, casinosRes, complianceRes,
           dataSecRes, aiRes, awsRes, rgRes] = await Promise.all([
      supabase.from('security_events')
        .select('id,event_type,severity,title,source_country,affected_system,source_ip_hash,created_at,casino_id')
        .order('created_at', { ascending: false }).limit(600),
      supabase.from('security_incidents')
        .select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('api_activity')
        .select('*').order('created_at', { ascending: false }).limit(600),
      supabase.from('system_health_metrics')
        .select('*').order('recorded_at', { ascending: false }).limit(600),
      supabase.from('tenant_security_status')
        .select('*').order('security_score'),
      supabase.from('casinos')
        .select('id,name').eq('is_active', true).order('name'),
      supabase.from('compliance_snapshots')
        .select('framework,compliance_score,total_controls,compliant')
        .order('snapshot_date', { ascending: false }).limit(40),
      supabase.from('data_security_events')
        .select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('ai_security_insights')
        .select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('aws_infrastructure_metrics')
        .select('*').order('recorded_at', { ascending: false }).limit(300),
      supabase.from('rg_security_overlay')
        .select('*').order('last_check_at', { ascending: false }),
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
    if (dataSecRes.data) setDataSecEvents(dataSecRes.data);
    if (aiRes.data) setAIInsights(aiRes.data);
    if (awsRes.data) setAWSMetrics(awsRes.data);
    if (rgRes.data) setRGOverlay(rgRes.data);

    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(() => loadData(true), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData]);

  const criticalIncidents = incidents.filter(i =>
    i.severity === 'critical' && i.status !== 'closed' && i.status !== 'false_positive');
  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'investigating');
  const escalatedIncidents = incidents.filter(i => i.escalated);

  const platformScore = tenantStatuses.length > 0
    ? Math.round(tenantStatuses.reduce((s, t) => s + t.security_score, 0) / tenantStatuses.length)
    : 82;

  const platformThreat = ((): 'low' | 'medium' | 'high' | 'critical' => {
    if (criticalIncidents.length > 0) return 'critical';
    if (tenantStatuses.filter(t => t.threat_level === 'high').length > 2) return 'high';
    if (tenantStatuses.filter(t => t.threat_level === 'medium').length > 3) return 'medium';
    return 'low';
  })();

  const latestHealth: Record<string, HealthMetric> = {};
  healthMetrics.forEach(m => {
    const key = `${m.service_name}:${m.metric_type}`;
    if (!latestHealth[key]) latestHealth[key] = m;
  });

  const apiBlocked = apiActivity.filter(a => a.is_blocked).length;
  const apiAnomalous = apiActivity.filter(a => a.is_anomalous).length;

  const handleUpdateIncident = useCallback(async (id: string, status: string, notes?: string) => {
    await supabase.from('security_incidents').update({
      status,
      ...(notes ? { internal_notes: notes } : {}),
      updated_at: new Date().toISOString(),
      ...(status === 'closed' || status === 'remediated' ? { resolved_at: new Date().toISOString() } : {}),
      ...(status === 'contained' ? { contained_at: new Date().toISOString() } : {}),
    }).eq('id', id);
    loadData(true);
  }, [loadData]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-16 h-16">
              <Shield className="h-16 w-16 text-emerald-500/30 mx-auto" />
              <Shield className="h-16 w-16 text-emerald-500 mx-auto animate-pulse absolute inset-0" />
            </div>
            <div className="space-y-1">
              <div className="text-slate-200 font-semibold">Initialising Command Center</div>
              <div className="text-slate-500 text-sm">Loading security intelligence feeds...</div>
            </div>
            <div className="flex justify-center gap-1 mt-2">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="h-1 w-8 rounded-full bg-emerald-500/20 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-950 text-slate-100">

        {/* ── Header Bar ── */}
        <div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm sticky top-0 z-20">
          <div className="px-4 lg:px-6 py-3 flex items-center justify-between max-w-[1900px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-slate-100 tracking-widest uppercase">
                    Cybersecurity Command Center
                  </h1>
                  <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-700 text-xs hidden sm:inline-flex">
                    Enterprise
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">SafeBet IQ Platform · Real-time Security Intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              {criticalIncidents.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-700 rounded-lg px-2.5 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-red-400 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-bold text-red-300 hidden sm:inline">{criticalIncidents.length} CRITICAL</span>
                </div>
              )}
              {escalatedIncidents.length > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-900/40 border border-orange-700 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-orange-300 hidden sm:inline">{escalatedIncidents.length} ESCALATED</span>
                </div>
              )}
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
                <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
                <span>Live · {lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => loadData(true)} disabled={refreshing}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800">
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Critical banner */}
          {criticalIncidents.length > 0 && (
            <div className="px-4 lg:px-6 pb-2 max-w-[1900px] mx-auto">
              <div className="bg-red-900/25 border border-red-700/60 rounded-lg px-4 py-2.5 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-red-400 animate-pulse flex-shrink-0" />
                <span className="font-bold text-red-300 text-xs">ACTIVE CRITICAL INCIDENT — </span>
                <span className="text-red-200/80 text-xs truncate">{criticalIncidents[0].title}</span>
                {criticalIncidents[0].regulatory_notification_required && (
                  <Badge className="ml-auto flex-shrink-0 bg-red-900 text-red-300 border-red-700 text-xs">POPIA Notification Required</Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Security Posture Strip ── */}
        <div className="border-b border-slate-800/60 bg-slate-900/30">
          <div className="px-4 lg:px-6 py-3 max-w-[1900px] mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Platform Score', value: `${platformScore}/100`, color: platformScore >= 80 ? 'text-emerald-400' : platformScore >= 60 ? 'text-amber-400' : 'text-red-400' },
                { label: 'Threat Level', value: platformThreat.toUpperCase(), color: platformThreat === 'low' ? 'text-emerald-400' : platformThreat === 'medium' ? 'text-amber-400' : platformThreat === 'high' ? 'text-orange-400' : 'text-red-400' },
                { label: 'Open Incidents', value: openIncidents.length, color: openIncidents.length === 0 ? 'text-emerald-400' : openIncidents.length <= 3 ? 'text-amber-400' : 'text-red-400' },
                { label: 'Critical Events', value: events.filter(e => e.severity === 'critical').length, color: 'text-red-400' },
                { label: 'API Blocked', value: apiBlocked, color: apiBlocked === 0 ? 'text-emerald-400' : 'text-amber-400' },
                { label: 'AI Insights', value: aiInsights.filter(a => !a.is_acknowledged).length, color: 'text-blue-400' },
                { label: 'Tenants Monitored', value: tenantStatuses.length, color: 'text-slate-300' },
                { label: 'Compliance Avg', value: complianceSnaps.length > 0 ? `${Math.round(complianceSnaps.reduce((s,c) => s + c.compliance_score, 0) / complianceSnaps.length)}%` : '—', color: 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className={cn('text-lg font-bold tabular-nums leading-none', item.color)}>{item.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="px-4 lg:px-6 py-4 max-w-[1900px] mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap gap-1 mb-4">
              {TABS.map(tab => {
                const hasAlert =
                  (tab.value === 'incidents' && openIncidents.length > 0) ||
                  (tab.value === 'threat-feed' && events.filter(e => e.severity === 'critical').length > 0) ||
                  (tab.value === 'ai-insights' && aiInsights.filter(a => !a.is_acknowledged && (a.severity === 'high' || a.severity === 'critical')).length > 0);
                return (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 text-slate-400 h-7 px-2.5 gap-1.5 relative">
                    <tab.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {hasAlert && (
                      <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <OverviewTab
                events={events}
                incidents={incidents}
                apiActivity={apiActivity}
                tenantStatuses={tenantStatuses}
                complianceSnaps={complianceSnaps}
                platformScore={platformScore}
                platformThreat={platformThreat}
                openIncidents={openIncidents}
                criticalIncidents={criticalIncidents}
                escalatedIncidents={escalatedIncidents}
                apiBlocked={apiBlocked}
                apiAnomalous={apiAnomalous}
              />
            </TabsContent>

            <TabsContent value="threat-feed" className="mt-0">
              <ThreatFeedTab events={events} />
            </TabsContent>

            <TabsContent value="incidents" className="mt-0">
              <IncidentsTab
                incidents={incidents}
                casinos={casinos}
                onUpdateIncident={handleUpdateIncident}
              />
            </TabsContent>

            <TabsContent value="auth" className="mt-0">
              <AuthMonitorTab events={events} />
            </TabsContent>

            <TabsContent value="api" className="mt-0">
              <APISecurityTab apiActivity={apiActivity} />
            </TabsContent>

            <TabsContent value="data-security" className="mt-0">
              <DataSecurityTab dataSecEvents={dataSecEvents} />
            </TabsContent>

            <TabsContent value="infrastructure" className="mt-0">
              <InfrastructureTab
                healthMetrics={healthMetrics}
                latestHealth={latestHealth}
                awsMetrics={awsMetrics}
              />
            </TabsContent>

            <TabsContent value="compliance" className="mt-0">
              <ComplianceTab complianceSnaps={complianceSnaps} />
            </TabsContent>

            <TabsContent value="tenants" className="mt-0">
              <TenantsTab tenantStatuses={tenantStatuses} casinos={casinos} />
            </TabsContent>

            <TabsContent value="audit-log" className="mt-0">
              <AuditLogTab events={events} />
            </TabsContent>

            <TabsContent value="ai-insights" className="mt-0">
              <AIInsightsTab
                aiInsights={aiInsights}
                events={events}
                apiAnomalous={apiAnomalous}
                tenantStatuses={tenantStatuses}
                escalatedIncidents={escalatedIncidents}
                complianceSnaps={complianceSnaps}
                casinos={casinos}
              />
            </TabsContent>

            <TabsContent value="rg-security" className="mt-0">
              <RGSecurityTab rgOverlay={rgOverlay} events={events} casinos={casinos} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
