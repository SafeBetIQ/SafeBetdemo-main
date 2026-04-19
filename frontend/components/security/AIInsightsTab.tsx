'use client';

import { Badge } from '@/components/ui/badge';
import { Eye, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Brain, TrendingUp, Globe, Zap, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEV_CONFIG, timeAgo, formatEventType } from '@/components/security/securityUtils';
import type { AIInsight, SecurityEvent, TenantStatus, ComplianceSnap, SecurityIncident, Casino } from '@/components/security/securityUtils';

interface Props {
  aiInsights: AIInsight[];
  events: SecurityEvent[];
  apiAnomalous: number;
  tenantStatuses: TenantStatus[];
  escalatedIncidents: SecurityIncident[];
  complianceSnaps: ComplianceSnap[];
  casinos: Casino[];
}

const INSIGHT_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  volume_spike:        { icon: TrendingUp, color: 'text-orange-400' },
  pattern_change:      { icon: Brain, color: 'text-blue-400' },
  geographic_anomaly:  { icon: Globe, color: 'text-red-400' },
  compliance_risk:     { icon: AlertTriangle, color: 'text-amber-400' },
  unusual_behaviour:   { icon: Eye, color: 'text-amber-400' },
  integration_anomaly: { icon: Zap, color: 'text-orange-400' },
  anomaly_detected:    { icon: AlertTriangle, color: 'text-red-400' },
  threat_prediction:   { icon: TrendingUp, color: 'text-red-400' },
};

