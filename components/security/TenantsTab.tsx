'use client';

import { Badge } from '@/components/ui/badge';
import { CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { SEV_CONFIG, THREAT_LEVEL_ORDER } from '@/app/security-command-center/page';
import type { TenantStatus, Casino } from '@/app/security-command-center/page';

interface Props {
  tenantStatuses: TenantStatus[];
  casinos: Casino[];
}

export function TenantsTab({ tenantStatuses, casinos }: Props) {
  const sorted = [...tenantStatuses].sort((a, b) =>
    (THREAT_LEVEL_ORDER[a.threat_level as keyof typeof THREAT_LEVEL_ORDER] ?? 3) -
    (THREAT_LEVEL_ORDER[b.threat_level as keyof typeof THREAT_LEVEL_ORDER] ?? 3)
  );

  const chartData = sorted.slice(0, 10).map(t => ({
    name: (casinos.find(c => c.id === t.casino_id)?.name ?? 'Unknown').slice(0, 15),
    score: t.security_score,
    compliance: t.compliance_score,
  }));

  const threatCounts = {
    critical: tenantStatuses.filter(t => t.threat_level === 'critical').length,
    high: tenantStatuses.filter(t => t.threat_level === 'high').length,
    medium: tenantStatuses.filter(t => t.threat_level === 'medium').length,
    low: tenantStatuses.filter(t => t.threat_level === 'low').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { level: 'low', label: 'Low Threat', color: 'text-emerald-400', border: 'border-emerald-900/40' },
          { level: 'medium', label: 'Medium Threat', color: 'text-amber-400', border: 'border-amber-900/40' },
          { level: 'high', label: 'High Threat', color: 'text-orange-400', border: 'border-orange-900/40' },
          { level: 'critical', label: 'Critical Threat', color: 'text-red-400', border: 'border-red-900/40' },
        ] as const).map(item => (
          <div key={item.level} className={cn('bg-slate-900 border rounded-xl p-4 text-center', item.border)}>
            <div className={cn('text-3xl font-bold', item.color)}>
              {threatCounts[item.level]}
            </div>
            <div className="text-xs text-slate-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Security Score by Operator</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#475569' }} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#94a3b8' }} width={100} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
              <Bar dataKey="score" fill="#3b82f6" radius={[0, 3, 3, 0]} name="Security Score" />
              <Bar dataKey="compliance" fill="#22c55e" radius={[0, 3, 3, 0]} name="Compliance %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Security Controls Adoption</div>
          <div className="space-y-3">
            {[
              { label: 'WAF Active', pct: Math.round((tenantStatuses.filter(t => t.waf_active).length / (tenantStatuses.length || 1)) * 100) },
              { label: 'Rate Limiting', pct: Math.round((tenantStatuses.filter(t => t.rate_limiting_active).length / (tenantStatuses.length || 1)) * 100) },
              { label: 'IP Allowlisting', pct: Math.round((tenantStatuses.filter(t => t.ip_allowlist_active).length / (tenantStatuses.length || 1)) * 100) },
              { label: 'MFA > 80%', pct: Math.round((tenantStatuses.filter(t => t.mfa_adoption_pct >= 80).length / (tenantStatuses.length || 1)) * 100) },
              { label: 'Compliance > 75%', pct: Math.round((tenantStatuses.filter(t => t.compliance_score >= 75).length / (tenantStatuses.length || 1)) * 100) },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-32 flex-shrink-0">{item.label}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full', item.pct >= 80 ? 'bg-emerald-500' : item.pct >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${item.pct}%` }} />
                </div>
                <span className={cn('text-xs tabular-nums w-10 text-right font-medium',
                  item.pct >= 80 ? 'text-emerald-400' : item.pct >= 60 ? 'text-amber-400' : 'text-red-400')}>
                  {item.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Tenant Security Posture — All Operators</div>
          <div className="text-xs text-slate-600">{tenantStatuses.length} operators</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {['Operator', 'Score', 'Threat', 'Incidents', 'Failed Logins', 'MFA%', 'Compliance', 'WAF', 'IP List', 'Rate Limit'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs text-slate-500 font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => {
                const casino = casinos.find(c => c.id === t.casino_id);
                const sev = SEV_CONFIG[t.threat_level] ?? SEV_CONFIG.low;
                return (
                  <tr key={t.casino_id} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-300 max-w-[140px] truncate">
                      {casino?.name ?? 'Unknown'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 bg-slate-800 rounded-full h-1">
                          <div className={cn('h-1 rounded-full',
                            t.security_score >= 80 ? 'bg-emerald-500' : t.security_score >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${t.security_score}%` }} />
                        </div>
                        <span className={cn('text-xs font-bold tabular-nums',
                          t.security_score >= 80 ? 'text-emerald-400' : t.security_score >= 60 ? 'text-amber-400' : 'text-red-400')}>
                          {t.security_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn('text-xs capitalize', sev.badge)}>
                        {t.threat_level}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{t.open_incidents}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{t.failed_logins_24h}</td>
                    <td className="px-3 py-2.5 text-xs text-center">
                      <span className={t.mfa_adoption_pct >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                        {t.mfa_adoption_pct?.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-center">
                      <span className={t.compliance_score >= 75 ? 'text-emerald-400' : 'text-amber-400'}>
                        {t.compliance_score?.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {t.waf_active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {t.ip_allowlist_active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-slate-600 mx-auto" />}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {t.rate_limiting_active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
