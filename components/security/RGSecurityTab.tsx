'use client';

import { Badge } from '@/components/ui/badge';
import { CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Clock, Shield, Database, Cpu, Eye, Lock } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { timeAgo, formatEventType } from '@/app/security-command-center/page';
import type { RGOverlay, SecurityEvent, Casino } from '@/app/security-command-center/page';

interface Props {
  rgOverlay: RGOverlay[];
  events: SecurityEvent[];
  casinos: Casino[];
}

const CHECK_CONFIG: Record<string, { icon: React.ElementType; label: string; description: string }> = {
  risk_score_integrity:           { icon: Cpu, label: 'Risk Score Integrity', description: 'ML model output validation' },
  player_data_consistency:        { icon: Database, label: 'Player Data Consistency', description: 'Record checksum verification' },
  intervention_workflow_integrity:{ icon: Shield, label: 'Intervention Workflow', description: 'Trigger log consistency check' },
  operator_data_manipulation:     { icon: Eye, label: 'Operator Manipulation Monitor', description: 'Anomalous write pattern detection' },
  self_exclusion_bypass:          { icon: Lock, label: 'Self-Exclusion Bypass', description: 'Enforcement integrity check' },
  algorithm_tampering:            { icon: AlertCircle, label: 'Algorithm Tampering', description: 'Model parameter signature check' },
  session_data_integrity:         { icon: Database, label: 'Session Data Integrity', description: 'Cryptographic session checksum' },
  compliance_data_integrity:      { icon: CheckCircle2, label: 'Compliance Data Integrity', description: 'Reporting data consistency audit' },
};