export function AIInsightsTab({ aiInsights, events, apiAnomalous, tenantStatuses, escalatedIncidents, complianceSnaps, casinos }: Props) {
  const derivedInsights: string[] = [
    escalatedIncidents.length > 0
      ? `${escalatedIncidents.length} escalated incident${escalatedIncidents.length > 1 ? 's' : ''} — potential POPIA regulatory notification required.`
      : null,
    apiAnomalous > 10
      ? `Anomalous API traffic spike: ${apiAnomalous} unusual requests detected in the monitoring window.`
      : null,
    tenantStatuses.filter(t => t.threat_level === 'high' || t.threat_level === 'critical').length > 0
      ? `${tenantStatuses.filter(t => t.threat_level === 'high' || t.threat_level === 'critical').length} operator(s) at elevated threat level — review recommended.`
      : null,
    events.filter(e => e.source_country && ['CN', 'RU', 'NG'].includes(e.source_country)).length > 5
      ? 'Login attempts from high-risk jurisdictions (CN, RU, NG) detected — geo-velocity analysis running.'
      : null,
    complianceSnaps.some(c => c.compliance_score < 70)
      ? 'One or more compliance frameworks below 70% — remediation required before next audit cycle.'
      : null,
  ].filter(Boolean) as string[];

  const unacknowledged = aiInsights.filter(a => !a.is_acknowledged);
  const critical = aiInsights.filter(a => a.severity === 'critical');
  const high = aiInsights.filter(a => a.severity === 'high');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Insights', value: aiInsights.length, color: 'text-slate-300' },
          { label: 'Unacknowledged', value: unacknowledged.length, color: unacknowledged.length > 0 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'Critical Alerts', value: critical.length, color: critical.length > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'High Severity', value: high.length, color: high.length > 0 ? 'text-orange-400' : 'text-emerald-400' },
        ].map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className={cn('text-3xl font-bold', card.color)}>{card.value}</div>
            <div className="text-xs text-slate-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* AI Engine Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center">
              <Eye className="h-5 w-5 text-blue-400" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 animate-ping" />
            <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-200">AI Security Intelligence Engine</div>
            <div className="text-xs text-slate-500">Model v2.1 · Automated pattern analysis and anomaly detection · 30-second refresh</div>
          </div>
          <Badge className="ml-auto bg-blue-900/60 text-blue-300 border-blue-700 text-xs">Active</Badge>
        </div>

        {derivedInsights.length > 0 ? (
          <div className="space-y-2.5">
            {derivedInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-amber-700/30">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-slate-300">{insight}</div>
                <Badge className="bg-amber-900/40 text-amber-300 border-amber-700 text-xs flex-shrink-0">Derived</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-emerald-900/15 border border-emerald-700/30 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm text-emerald-300 font-medium">No anomalies detected by derived analysis</div>
          </div>
        )}
      </div>

      {/* Database AI Insights */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">AI-Generated Security Insights</div>
        {aiInsights.length > 0 ? (
          <div className="space-y-3">
            {aiInsights.slice(0, 12).map(insight => {
              const sev = SEV_CONFIG[insight.severity] ?? SEV_CONFIG.info;
              const typeConfig = INSIGHT_TYPE_CONFIG[insight.insight_type] ?? { icon: Brain, color: 'text-blue-400' };
              const InsightIcon = typeConfig.icon;
              const casino = casinos.find(c => c.id === insight.casino_id);
              return (
                <div key={insight.id} className={cn(
                  'p-4 rounded-xl border transition-colors',
                  insight.is_acknowledged
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                    : insight.severity === 'critical' ? 'bg-red-900/10 border-red-700/40'
                    : insight.severity === 'high' ? 'bg-orange-900/10 border-orange-700/40'
                    : 'bg-slate-800/40 border-slate-700/40'
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', 'bg-slate-800')}>
                      <InsightIcon className={cn('h-4 w-4', typeConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-slate-200">{insight.title}</span>
                        <Badge variant="outline" className={cn('text-xs capitalize', sev.badge)}>{insight.severity}</Badge>
                        {insight.is_acknowledged && (
                          <Badge className="bg-slate-800 text-slate-500 border-slate-700 text-xs">Acknowledged</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{insight.description}</p>
                      {insight.affected_entity && (
                        <div className="mt-1.5 text-xs text-slate-500">
                          <span className="text-slate-600">Affected: </span>
                          <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{insight.affected_entity}</code>
                        </div>
                      )}
                      {insight.recommended_action && !insight.is_acknowledged && (
                        <div className="mt-2 p-2 rounded bg-slate-800/60 border border-slate-700/40">
                          <span className="text-xs text-slate-500 font-medium">Recommended: </span>
                          <span className="text-xs text-slate-300">{insight.recommended_action}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {insight.confidence_score && (
                        <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-xs">
                          {(insight.confidence_score * 100).toFixed(0)}% confidence
                        </Badge>
                      )}
                      {casino && <span className="text-xs text-slate-600">{casino.name}</span>}
                      <span className="text-xs text-slate-600">{timeAgo(insight.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-slate-600 text-sm py-8">
            <Brain className="h-8 w-8 mx-auto mb-2 text-slate-700" />
            No AI insights available
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Anomaly Detection Modules</div>
          <div className="space-y-2">
            {[
              { name: 'Login Behaviour Analysis', events: events.filter(e => e.event_type === 'failed_auth').length },
              { name: 'API Traffic Pattern Analysis', events: apiAnomalous },
              { name: 'Geographic Anomaly Detection', events: events.filter(e => e.source_country && ['CN','RU','NG'].includes(e.source_country)).length },
              { name: 'Privilege Escalation Monitor', events: events.filter(e => e.event_type === 'role_escalation').length },
              { name: 'Data Exfiltration Detection', events: events.filter(e => e.event_type === 'mass_data_access' || e.event_type === 'data_export').length },
              { name: 'Session Integrity Checking', events: events.filter(e => e.event_type === 'session_hijack').length },
              { name: 'Integration Anomaly Analysis', events: aiInsights.filter(a => a.insight_type === 'integration_anomaly').length },
            ].map(item => (
              <div key={item.name} className="flex items-center justify-between p-2 rounded bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-slate-300">{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-xs">{item.events} events</Badge>
                  <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700 text-xs">Active</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Insights by Type</div>
          <div className="space-y-2.5">
            {Object.entries(
              aiInsights.reduce((acc, a) => {
                acc[a.insight_type] = (acc[a.insight_type] ?? 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const config = INSIGHT_TYPE_CONFIG[type] ?? { icon: Brain, color: 'text-slate-400' };
              const Icon = config.icon;
              return (
                <div key={type} className="flex items-center gap-3">
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', config.color)} />
                  <span className="text-xs text-slate-400 flex-1">{formatEventType(type)}</span>
                  <span className="text-xs text-slate-500 tabular-nums">{count}</span>
                </div>
              );
            })}
            {aiInsights.length === 0 && (
              <div className="text-center text-slate-600 text-sm py-4">No insights data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
