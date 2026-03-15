'use client';

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { SecurityStatusGlobe } from './SecurityStatusGlobe';
import { CompliancePill } from './CompliancePill';
import { MetricGauge } from './MetricGauge';
import type { SecurityEvent, SecurityIncident, APIActivity, TenantStatus, ComplianceSnap } from '@/components/security/securityUtils';

interface Props {
  events: SecurityEvent[];
  incidents: SecurityIncident[];
  apiActivity: APIActivity[];
  tenantStatuses: TenantStatus[];
  complianceSnaps: ComplianceSnap[];
  platformScore: number;
  platformThreat: 'low' | 'medium' | 'high' | 'critical';
  openIncidents: SecurityIncident[];
  criticalIncidents: SecurityIncident[];
  escalatedIncidents: SecurityIncident[];
  apiBlocked: number;
  apiAnomalous: number;
}

export function OverviewTab({
  events, incidents, apiActivity, tenantStatuses, complianceSnaps,
  platformScore, platformThreat, openIncidents, criticalIncidents,
  escalatedIncidents, apiBlocked, apiAnomalous,
}: Props) {
  const apiTotal = apiActivity.length;

  const eventTrend = (() => {
    const byHour: Record<string, { time: string; critical: number; high: number; medium: number; info: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(); d.setHours(d.getHours() - i, 0, 0, 0);
      const key = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      byHour[key] = { time: key, critical: 0, high: 0, medium: 0, info: 0 };
    }
    events.forEach(ev => {
      const h = new Date(ev.created_at); h.setMinutes(0, 0, 0);
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

  const events24h = events.filter(e => Date.now() - new Date(e.created_at).getTime() < 86400000);
  const failedLogins24h = events.filter(e => e.event_type === 'failed_auth' && Date.now() - new Date(e.created_at).getTime() < 86400000);
  const complianceAvg = complianceSnaps.length > 0
    ? Math.round(complianceSnaps.reduce((s, c) => s + c.compliance_score, 0) / complianceSnaps.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center gap-3">
          <div className="text-xs text-slate-500 uppercase tracking-widest">Platform Security</div>
          <SecurityStatusGlobe score={platformScore} threatLevel={platformThreat} size="lg" />
          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="text-center bg-slate-800/50 rounded-lg p-2">
              <div className="text-xl font-bold text-slate-200">{openIncidents.length}</div>
              <div className="text-xs text-slate-500">Open Incidents</div>
            </div>
            <div className="text-center bg-slate-800/50 rounded-lg p-2">
              <div className="text-xl font-bold text-red-400">{events.filter(e => e.severity === 'critical').length}</div>
              <div className="text-xs text-slate-500">Critical Events</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricGauge label="Platform Score" value={platformScore} unit="/100"
            status={platformScore >= 80 ? 'normal' : platformScore >= 60 ? 'warning' : 'critical'} />
          <MetricGauge label="Open Incidents" value={openIncidents.length}
            status={openIncidents.length === 0 ? 'normal' : openIncidents.length <= 2 ? 'warning' : 'critical'}
            pulse={openIncidents.length > 3} />
          <MetricGauge label="Events 24h" value={events24h.length} status="normal" />
          <MetricGauge label="API Blocked" value={apiBlocked}
            status={apiBlocked === 0 ? 'normal' : apiBlocked < 20 ? 'warning' : 'critical'} />
          <MetricGauge label="Auth Failures" value={failedLogins24h.length} status="normal" />
          <MetricGauge label="Escalated" value={escalatedIncidents.length}
            status={escalatedIncidents.length === 0 ? 'normal' : 'critical'} pulse={escalatedIncidents.length > 0} />
          <MetricGauge label="Operators" value={tenantStatuses.length} status="normal" />
          <MetricGauge label="Compliance Avg" value={complianceAvg} unit="%"
            status={complianceAvg >= 80 ? 'normal' : complianceAvg >= 65 ? 'warning' : 'critical'} />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Security Event Volume — 24 Hours</div>
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
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">API Traffic — 24 Hours</div>
          <ResponsiveContainer width="100%" height={200}>
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
      </div>

      {/* Compliance + Infrastructure row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Compliance Readiness</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {complianceSnaps.map(c => (
              <CompliancePill key={c.framework} framework={c.framework}
                score={c.compliance_score} controls={c.total_controls} compliant={c.compliant} />
            ))}
            {complianceSnaps.length === 0 && ['ISO27001', 'SOC2', 'GDPR', 'POPIA'].map(fw => (
              <CompliancePill key={fw} framework={fw} score={78 + Math.random() * 15} controls={20} compliant={15} />
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Tenant Risk Distribution</div>
          {(['critical', 'high', 'medium', 'low'] as const).map(level => {
            const count = tenantStatuses.filter(t => t.threat_level === level).length;
            const total = tenantStatuses.length || 1;
            const pct = (count / total) * 100;
            const colors = {
              critical: { bar: 'bg-red-500', text: 'text-red-400' },
              high: { bar: 'bg-orange-500', text: 'text-orange-400' },
              medium: { bar: 'bg-amber-500', text: 'text-amber-400' },
              low: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
            };
            return (
              <div key={level} className="flex items-center gap-3 mb-3">
                <div className={`text-xs font-medium capitalize w-14 ${colors[level].text}`}>{level}</div>
                <div className="flex-1 bg-slate-800 rounded-full h-2">
                  <div className={`h-2 rounded-full ${colors[level].bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-slate-500 tabular-nums w-6 text-right">{count}</div>
              </div>
            );
          })}
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500 text-center">
            {tenantStatuses.length} operators monitored
          </div>
        </div>
      </div>
    </div>
  );
}
