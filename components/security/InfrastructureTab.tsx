'use client';

import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Server, Database, Shield, Globe, Cpu, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricGauge } from './MetricGauge';
import type { HealthMetric, AWSMetric } from '@/app/security-command-center/page';

interface Props {
  healthMetrics: HealthMetric[];
  latestHealth: Record<string, HealthMetric>;
  awsMetrics: AWSMetric[];
}

export function InfrastructureTab({ healthMetrics, latestHealth, awsMetrics }: Props) {
  const dbCpuHistory = healthMetrics
    .filter(m => m.service_name === 'primary-database' && m.metric_type === 'cpu_percent')
    .slice(0, 48).reverse();

  const apiLatencyHistory = healthMetrics
    .filter(m => m.service_name === 'api-gateway' && m.metric_type === 'latency_p95_ms')
    .slice(0, 24).reverse();

  const latestAWS: Record<string, AWSMetric> = {};
  awsMetrics.forEach(m => {
    const key = `${m.service}:${m.metric_name}`;
    if (!latestAWS[key]) latestAWS[key] = m;
  });

  const services = [
    {
      service: 'primary-database', label: 'Database', icon: Database,
      metrics: ['cpu_percent', 'memory_percent', 'connections_active'],
    },
    {
      service: 'api-gateway', label: 'API Gateway', icon: Server,
      metrics: ['requests_per_second', 'latency_p95_ms', 'error_rate_percent'],
    },
    {
      service: 'auth-service', label: 'Auth Service', icon: Shield,
      metrics: ['login_success_rate', 'active_sessions'],
    },
    {
      service: 'waf', label: 'WAF', icon: Globe,
      metrics: ['requests_blocked', 'cache_hit_rate'],
    },
  ];

  const awsServicesStatus = [
    { key: 'waf:blocked_requests', label: 'AWS WAF', detail: 'OWASP + Custom Rules', icon: Shield },
    { key: 'shield:ddos_events', label: 'AWS Shield Advanced', detail: 'DDoS Protection Active', icon: Wifi },
    { key: 'guardduty:findings_high', label: 'AWS GuardDuty', detail: 'Threat Detection Active', icon: AlertCircle },
    { key: 'cloudwatch:rds_cpu_percent', label: 'CloudWatch', detail: 'Metrics & Alarms Active', icon: Cpu },
    { key: 'amplify:build_success_rate', label: 'AWS Amplify', detail: 'CI/CD Pipeline Active', icon: Server },
    { key: 'cloudfront:cache_hit_ratio', label: 'CloudFront CDN', detail: 'Global Edge Active', icon: Globe },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map(svc => {
          const SvcIcon = svc.icon;
          return (
            <div key={svc.service} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <SvcIcon className="h-4 w-4 text-slate-400" />
                <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">{svc.label}</div>
              </div>
              <div className="space-y-2.5">
                {svc.metrics.map(metric => {
                  const m = latestHealth[`${svc.service}:${metric}`];
                  if (!m) return (
                    <div key={metric} className="flex items-center justify-between">
                      <div className="text-xs text-slate-600 capitalize">{metric.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-slate-700">—</div>
                    </div>
                  );
                  const isPercent = metric.includes('percent') || metric.includes('rate');
                  return (
                    <div key={metric} className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-500 capitalize flex-1 truncate">
                        {metric.replace(/_/g, ' ')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isPercent && (
                          <div className="w-12 bg-slate-800 rounded-full h-1">
                            <div className={cn('h-1 rounded-full',
                              m.value > 80 ? 'bg-red-500' : m.value > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                            )} style={{ width: `${Math.min(100, m.value)}%` }} />
                          </div>
                        )}
                        <span className={cn('text-sm font-bold tabular-nums',
                          m.status === 'critical' ? 'text-red-400' : m.status === 'warning' ? 'text-amber-400' : 'text-emerald-400')}>
                          {m.value.toFixed(0)}{metric.includes('percent') || metric.includes('rate') ? '%' : metric.includes('ms') ? 'ms' : metric === 'requests_per_second' ? ' rps' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Database CPU Load (48h)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dbCpuHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="recorded_at"
                tickFormatter={v => new Date(v).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                tick={{ fontSize: 9, fill: '#475569' }} interval={5} />
              <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }}
                formatter={(v: number) => [`${v}%`, 'CPU']}
                labelFormatter={v => new Date(v).toLocaleString('en-ZA')} />
              <Area type="monotone" dataKey="value" stroke="#22c55e" fill="#14532d" dot={false} name="CPU %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">API Gateway P95 Latency (24h)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={apiLatencyHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="recorded_at"
                tickFormatter={v => new Date(v).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                tick={{ fontSize: 9, fill: '#475569' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickFormatter={v => `${v}ms`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }}
                formatter={(v: number) => [`${v}ms`, 'Latency P95']}
                labelFormatter={v => new Date(v).toLocaleString('en-ZA')} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" dot={false} name="Latency ms" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">AWS Infrastructure Status</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {awsServicesStatus.map(svc => {
            const metric = latestAWS[svc.key];
            const SvcIcon = svc.icon;
            const isAlarm = metric?.alarm_state === 'ALARM';
            return (
              <div key={svc.key} className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                isAlarm ? 'bg-red-900/15 border-red-700/40' : 'bg-slate-800/40 border-slate-700/40'
              )}>
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  isAlarm ? 'bg-red-900/40' : 'bg-emerald-900/30')}>
                  <SvcIcon className={cn('h-4 w-4', isAlarm ? 'text-red-400' : 'text-emerald-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-300">{svc.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{svc.detail}</div>
                </div>
                <Badge className={cn('text-xs flex-shrink-0',
                  isAlarm ? 'bg-red-900/60 text-red-300 border-red-700' : 'bg-emerald-900/40 text-emerald-400 border-emerald-700')}>
                  {isAlarm ? 'ALARM' : 'OK'}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'TLS Version', value: '1.3', detail: 'Enforced globally', status: 'normal' as const },
          { label: 'Uptime (30d)', value: '99.97%', detail: 'SLA: 99.9%', status: 'normal' as const },
          { label: 'WAF Rules', value: 'OWASP', detail: 'Top 10 + Custom', status: 'normal' as const },
          { label: 'Last Backup', value: '<2h ago', detail: 'Encrypted + Verified', status: 'normal' as const },
        ].map(item => (
          <MetricGauge key={item.label} label={item.label} value={item.value} sublabel={item.detail} status={item.status} />
        ))}
      </div>
    </div>
  );
}