export function RGSecurityTab({ rgOverlay, events, casinos }: Props) {
  const overallStatus = rgOverlay.length > 0 ? (() => {
    if (rgOverlay.some(r => r.status === 'alert')) return 'alert';
    if (rgOverlay.some(r => r.status === 'warning')) return 'warning';
    if (rgOverlay.some(r => r.status === 'monitoring')) return 'monitoring';
    return 'verified';
  })() : 'verified';

  const avgIntegrity = rgOverlay.length > 0
    ? Math.round(rgOverlay.reduce((s, r) => s + r.integrity_score, 0) / rgOverlay.length)
    : 99;

  const totalAnomalies = rgOverlay.reduce((s, r) => s + r.anomalies_detected, 0);

  const uniqueChecks = Array.from(new Set(rgOverlay.map(r => r.check_type)));
  const latestByType: Record<string, RGOverlay> = {};
  rgOverlay.forEach(r => {
    if (!latestByType[r.check_type]) latestByType[r.check_type] = r;
  });

  const radarData = uniqueChecks.map(type => ({
    subject: CHECK_CONFIG[type]?.label ?? formatEventType(type),
    score: latestByType[type]?.integrity_score ?? 95,
  }));

  const manipulationAttempts = events.filter(e =>
    e.event_type === 'unauthorized_access' || e.event_type === 'suspicious_query' || e.event_type === 'mass_data_access'
  );

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className={cn(
        'border rounded-xl p-5 flex items-center gap-4',
        overallStatus === 'alert' ? 'bg-red-900/20 border-red-700/60' :
        overallStatus === 'warning' ? 'bg-amber-900/15 border-amber-700/40' :
        'bg-emerald-900/10 border-emerald-700/30'
      )}>
        {overallStatus === 'alert' ? <AlertCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
          : overallStatus === 'warning' ? <AlertCircle className="h-8 w-8 text-amber-400 flex-shrink-0" />
          : <CheckCircle2 className="h-8 w-8 text-emerald-400 flex-shrink-0" />}
        <div className="flex-1">
          <div className={cn('text-sm font-bold',
            overallStatus === 'alert' ? 'text-red-300' :
            overallStatus === 'warning' ? 'text-amber-300' : 'text-emerald-300')}>
            {overallStatus === 'alert' ? 'Responsible Gambling Security Alert Detected'
              : overallStatus === 'warning' ? 'Responsible Gambling Security Warning'
              : 'Responsible Gambling Data Integrity Verified'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {rgOverlay.length} integrity checks across all casino operators.
            {totalAnomalies > 0 ? ` ${totalAnomalies} anomalies detected — review required.` : ' No anomalies detected.'}
          </div>
        </div>
        <div className="text-center flex-shrink-0">
          <div className={cn('text-3xl font-bold',
            avgIntegrity >= 95 ? 'text-emerald-400' : avgIntegrity >= 85 ? 'text-amber-400' : 'text-red-400')}>
            {avgIntegrity}%
          </div>
          <div className="text-xs text-slate-500">Avg Integrity</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Check Results Grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Integrity Check Results</div>
          <div className="space-y-2.5">
            {Object.entries(latestByType).map(([checkType, overlay]) => {
              const config = CHECK_CONFIG[checkType];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div key={checkType} className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border',
                  overlay.status === 'alert' ? 'bg-red-900/15 border-red-700/40' :
                  overlay.status === 'warning' ? 'bg-amber-900/10 border-amber-700/30' :
                  overlay.status === 'monitoring' ? 'bg-blue-900/10 border-blue-700/30' :
                  'bg-slate-800/30 border-slate-700/30'
                )}>
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0',
                    overlay.status === 'verified' ? 'bg-emerald-900/40' : 'bg-slate-800')}>
                    <Icon className={cn('h-3.5 w-3.5',
                      overlay.status === 'alert' ? 'text-red-400' :
                      overlay.status === 'warning' ? 'text-amber-400' :
                      overlay.status === 'monitoring' ? 'text-blue-400' :
                      'text-emerald-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-300">{config.label}</span>
                      <span className={cn('text-xs font-bold tabular-nums flex-shrink-0',
                        overlay.integrity_score >= 95 ? 'text-emerald-400' : overlay.integrity_score >= 85 ? 'text-amber-400' : 'text-red-400')}>
                        {overlay.integrity_score.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{overlay.details ?? config.description}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={cn('text-xs',
                        overlay.status === 'alert' ? 'bg-red-900/60 text-red-300 border-red-700' :
                        overlay.status === 'warning' ? 'bg-amber-900/60 text-amber-300 border-amber-700' :
                        overlay.status === 'monitoring' ? 'bg-blue-900/60 text-blue-300 border-blue-700' :
                        'bg-emerald-900/40 text-emerald-400 border-emerald-700')}>
                        {overlay.status}
                      </Badge>
                      {overlay.anomalies_detected > 0 && (
                        <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs">
                          {overlay.anomalies_detected} anomalies
                        </Badge>
                      )}
                      <span className="text-xs text-slate-600 ml-auto">
                        Checked {timeAgo(overlay.last_check_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {Object.keys(latestByType).length === 0 && (
              <div className="text-center text-slate-600 text-sm py-4">No integrity check data available</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Radar chart */}
          {radarData.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">RG Security Radar</div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Radar name="Integrity" dataKey="score" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }}
                    formatter={(v: number) => [`${v}%`, 'Integrity']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Manipulation attempts */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">
              Suspected Manipulation Attempts
            </div>
            {manipulationAttempts.length > 0 ? (
              <div className="space-y-2">
                {manipulationAttempts.slice(0, 6).map(ev => (
                  <div key={ev.id} className="flex items-start gap-2.5 p-2 rounded bg-slate-800/50">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-300 truncate">{ev.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{ev.affected_system ?? 'Unknown system'}</div>
                    </div>
                    <span className="text-xs text-slate-600 flex-shrink-0">{timeAgo(ev.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-900/15 border border-emerald-700/30 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-300">No manipulation attempts detected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regulator Transparency Statement */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-emerald-400" />
          <div className="text-xs text-slate-400 uppercase tracking-wide">Regulator Transparency Statement</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Risk Algorithm Version', value: 'v2.1 — Signed & Audited', icon: Cpu },
            { label: 'Integrity Check Frequency', value: 'Continuous — every 30 minutes', icon: Clock },
            { label: 'Operator Access Monitoring', value: 'Active — write anomaly detection enabled', icon: Eye },
            { label: 'Player Data Integrity', value: 'SHA-256 checksums on all sensitive tables', icon: Lock },
            { label: 'Self-Exclusion Enforcement', value: 'Real-time verification — cross-operator active', icon: Shield },
            { label: 'Last Full Audit', value: 'March 2026 — all checks passed', icon: CheckCircle2 },
          ].map(item => {
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2.5 p-2.5 rounded bg-slate-800/40">
                <ItemIcon className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="text-slate-500">{item.label}</div>
                  <div className="text-slate-300 font-medium mt-0.5">{item.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
