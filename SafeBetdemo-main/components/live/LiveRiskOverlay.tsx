'use client';

import { useMemo } from 'react';
import { TriangleAlert as AlertTriangle, Clock, TrendingUp, Zap, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCasinoData } from '@/contexts/CasinoDataContext';
import { formatPlayerId } from '@/lib/playerIdentity';

const FLAG_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  loss_chasing:    { label: 'Loss Chasing',    icon: TrendingUp,    color: 'text-red-600 bg-red-50 border-red-200' },
  excessive_time:  { label: 'Excessive Time',  icon: Clock,         color: 'text-amber-700 bg-amber-50 border-amber-200' },
  bet_escalation:  { label: 'Bet Escalation',  icon: Zap,           color: 'text-orange-600 bg-orange-50 border-orange-200' },
  continuous_play: { label: 'Continuous Play', icon: Clock,         color: 'text-amber-700 bg-amber-50 border-amber-200' },
  rapid_high_stakes: { label: 'Rapid High Stakes', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
};

interface AlertRow {
  playerId: string;
  playerName: string;
  riskScore: number;
  flags: string[];
  game: string;
  betAmount: number;
  timestamp: string;
}

function AlertCard({ alert }: { alert: AlertRow }) {
  const timeAgo = () => {
    const secs = Math.round((Date.now() - new Date(alert.timestamp).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    return `${Math.round(secs / 60)}m ago`;
  };

  return (
    <div className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${alert.riskScore >= 80 ? 'border-red-200 bg-red-50/40' : 'border-orange-200 bg-orange-50/30'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${alert.riskScore >= 80 ? 'text-red-600' : 'text-orange-500'}`} />
          <span className="font-semibold text-sm text-foreground truncate">{alert.playerName}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${alert.riskScore >= 80 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
            {alert.riskScore}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo()}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {alert.flags.slice(0, 3).map(flag => {
          const cfg = FLAG_CONFIG[flag];
          if (!cfg) return null;
          const Icon = cfg.icon;
          return (
            <span key={flag} className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${cfg.color}`}>
              <Icon className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{alert.game}</span>
        <span>·</span>
        <span>R {alert.betAmount.toLocaleString()} bet</span>
      </div>
    </div>
  );
}

export function LiveRiskOverlay() {
  const { data } = useCasinoData();
  const { liveEvents, kpi } = data;

  const alerts = useMemo<AlertRow[]>(() => {
    const seen = new Set<string>();
    return liveEvents
      .filter(e => (e.risk_flags?.length > 0 || e.risk_score >= 60))
      .reduce<AlertRow[]>((acc, e) => {
        if (seen.has(e.player_id)) return acc;
        seen.add(e.player_id);
        acc.push({
          playerId: e.player_id,
          playerName: formatPlayerId(e.player_id),
          riskScore: e.risk_score,
          flags: e.risk_flags || [],
          game: e.game_type || 'Unknown',
          betAmount: e.bet_amount,
          timestamp: e.created_at,
        });
        return acc;
      }, [])
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 20);
  }, [liveEvents]);

  const critical = alerts.filter(a => a.riskScore >= 80);
  const high = alerts.filter(a => a.riskScore >= 60 && a.riskScore < 80);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${critical.length > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
            <Shield className={`h-4 w-4 ${critical.length > 0 ? 'text-red-600' : 'text-slate-500'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Risk Alerts</h3>
            <p className="text-xs text-muted-foreground">Live responsible gambling overlay</p>
          </div>
        </div>
        {critical.length > 0 && (
          <Badge className="bg-red-600 text-white border-0 text-xs animate-pulse">
            {critical.length} Critical
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-px bg-border">
        {[
          { label: 'Critical', value: kpi.risk_critical, color: 'text-red-600' },
          { label: 'High',     value: kpi.risk_high,     color: 'text-orange-500' },
          { label: 'Medium',   value: kpi.risk_medium,   color: 'text-yellow-600' },
          { label: 'Low',      value: kpi.risk_low,      color: 'text-emerald-600' },
        ].map(item => (
          <div key={item.label} className="bg-card px-2 py-3 text-center">
            <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
            <div className="text-[10px] text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <Shield className="h-8 w-8 opacity-30" />
            <span>No active risk alerts</span>
          </div>
        ) : (
          alerts.map(alert => (
            <AlertCard key={alert.playerId} alert={alert} />
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between">
        <span>Monitoring {kpi.active_players} observed players</span>
        <span>{alerts.length} flagged</span>
      </div>
    </div>
  );
}
