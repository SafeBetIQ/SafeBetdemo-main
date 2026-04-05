'use client';

import { Bell, CheckCircle, Clock, XCircle, AlertTriangle, Info, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCasinoData, LiveAlert } from '@/contexts/CasinoDataContext';

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  break_suggestion:    { label: 'Take a Break',    badge: 'bg-amber-100 text-amber-700 border-amber-200',   icon: Clock },
  contact_support:     { label: 'Support Contact', badge: 'bg-red-100 text-red-700 border-red-200',         icon: AlertTriangle },
  session_limit:       { label: 'Session Limit',   badge: 'bg-orange-100 text-orange-700 border-orange-200',icon: Clock },
  cooling_off:         { label: 'Cooling Off',     badge: 'bg-orange-100 text-orange-700 border-orange-200',icon: Clock },
  self_exclusion:      { label: 'Self Exclusion',  badge: 'bg-red-100 text-red-700 border-red-200',         icon: XCircle },
  self_exclusion_referral: { label: 'Exclusion Ref', badge: 'bg-red-100 text-red-700 border-red-200',       icon: XCircle },
  helpline_referral:   { label: 'Helpline',        badge: 'bg-blue-100 text-blue-700 border-blue-200',      icon: MessageSquare },
  counseling_referral: { label: 'Counseling',      badge: 'bg-blue-100 text-blue-700 border-blue-200',      icon: MessageSquare },
  educational_content: { label: 'Education',       badge: 'bg-blue-100 text-blue-700 border-blue-200',      icon: MessageSquare },
  ai_alert:            { label: 'AI Alert',        badge: 'bg-violet-100 text-violet-700 border-violet-200',icon: AlertTriangle },
  manual_review:       { label: 'Manual Review',   badge: 'bg-slate-100 text-slate-700 border-slate-200',   icon: CheckCircle },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: 'text-amber-600' },
  dispatched: { label: 'Sent',       color: 'text-emerald-600' },
  failed:     { label: 'Failed',     color: 'text-red-500' },
  partial:    { label: 'Partial',    color: 'text-orange-500' },
};

function typeCfg(type: string) {
  return TYPE_CONFIG[type] ?? { label: type.replace(/_/g, ' '), badge: 'bg-muted text-muted-foreground border-border', icon: Bell };
}

function timeAgo(iso: string) {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

function riskColor(score: number) {
  if (score >= 80) return 'bg-red-600 text-white';
  if (score >= 60) return 'bg-orange-500 text-white';
  if (score >= 30) return 'bg-yellow-500 text-white';
  return 'bg-muted text-muted-foreground';
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: LiveAlert }) {
  const cfg    = typeCfg(alert.intervention_type);
  const TypeIcon = cfg.icon;
  const statusCfg = STATUS_CONFIG[alert.dispatch_status] ?? STATUS_CONFIG.pending;
  const isCritical = alert.risk_score_at_trigger >= 80;

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-border/50 hover:bg-muted/20 transition-colors ${isCritical ? 'bg-red-50/30' : ''}`}>
      {/* Type icon */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isCritical ? 'bg-red-100' : 'bg-muted'}`}>
        <TypeIcon className={`h-3.5 w-3.5 ${isCritical ? 'text-red-600' : 'text-muted-foreground'}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${riskColor(alert.risk_score_at_trigger)}`}>
            Score {alert.risk_score_at_trigger}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{alert.trigger_reason}</p>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          {alert.delivery_method && <span className="text-muted-foreground">· {alert.delivery_method}</span>}
          <span className="text-muted-foreground ml-auto">{timeAgo(alert.triggered_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function LiveAlertsPanel() {
  const { data } = useCasinoData();
  const { liveAlerts } = data;

  const critical = liveAlerts.filter(a => a.risk_score_at_trigger >= 80).length;
  const pending  = liveAlerts.filter(a => a.dispatch_status === 'pending').length;

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${critical > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
              <Bell className={`h-4 w-4 ${critical > 0 ? 'text-red-600 animate-pulse' : 'text-amber-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Intervention Alerts</h3>
              <p className="text-xs text-muted-foreground">AI-triggered · real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pending > 0 && (
              <Badge className="bg-amber-500 text-white border-0 text-xs">
                {pending} Pending
              </Badge>
            )}
            {critical > 0 && (
              <Badge className="bg-red-600 text-white border-0 text-xs animate-pulse">
                {critical} Critical
              </Badge>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Real-time feed of interventions inserted into intervention_history by the AI risk engine. Triggers automatically when a player's composite risk score reaches 70+ (break suggestion) or 80+ (support contact). Delivery status updates as channels are dispatched.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-px bg-border flex-shrink-0">
          {[
            { label: 'Total',    value: liveAlerts.length,                             color: 'text-foreground' },
            { label: 'Pending',  value: pending,                                        color: pending > 0 ? 'text-amber-600' : 'text-muted-foreground' },
            { label: 'Critical', value: critical,                                       color: critical > 0 ? 'text-red-600' : 'text-muted-foreground' },
          ].map(item => (
            <div key={item.label} className="bg-card px-2 py-2 text-center">
              <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
              <div className="text-[9px] text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto">
          {liveAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <Bell className="h-8 w-8 opacity-30" />
              <span>No interventions triggered yet</span>
              <span className="text-xs opacity-60">Fires at risk score ≥ 70</span>
            </div>
          ) : (
            liveAlerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between flex-shrink-0">
          <span>Score ≥70 → break · ≥80 → support</span>
          <span>{liveAlerts.length} total</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
