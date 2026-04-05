'use client';

import { useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, TriangleAlert as AlertTriangle, Info, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCasinoData, ActivePlayer } from '@/contexts/CasinoDataContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  critical: { label: 'Critical', badge: 'bg-red-600 text-white',      bar: 'bg-red-500',    card: 'border-red-200 bg-red-50/30' },
  high:     { label: 'High',     badge: 'bg-orange-500 text-white',   bar: 'bg-orange-400', card: 'border-orange-200 bg-orange-50/20' },
  moderate: { label: 'Moderate', badge: 'bg-yellow-500 text-white',   bar: 'bg-yellow-400', card: 'border-yellow-200 bg-yellow-50/20' },
  low:      { label: 'Low',      badge: 'bg-emerald-600 text-white',  bar: 'bg-emerald-400',card: 'border-border bg-transparent' },
} as const;

function levelCfg(level: string) {
  return LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.low;
}

const FACTORS: { key: keyof ActivePlayer; label: string; color: string }[] = [
  { key: 'loss_escalation_score',   label: 'Loss Chase',    color: 'bg-red-400' },
  { key: 'bet_intensity_score',     label: 'Rapid Betting', color: 'bg-orange-400' },
  { key: 'session_duration_score',  label: 'Session Time',  color: 'bg-amber-400' },
  { key: 'deposit_frequency_score', label: 'Deposit Spike', color: 'bg-purple-400' },
  { key: 'cross_operator_score',    label: 'Cross-Op',      color: 'bg-blue-400' },
];

function timeAgo(iso: string | null) {
  if (!iso) return 'pending';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-yellow-600',
];

function avatarColor(id: string) {
  const idx = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Single player card ────────────────────────────────────────────────────────

function PlayerCard({ player }: { player: ActivePlayer }) {
  const cfg   = levelCfg(player.risk_level);
  const delta = player.score_delta;
  const name  = player.display_name;

  return (
    <div className={`rounded-lg border px-3 py-2.5 space-y-2 transition-all duration-200 ${cfg.card}`}>
      {/* Row 1: avatar + name + score + delta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(player.player_id)} flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}>
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs text-foreground truncate">{name}</div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {player.player_id.slice(-6)} · {timeAgo(player.analyzed_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {delta > 2  && <TrendingUp   className="h-3 w-3 text-red-500" />}
          {delta < -2 && <TrendingDown  className="h-3 w-3 text-emerald-500" />}
          {Math.abs(delta) <= 2 && <Minus className="h-3 w-3 text-muted-foreground" />}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {player.risk_score}
          </span>
          {player.intervention_triggered && (
            <AlertTriangle className="h-3 w-3 text-red-500" />
          )}
        </div>
      </div>

      {/* Row 2: factor micro-bars (only if player has a profile) */}
      {player.has_risk_profile && (
        <div className="space-y-0.5">
          {FACTORS.map(f => {
            const val = Number(player[f.key]) || 0;
            if (val === 0) return null;
            return (
              <div key={f.key} className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground w-16 flex-shrink-0 truncate">{f.label}</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${f.color}`}
                    style={{ width: `${Math.min(val, 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground w-5 text-right">{val}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Row 3: rationale or pending notice */}
      {player.risk_rationale && (
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{player.risk_rationale}</p>
      )}
      {!player.has_risk_profile && (
        <p className="text-[10px] text-muted-foreground/60 italic">Awaiting AI scoring…</p>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function LiveRiskEnginePanel() {
  const { data } = useCasinoData();
  // Single source of truth — same dataset as BRIE page
  const activePlayers = data.activePlayers;

  const critical      = useMemo(() => activePlayers.filter(p => p.risk_level === 'critical').length, [activePlayers]);
  const highRisk      = useMemo(() => activePlayers.filter(p => p.risk_level === 'critical' || p.risk_level === 'high').length, [activePlayers]);
  const avgScore      = useMemo(() => activePlayers.length > 0
    ? Math.round(activePlayers.reduce((s, p) => s + p.risk_score, 0) / activePlayers.length)
    : 0, [activePlayers]);
  const interventions = useMemo(() => activePlayers.filter(p => p.intervention_triggered).length, [activePlayers]);

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${critical > 0 ? 'bg-red-100' : 'bg-violet-100'}`}>
              <Brain className={`h-4 w-4 ${critical > 0 ? 'text-red-600' : 'text-violet-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Risk Engine</h3>
              <p className="text-xs text-muted-foreground">Active players · last 10 min</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <p>Players with events in the last 10 minutes, joined with their latest AI risk profile. This is the same dataset shown in the Behavioral Risk Intelligence Engine — one brain, one dataset, multiple views.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-px bg-border flex-shrink-0">
          {[
            { label: 'Active Now', value: activePlayers.length, color: 'text-foreground' },
            { label: 'High Risk',  value: highRisk,             color: highRisk > 0 ? 'text-red-600' : 'text-muted-foreground' },
            { label: 'Avg Score',  value: avgScore,             color: avgScore >= 60 ? 'text-orange-500' : 'text-foreground' },
            { label: 'Triggered',  value: interventions,        color: interventions > 0 ? 'text-red-600' : 'text-muted-foreground' },
          ].map(item => (
            <div key={item.label} className="bg-card px-2 py-2 text-center">
              <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
              <div className="text-[9px] text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activePlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <Brain className="h-8 w-8 opacity-30" />
              <span>No active players in last 10 min</span>
              <span className="text-xs opacity-60">Fires on every BET_PLACED event</span>
            </div>
          ) : (
            activePlayers.slice(0, 25).map(player => (
              <PlayerCard key={player.player_id} player={player} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between flex-shrink-0">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />AI-scored via DB trigger</span>
          <span>{activePlayers.length} active · {activePlayers.filter(p => p.has_risk_profile).length} profiled</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
