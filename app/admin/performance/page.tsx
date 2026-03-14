'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Database, Zap, Shield, Clock, TrendingUp, TrendingDown, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, RefreshCw, Server, Activity, ChartBar as BarChart2, Layers, ArrowUpRight, ArrowDownRight, Lock, HardDrive, Cpu, Globe, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TableStat {
  tablename: string;
  total_size: string;
  table_size: string;
  indexes_size: string;
  total_bytes: number;
  estimated_rows: number;
}

interface ApiTrafficRow {
  hour_bucket: string;
  endpoint: string;
  total_requests: number;
  error_requests: number;
  rate_limited_requests: number;
  avg_response_ms: number;
  error_rate: number;
}

interface RiskDistRow {
  casino_name: string;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_players: number;
  high_risk_percentage: number;
}

interface InterventionEffRow {
  casino_id: string;
  intervention_type: string;
  total_interventions: number;
  successful_count: number;
  success_rate: number;
}

interface PartitionRow {
  parent_table: string;
  partition_name: string;
  partition_range: string;
  total_size: string;
  total_bytes: number;
  estimated_rows: number;
}

interface RateLimitTier {
  tier_name: string;
  requests_per_minute: number;
  requests_per_hour: number;
  burst_limit: number;
  burst_window_seconds: number;
  is_active: boolean;
}

interface Violation {
  violation_type: string;
  endpoint: string;
  created_at: string;
  requests_attempted: number;
}

