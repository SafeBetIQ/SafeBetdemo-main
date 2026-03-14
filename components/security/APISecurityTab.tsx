'use client';

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/app/security-command-center/page';
import type { APIActivity } from '@/app/security-command-center/page';

interface Props {
  apiActivity: APIActivity[];
}

export function APISecurityTab({ apiActivity }: Props) {
  const apiTotal = apiActivity.length;
  const apiBlocked = apiActivity.filter(a => a.is_blocked).length;
  const apiRateLimited = apiActivity.filter(a => a.is_rate_limited).length;
  const apiAnomalous = apiActivity.filter(a => a.is_anomalous).length;
  const apiErrors = apiActivity.filter(a => a.status_code && a.status_code >= 400).length;
  const avgResponseMs = apiActivity.length > 0
    ? Math.round(apiActivity.reduce((s, a) => s + (a.response_ms ?? 0), 0) / apiActivity.length)
    : 0;

  const apiTrend = (() => {
    const byHour: Record<string, { time: string; ok: number; errors: number; blocked: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(); d.setHours(d.getHours() - i, 0, 0, 0);
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

  const byIntegration = Object.entries(
    apiActivity.reduce((acc, a) => {
      const k = a.integration_name ?? 'Unknown';
      if (!acc[k]) acc[k] = { total: 0, blocked: 0, anomalous: 0, errors: 0 };
      acc[k].total++;
      if (a.is_blocked) acc[k].blocked++;
      if (a.is_anomalous) acc[k].anomalous++;
      if (a.status_code && a.status_code >= 400) acc[k].errors++;
      return acc;
    }, {} as Record<string, { total: number; blocked: number; anomalous: number; errors: number }>)
  ).sort((a, b) => b[1].total - a[1].total);

  const endpointStats = Object.entries(
    apiActivity.reduce((acc, a) => {
      acc[a.endpoint] = (acc[a.endpoint] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Requests', value: apiTotal, color: 'text-slate-200' },
          { label: 'Blocked', value: apiBlocked, color: 'text-red-400' },
          { label: 'Rate Limited', value: apiRateLimited, color: 'text-amber-400' },
          { label: 'Anomalous', value: apiAnomalous, color: 'text-orange-400' },
          { label: 'Errors 4xx/5xx', value: apiErrors, color: 'text-red-300' },
          { label: 'Avg Latency', value: `${avgResponseMs}ms`, color: avgResponseMs < 200 ? 'text-emerald-400' : avgResponseMs < 500 ? 'text-amber-400' : 'text-red-400' },
        ].map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className={cn('text-2xl font-bold tabular-nums', card.color)}>{card.value}</div>
            <div className="text-xs text-slate-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">API Traffic — 24 Hours</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={apiTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="ok" stackId="1" stroke="#22c55e" fill="#14532d" name="OK" />
              <Area type="monotone" dataKey="errors" stackId="1" stroke="#f59e0b" fill="#78350f" name="Errors" />
              <Area type="monotone" dataKey="blocked" stackId="1" stroke="#ef4444" fill="#7f1d1d" name="Blocked" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Top Endpoints by Volume</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={endpointStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#475569' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#94a3b8' }} width={160} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} name="Requests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Integration Security Status</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {['Integration', 'Total Requests', 'Blocked', 'Anomalous', 'Errors', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byIntegration.map(([name, stats]) => {
                const riskLevel = stats.blocked > 5 || stats.anomalous > 3 ? 'high' : stats.blocked > 0 || stats.anomalous > 0 ? 'medium' : 'low';
                return (
                  <tr key={name} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5 font-medium text-slate-300">{name}</td>
                    <td className="px-3 py-2.5 text-slate-400 tabular-nums">{stats.total}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('tabular-nums font-medium', stats.blocked > 0 ? 'text-red-400' : 'text-slate-500')}>
                        {stats.blocked}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('tabular-nums font-medium', stats.anomalous > 0 ? 'text-orange-400' : 'text-slate-500')}>
                        {stats.anomalous}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('tabular-nums font-medium', stats.errors > 0 ? 'text-amber-400' : 'text-slate-500')}>
                        {stats.errors}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn('text-xs capitalize',
                        riskLevel === 'high' ? 'bg-red-900/60 text-red-300 border-red-700' :
                        riskLevel === 'medium' ? 'bg-amber-900/60 text-amber-300 border-amber-700' :
                        'bg-emerald-900/40 text-emerald-400 border-emerald-700')}>
                        {riskLevel === 'low' ? 'Secure' : riskLevel === 'medium' ? 'Review' : 'Alert'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Recent Anomalous & Blocked Requests</div>
        <div className="space-y-2">
          {apiActivity.filter(a => a.is_anomalous || a.is_blocked).slice(0, 10).map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40">
              <Badge variant="outline" className={cn('text-xs flex-shrink-0',
                a.is_blocked ? 'bg-red-900/60 text-red-300 border-red-700' : 'bg-amber-900/60 text-amber-300 border-amber-700')}>
                {a.is_blocked ? 'BLOCKED' : 'ANOMALOUS'}
              </Badge>
              <code className="text-xs text-slate-400 font-mono truncate flex-1">
                {a.method} {a.endpoint}
              </code>
              <span className="text-xs text-slate-500 flex-shrink-0">{a.integration_name ?? 'Unknown'}</span>
              <span className={cn('text-xs tabular-nums flex-shrink-0',
                a.status_code && a.status_code >= 400 ? 'text-red-400' : 'text-slate-500')}>
                {a.status_code}
              </span>
              <span className="text-xs text-slate-600 flex-shrink-0">{timeAgo(a.created_at)}</span>
            </div>
          ))}
          {apiActivity.filter(a => a.is_anomalous || a.is_blocked).length === 0 && (
            <div className="text-center text-slate-600 text-sm py-4">No anomalous requests detected</div>
          )}
        </div>
      </div>
    </div>
  );
}
