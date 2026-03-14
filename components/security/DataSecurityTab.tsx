'use client';

import { Badge } from '@/components/ui/badge';
import { CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Database, Lock, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { SEV_CONFIG, timeAgo, formatEventType } from '@/app/security-command-center/page';
import type { DataSecurityEvent } from '@/app/security-command-center/page';

interface Props {
  dataSecEvents: DataSecurityEvent[];
}

export function DataSecurityTab({ dataSecEvents }: Props) {
  const dlpTriggered = dataSecEvents.filter(e => e.dlp_triggered).length;
  const unencrypted = dataSecEvents.filter(e => !e.is_encrypted).length;
  const integrityFailed = dataSecEvents.filter(e => !e.integrity_verified).length;
  const unauthorizedQueries = dataSecEvents.filter(e => e.event_type === 'unauthorized_query').length;
  const anomalousQueries = dataSecEvents.filter(e => e.event_type === 'anomalous_query').length;

  const byType = Object.entries(
    dataSecEvents.reduce((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name: formatEventType(name), count }));

  const encryptionStatus = [
    { name: 'Data at Rest (AES-256)', status: 'active', coverage: 100 },
    { name: 'Data in Transit (TLS 1.3)', status: 'active', coverage: 100 },
    { name: 'Backup Encryption', status: 'active', coverage: 100 },
    { name: 'Column-level Encryption', status: 'active', coverage: 94 },
    { name: 'Key Rotation (90 days)', status: 'active', coverage: 100 },
  ];

  const sensitiveTableAccess = Object.entries(
    dataSecEvents
      .filter(e => e.table_name)
      .reduce((acc, e) => {
        const t = e.table_name!;
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'DLP Alerts', value: dlpTriggered, color: 'text-red-400' },
          { label: 'Unencrypted', value: unencrypted, color: unencrypted === 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Integrity Fail', value: integrityFailed, color: integrityFailed === 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Unauth Queries', value: unauthorizedQueries, color: unauthorizedQueries === 0 ? 'text-emerald-400' : 'text-orange-400' },
          { label: 'Anomalous Queries', value: anomalousQueries, color: anomalousQueries === 0 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
            <div className="text-xs text-slate-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Encryption & Security Status</div>
          <div className="space-y-3">
            {encryptionStatus.map(item => (
              <div key={item.name} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-300 truncate">{item.name}</span>
                    <span className="text-xs text-emerald-400 ml-2">{item.coverage}%</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full">
                    <div className="h-1 bg-emerald-500 rounded-full" style={{ width: `${item.coverage}%` }} />
                  </div>
                </div>
                <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700 text-xs flex-shrink-0">Active</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-emerald-900/15 border border-emerald-700/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">All sensitive data is encrypted at rest and in transit</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Data Events by Type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#475569' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#94a3b8' }} width={130} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
              <Bar dataKey="count" fill="#06b6d4" radius={[0, 3, 3, 0]} name="Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Sensitive Table Access Log</div>
          <div className="space-y-2">
            {sensitiveTableAccess.map(([table, count]) => {
              const isSensitive = ['players', 'transactions', 'interventions', 'nova_iq_results'].includes(table);
              return (
                <div key={table} className="flex items-center gap-3 p-2 rounded bg-slate-800/50">
                  <Database className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  <code className="text-xs text-slate-300 flex-1">{table}</code>
                  <span className="text-xs text-slate-500 tabular-nums">{count} accesses</span>
                  {isSensitive && (
                    <Badge className="bg-amber-900/50 text-amber-300 border-amber-700 text-xs px-1.5">PII</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Recent DLP & Security Alerts</div>
          <div className="space-y-2">
            {dataSecEvents.filter(e => e.severity === 'critical' || e.severity === 'high' || e.dlp_triggered).slice(0, 8).map(e => {
              const sev = SEV_CONFIG[e.severity] ?? SEV_CONFIG.info;
              return (
                <div key={e.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40">
                  <div className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-1', sev.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-300 truncate">{formatEventType(e.event_type)}</div>
                    {e.table_name && <div className="text-xs text-slate-500 mt-0.5">Table: {e.table_name}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {e.dlp_triggered && (
                      <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs px-1.5">DLP</Badge>
                    )}
                    <span className="text-xs text-slate-600">{timeAgo(e.created_at)}</span>
                  </div>
                </div>
              );
            })}
            {dataSecEvents.filter(e => e.severity === 'critical' || e.severity === 'high' || e.dlp_triggered).length === 0 && (
              <div className="text-center text-slate-600 text-sm py-4">
                <Shield className="h-6 w-6 mx-auto mb-2 text-emerald-700" />
                No critical data security events
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