const COLORS = {
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  slate: '#64748b',
  cyan: '#06b6d4',
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = 'emerald',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; label: string };
  color?: 'emerald' | 'amber' | 'red' | 'blue' | 'cyan';
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  const iconColor = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    cyan: 'text-cyan-600',
  };

  return (
    <div className={`rounded-xl border p-5 bg-white shadow-sm ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-white/60 ${iconColor[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium">
          {trend.value >= 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className={trend.value >= 0 ? 'text-emerald-700' : 'text-red-600'}>
            {Math.abs(trend.value)}%
          </span>
          <span className="opacity-60">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 rounded-lg bg-slate-100">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [tableStats, setTableStats] = useState<TableStat[]>([]);
  const [apiTraffic, setApiTraffic] = useState<ApiTrafficRow[]>([]);
  const [riskDist, setRiskDist] = useState<RiskDistRow[]>([]);
  const [interventionEff, setInterventionEff] = useState<InterventionEffRow[]>([]);
  const [partitions, setPartitions] = useState<PartitionRow[]>([]);
  const [rateLimitTiers, setRateLimitTiers] = useState<RateLimitTier[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [indexCount, setIndexCount] = useState(0);
  const [matViewCount, setMatViewCount] = useState(0);
  const [partitionCount, setPartitionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'indexes' | 'partitions' | 'rate-limiting' | 'materialized-views'>('overview');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        tableStatsRes,
        apiTrafficRes,
        riskDistRes,
        interventionEffRes,
        partitionsRes,
        rateLimitTiersRes,
        violationsRes,
        perfStatsRes,
      ] = await Promise.all([
        supabase.from('v_table_size_stats').select('*').order('total_bytes', { ascending: false }).limit(12),
        supabase.from('mv_api_traffic_hourly').select('*').order('hour_bucket', { ascending: false }).limit(48),
        supabase.from('mv_casino_risk_distribution').select('*').order('high_risk_percentage', { ascending: false }).limit(10),
        supabase.from('mv_intervention_effectiveness').select('*').order('total_interventions', { ascending: false }).limit(10),
        supabase.from('v_partition_info').select('*').order('total_bytes', { ascending: false }).limit(20),
        supabase.from('rate_limit_tiers').select('*').order('requests_per_minute', { ascending: false }),
        supabase.from('rate_limit_violations').select('violation_type, endpoint, created_at, requests_attempted').order('created_at', { ascending: false }).limit(20),
        supabase.rpc('get_performance_stats'),
      ]);

      if (tableStatsRes.data) setTableStats(tableStatsRes.data);
      if (apiTrafficRes.data) setApiTraffic(apiTrafficRes.data);
      if (riskDistRes.data) setRiskDist(riskDistRes.data);
      if (interventionEffRes.data) setInterventionEff(interventionEffRes.data);
      if (partitionsRes.data) setPartitions(partitionsRes.data);
      if (rateLimitTiersRes.data) setRateLimitTiers(rateLimitTiersRes.data);
      if (violationsRes.data) setViolations(violationsRes.data);

      if (perfStatsRes.data) {
        const stats = perfStatsRes.data as { index_count?: number; materialized_view_count?: number; partition_count?: number };
        setIndexCount(stats.index_count ?? 0);
        setMatViewCount(stats.materialized_view_count ?? 0);
        setPartitionCount(stats.partition_count ?? 0);
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load performance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalRows = tableStats.reduce((sum, t) => sum + (t.estimated_rows || 0), 0);
  const totalSizeBytes = tableStats.reduce((sum, t) => sum + (t.total_bytes || 0), 0);
  const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  const hourlyChartData = (() => {
    const byHour: Record<string, { hour: string; requests: number; errors: number; avg_ms: number }> = {};
    apiTraffic.forEach(row => {
      const hour = new Date(row.hour_bucket).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
      if (!byHour[hour]) byHour[hour] = { hour, requests: 0, errors: 0, avg_ms: 0 };
      byHour[hour].requests += row.total_requests;
      byHour[hour].errors += row.error_requests;
      byHour[hour].avg_ms = Math.round((byHour[hour].avg_ms + (row.avg_response_ms || 0)) / 2);
    });
    return Object.values(byHour).slice(0, 24).reverse();
  })();

  const riskChartData = riskDist.slice(0, 6).map(r => ({
    name: r.casino_name?.split(' ')[0] ?? 'Unknown',
    Critical: r.critical_count,
    High: r.high_count,
    Medium: r.medium_count,
    Low: r.low_count,
  }));

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'indexes', label: 'Indexes & Queries', icon: Zap },
    { key: 'partitions', label: 'Partitioning', icon: Layers },
    { key: 'materialized-views', label: 'Materialized Views', icon: Database },
    { key: 'rate-limiting', label: 'Rate Limiting', icon: Shield },
  ] as const;

  const MATVIEWS = [
    { name: 'mv_casino_daily_stats', description: 'Daily session & revenue stats per casino (90 days)', refresh: 'Every 15 min', rows: 'casino × day', impact: 'ESG reporting, dashboards' },
    { name: 'mv_player_risk_summary', description: 'Per-player risk snapshot with 30-day aggregates', refresh: 'On demand', rows: '1 per player', impact: 'Risk dashboards, BRI engine' },
    { name: 'mv_casino_risk_distribution', description: 'Risk tier distribution (critical/high/medium/low) per casino', refresh: 'Every 5 min', rows: '1 per casino', impact: 'Dashboard widgets, charts' },
    { name: 'mv_intervention_effectiveness', description: 'Intervention outcome rates per casino and type', refresh: 'Daily', rows: 'casino × type', impact: 'Compliance reporting' },
    { name: 'mv_api_traffic_hourly', description: 'API traffic summary by hour with error rates and latency', refresh: 'Every 5 min', rows: 'hour × endpoint', impact: 'Rate limit analytics, capacity planning' },
  ];

  const INDEX_GROUPS = [
    {
      table: 'sessions',
      description: 'Primary gameplay data — highest query volume',
      indexes: [
        'idx_sessions_casino_game_type_time — (casino_id, game_type, started_at DESC)',
        'idx_sessions_casino_device_time — (casino_id, device_type, started_at DESC)',
        'idx_sessions_player_flagged_time — (player_id, is_flagged, started_at DESC)',
        'idx_sessions_active_only — (casino_id, started_at DESC) WHERE ended_at IS NULL',
      ],
    },
    {
      table: 'transactions',
      description: 'Financial records — aggregation and risk filtering',
      indexes: [
        'idx_transactions_casino_type_time — (casino_id, transaction_type, processed_at DESC)',
        'idx_transactions_player_type_time — (player_id, transaction_type, processed_at DESC)',
        'idx_transactions_casino_risk_time — (casino_id, risk_flag, processed_at DESC) WHERE risk_flag',
        'idx_transactions_casino_time_amount — (casino_id, processed_at DESC) INCLUDE (amount)',
      ],
    },
    {
      table: 'behaviour_events',
      description: 'Behavioural signals — severity and type filtering',
      indexes: [
        'idx_behaviour_events_casino_severity_time — (casino_id, severity, recorded_at DESC)',
        'idx_behaviour_events_casino_type_time — (casino_id, event_type, recorded_at DESC)',
        'idx_behaviour_events_player_severity_time — (player_id, severity, recorded_at DESC)',
        'idx_behaviour_events_review_queue — (casino_id, recorded_at DESC) WHERE flagged_for_review',
      ],
    },
    {
      table: 'players',
      description: 'Player records — risk-sorted lists and high-value queries',
      indexes: [
        'idx_players_casino_risk_active — (casino_id, risk_level, last_active DESC)',
        'idx_players_casino_active_wagered — (casino_id, is_active, total_wagered DESC)',
        'idx_players_high_risk_active — (casino_id, last_active DESC) WHERE active AND high-risk',
      ],
    },
    {
      table: 'intervention_delivery_queue',
      description: 'Queue processing — critical throughput for interventions',
      indexes: [
        'idx_intervention_queue_status_scheduled — (status, scheduled_at ASC)',
        'idx_intervention_queue_casino_status_scheduled — (casino_id, status, scheduled_at ASC)',
      ],
    },
    {
      table: 'api_activity + security_events',
      description: 'API monitoring and security event feeds',
      indexes: [
        'idx_api_activity_casino_time — (casino_id, created_at DESC)',
        'idx_api_activity_errors — (casino_id, created_at DESC) WHERE status_code >= 400',
        'idx_security_events_casino_severity_time — (casino_id, severity, created_at DESC)',
        'idx_security_events_open — (casino_id, created_at DESC) WHERE is_resolved = false',
      ],
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Performance & Scalability</h1>
            <p className="text-sm text-slate-500 mt-1">
              Database indexing, partitioning, caching, and rate limiting — optimised for millions of records and high API traffic
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className={`h-2 w-2 rounded-full ${refreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              {refreshing ? 'Refreshing...' : `Updated ${lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard icon={Database} label="Total DB Rows" value={totalRows > 1000000 ? `${(totalRows / 1000000).toFixed(1)}M` : totalRows > 1000 ? `${(totalRows / 1000).toFixed(0)}K` : totalRows} sub="Across all tables" color="blue" />
          <KpiCard icon={HardDrive} label="Total DB Size" value={`${totalSizeMb} MB`} sub="Tables + indexes" color="cyan" />
          <KpiCard icon={Zap} label="Indexes" value={indexCount} sub="Public schema" color="emerald" />
          <KpiCard icon={Layers} label="Partitions" value={partitionCount} sub="Archive tables" color="emerald" />
          <KpiCard icon={Database} label="Mat. Views" value={matViewCount} sub="Pre-computed" color="amber" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* === OVERVIEW TAB === */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* API Traffic Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <SectionHeader icon={Activity} title="API Traffic — Last 24 Hours" sub="Total requests and error count by hour" />
              {hourlyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={hourlyChartData}>
                    <defs>
                      <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="requests" name="Requests" stroke={COLORS.blue} fill="url(#reqGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="errors" name="Errors" stroke={COLORS.red} fill="url(#errGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No API traffic data yet</div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Table Sizes */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <SectionHeader icon={HardDrive} title="Table Sizes" sub="Estimated rows and storage per table" />
                <div className="space-y-3">
                  {tableStats.slice(0, 8).map(t => {
                    const maxBytes = tableStats[0]?.total_bytes || 1;
                    const pct = Math.max(2, (t.total_bytes / maxBytes) * 100);
                    return (
                      <div key={t.tablename}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-mono text-slate-700">{t.tablename}</span>
                          <div className="flex gap-3 text-xs text-slate-500">
                            <span>{t.total_size}</span>
                            <span className="text-slate-400">{t.estimated_rows > 0 ? `~${(t.estimated_rows / 1000).toFixed(0)}K rows` : '—'}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Risk Distribution Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <SectionHeader icon={BarChart2} title="Player Risk Distribution" sub="From mv_casino_risk_distribution (pre-computed)" />
                {riskChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={riskChartData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Critical" fill={COLORS.red} stackId="a" />
                      <Bar dataKey="High" fill={COLORS.amber} stackId="a" />
                      <Bar dataKey="Medium" fill={COLORS.blue} stackId="a" />
                      <Bar dataKey="Low" fill={COLORS.emerald} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No risk distribution data yet</div>
                )}
              </div>
            </div>

            {/* Intervention Effectiveness */}
            {interventionEff.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <SectionHeader icon={TrendingUp} title="Intervention Effectiveness" sub="From mv_intervention_effectiveness (pre-computed)" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                        <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Total</th>
                        <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Successful</th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interventionEff.slice(0, 6).map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-2.5 pr-4 font-medium text-slate-800 capitalize">{row.intervention_type?.replace(/_/g, ' ')}</td>
                          <td className="py-2.5 pr-4 text-right text-slate-600">{row.total_interventions}</td>
                          <td className="py-2.5 pr-4 text-right text-slate-600">{row.successful_count}</td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-24">
                                <div
                                  className={`h-full rounded-full ${row.success_rate >= 70 ? 'bg-emerald-500' : row.success_rate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${row.success_rate}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold ${row.success_rate >= 70 ? 'text-emerald-700' : row.success_rate >= 40 ? 'text-amber-700' : 'text-red-700'}`}>
                                {row.success_rate?.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === INDEXES TAB === */}
        {activeTab === 'indexes' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Index Strategy Summary</p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>{indexCount} total indexes</strong> covering all public schema tables. Strategy uses composite indexes for common
                    multi-column filters, partial indexes to reduce index size for flag/status columns, covering indexes (INCLUDE)
                    to eliminate heap fetches on aggregation queries, and DESC ordering for time-series queries.
                  </p>
                </div>
              </div>
            </div>

            {INDEX_GROUPS.map(group => (
              <div key={group.table} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 font-mono">{group.table}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
                    {group.indexes.length} indexes
                  </span>
                </div>
                <div className="space-y-2">
                  {group.indexes.map((idx, i) => {
                    const [name, ...rest] = idx.split(' — ');
                    const isPartial = idx.includes('WHERE');
                    const isCovering = idx.includes('INCLUDE');
                    return (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg">
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono text-slate-700">{name}</span>
                          {rest.length > 0 && <span className="text-xs text-slate-500 ml-2">{rest.join(' — ')}</span>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {isPartial && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">partial</span>}
                          {isCovering && <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded font-medium">covering</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === PARTITIONS TAB === */}
        {activeTab === 'partitions' && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Layers className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Partitioning Strategy</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    Archive tables (sessions_archive, transactions_archive, behaviour_events_archive) are partitioned by month using
                    PostgreSQL declarative range partitioning. Partitions cover 2024-01 through 2026-12, with new partitions created
                    automatically 3 months ahead via <span className="font-mono">ensure_future_partitions()</span>. Records older than
                    6 months are moved from live tables via <span className="font-mono">archive_old_records()</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {['sessions_archive', 'transactions_archive', 'behaviour_events_archive'].map(table => {
                const tablePartitions = partitions.filter(p => p.parent_table === table);
                const totalBytes = tablePartitions.reduce((s, p) => s + (p.total_bytes || 0), 0);
                return (
                  <div key={table} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs font-mono font-semibold text-slate-800 mb-1">{table}</p>
                    <p className="text-2xl font-bold text-slate-900">{tablePartitions.length}</p>
                    <p className="text-xs text-slate-500">partitions · {totalBytes > 0 ? `${(totalBytes / 1024).toFixed(0)} KB` : '0 KB'} total</p>
                  </div>
                );
              })}
            </div>

            {partitions.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <SectionHeader icon={Layers} title="Partition Details" sub={`${partitions.length} partitions across archive tables`} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Partition</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Parent Table</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Range</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Size</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Est. Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partitions.slice(0, 24).map((p, i) => (
                        <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                          <td className="px-6 py-3 font-mono text-xs text-slate-700">{p.partition_name}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{p.parent_table}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-40 truncate">{p.partition_range}</td>
                          <td className="px-4 py-3 text-right text-xs text-slate-600">{p.total_size}</td>
                          <td className="px-6 py-3 text-right text-xs text-slate-500">{p.estimated_rows > 0 ? p.estimated_rows.toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
                No partition data available — partitioned archive tables are empty until archival runs.
              </div>
            )}
          </div>
        )}

        {/* === MATERIALIZED VIEWS TAB === */}
        {activeTab === 'materialized-views' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Materialized View Strategy</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Pre-computed aggregations eliminate full table scans on the largest query patterns: ESG reporting, risk dashboards,
                    API traffic analytics, and intervention effectiveness. All views use CONCURRENTLY refresh to avoid blocking reads.
                    Unique indexes are required on each view to enable concurrent refresh.
                  </p>
                </div>
              </div>
            </div>

            {MATVIEWS.map(mv => (
              <div key={mv.name} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm font-semibold text-slate-900">{mv.name}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{mv.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Refresh: <strong className="text-slate-700">{mv.refresh}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Layers className="h-3.5 w-3.5" />
                        <span>Granularity: <strong className="text-slate-700">{mv.rows}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Zap className="h-3.5 w-3.5" />
                        <span>Used by: <strong className="text-slate-700">{mv.impact}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <SectionHeader icon={RefreshCw} title="Refresh Functions" sub="Call via db-maintenance edge function or directly via RPC" />
              <div className="space-y-2.5">
                {[
                  { fn: 'refresh_realtime_views()', desc: 'Refreshes mv_casino_risk_distribution + mv_api_traffic_hourly', freq: 'Every 5 min' },
                  { fn: 'refresh_casino_daily_stats()', desc: 'Refreshes mv_casino_daily_stats', freq: 'Every 15 min' },
                  { fn: 'refresh_player_risk_summary()', desc: 'Refreshes mv_player_risk_summary', freq: 'On demand / after BRI run' },
                  { fn: 'refresh_all_materialized_views()', desc: 'Full refresh of all 5 views', freq: 'Daily at 02:00 SAST' },
                ].map(({ fn, desc, freq }) => (
                  <div key={fn} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <span className="text-xs font-mono font-semibold text-slate-800">{fn}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-4">{freq}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === RATE LIMITING TAB === */}
        {activeTab === 'rate-limiting' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-slate-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Sliding Window Rate Limiting</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Upgraded from fixed-window to a sliding 60-second window algorithm with per-endpoint tier configurations,
                    burst allowance (10s micro-window), circuit breaker pattern (opens after 10 violations/minute), and
                    response headers: <span className="font-mono text-xs">X-RateLimit-Remaining</span>, <span className="font-mono text-xs">Retry-After</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Tier Cards */}
            <div>
              <SectionHeader icon={Layers} title="Rate Limit Tiers" sub="Per-endpoint configurations supporting horizontal scaling" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rateLimitTiers.map(tier => (
                  <div key={tier.tier_name} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-slate-900 capitalize">{tier.tier_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {tier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Per minute</span>
                        <span className="font-semibold text-slate-800">{tier.requests_per_minute.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Per hour</span>
                        <span className="font-semibold text-slate-800">{tier.requests_per_hour.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Burst limit</span>
                        <span className="font-semibold text-amber-700">{tier.burst_limit.toLocaleString()} / {tier.burst_window_seconds}s</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (tier.requests_per_minute / 5000) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Circuit Breaker */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <SectionHeader icon={Lock} title="Circuit Breaker Pattern" sub="Automatic protection against sustained abuse" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { state: 'Closed', color: 'emerald', desc: 'Normal operation — all requests processed', icon: CheckCircle },
                  { state: 'Half-Open', color: 'amber', desc: 'Testing recovery — 1 probe request per 30s', icon: AlertTriangle },
                  { state: 'Open', color: 'red', desc: 'Blocking all traffic — opens after 10 violations/min', icon: AlertTriangle },
                ].map(({ state, color, desc, icon: StatusIcon }) => (
                  <div key={state} className={`rounded-lg p-4 border ${color === 'emerald' ? 'bg-emerald-50 border-emerald-200' : color === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                    <div className={`flex items-center gap-2 mb-2 ${color === 'emerald' ? 'text-emerald-700' : color === 'amber' ? 'text-amber-700' : 'text-red-700'}`}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{state}</span>
                    </div>
                    <p className={`text-xs ${color === 'emerald' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : 'text-red-600'}`}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Violations */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <SectionHeader icon={AlertTriangle} title="Recent Rate Limit Violations" sub="Last 20 violations across all endpoints" />
              {violations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                        <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Endpoint</th>
                        <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Attempts</th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {violations.map((v, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-2.5 pr-4">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">{v.violation_type?.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{v.endpoint}</td>
                          <td className="py-2.5 pr-4 text-right text-xs text-slate-600">{v.requests_attempted}</td>
                          <td className="py-2.5 text-right text-xs text-slate-400">{new Date(v.created_at).toLocaleTimeString('en-ZA')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-sm">No violations recorded yet</div>
              )}
            </div>

            {/* Horizontal Scaling Note */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <SectionHeader icon={Globe} title="Horizontal Scaling Architecture" sub="How the system scales under heavy load" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  { title: 'Supabase Edge Functions', desc: 'Stateless Deno workers — scale to thousands of concurrent instances automatically. No session state stored in function memory.' },
                  { title: 'Connection Pooling (PgBouncer)', desc: 'Supabase uses PgBouncer in transaction mode. Each edge function uses a service-role client with pooled connections — no connection exhaustion at scale.' },
                  { title: 'Read Replicas (RLS-aware)', desc: 'Materialized views and read-heavy analytics queries routed to read replica via Supabase pooler. Write path remains on primary.' },
                  { title: 'Rate Limit State in DB', desc: 'Sliding window counters stored in api_rate_limits table — shared state across all edge function instances. Atomic upserts prevent race conditions.' },
                  { title: 'Archive Partitioning', desc: 'Monthly range partitions on sessions/transactions keep live table size bounded. Partition pruning eliminates scanning old data on time-range queries.' },
                  { title: 'Materialized View Refresh', desc: 'CONCURRENTLY refresh runs while reads continue. Dedicated db-maintenance edge function handles scheduled refresh triggered externally.' },
                ].map(({ title, desc }) => (
                  <div key={title} className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-800 mb-1">{title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
