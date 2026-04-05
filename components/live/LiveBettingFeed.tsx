'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, TriangleAlert as AlertTriangle, Wifi, WifiOff, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCasinoData, LiveEvent } from '@/contexts/CasinoDataContext';

const RISK_CONFIG = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

function riskLevel(score: number) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function formatSATime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('en-ZA', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Africa/Johannesburg',
    });
  } catch {
    return '--:--:--';
  }
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

function avatarColor(playerId: string) {
  const idx = playerId.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function playerName(event: LiveEvent): string {
  const meta = event.metadata as Record<string, unknown>;
  if (typeof meta?.player_name === 'string') return meta.player_name;
  return `Player ${event.player_id.slice(-4)}`;
}

interface BetRowProps {
  event: LiveEvent;
  isNew: boolean;
}

function BetRow({ event, isNew }: BetRowProps) {
  const level = riskLevel(event.risk_score);
  const cfg = RISK_CONFIG[level];
  const name = playerName(event);
  const isWin = event.outcome === 'win';
  const isActive = event.outcome === 'active' || event.outcome === null;
  const flags = event.risk_flags || [];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-all duration-300 ${
        isNew ? 'bg-primary/5 animate-pulse-once' : 'hover:bg-muted/30'
      }`}
    >
      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(event.player_id)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
        {getInitials(name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{name}</span>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
            {event.player_id.slice(-6)}
          </span>
          {flags.includes('loss_chasing') && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Loss Chasing</span>
          )}
          {flags.includes('excessive_time') && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Time Alert</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span>{event.game_type || 'Slots'}</span>
          {event.machine_id && <span>· {event.machine_id}</span>}
          <span>· {formatSATime(event.created_at)}</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-xs text-muted-foreground">Bet</div>
        <div className="font-bold text-sm">R {event.bet_amount.toLocaleString()}</div>
      </div>

      {!isActive && (
        <div className="text-right flex-shrink-0 min-w-[80px]">
          <div className="text-xs text-muted-foreground">{isWin ? 'Won' : 'Lost'}</div>
          <div className={`font-bold text-sm flex items-center justify-end gap-0.5 ${isWin ? 'text-emerald-600' : 'text-red-500'}`}>
            {isWin ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isWin ? `R ${event.win_amount.toLocaleString()}` : `-R ${event.bet_amount.toLocaleString()}`}
          </div>
        </div>
      )}

      <div className="flex-shrink-0">
        <Badge className={`text-[10px] px-2 py-0.5 border font-semibold ${cfg.className}`}>
          {event.risk_score}
        </Badge>
        {level === 'critical' && <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 mx-auto" />}
      </div>
    </div>
  );
}

export function LiveBettingFeed() {
  const { data } = useCasinoData();
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevCountRef = useRef(0);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const tick = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-ZA', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'Africa/Johannesburg',
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const events = data.liveEvents;
    if (events.length > prevCountRef.current) {
      const freshIds = new Set(events.slice(0, events.length - prevCountRef.current).map(e => e.id));
      setNewIds(freshIds);
      setTimeout(() => setNewIds(new Set()), 1500);
    }
    prevCountRef.current = events.length;
  }, [data.liveEvents]);

  const events = data.liveEvents.slice(0, 30);
  const criticalCount = events.filter(e => e.risk_score >= 80).length;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Live Betting Feed</h3>
            <p className="text-xs text-muted-foreground">SAST {currentTime}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-xs animate-pulse">
              {criticalCount} Critical
            </Badge>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Real-time stream of all betting events from active players. Each row shows the player, game, bet amount, outcome, and live risk score. Critical risk scores (≥ 80) indicate responsible gambling flags that require immediate intervention.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex items-center gap-1.5 text-xs">
            {data.realtimeConnected ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 font-medium">LIVE</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Connecting…</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <span>Waiting for events…</span>
          </div>
        ) : (
          events.map(event => (
            <BetRow key={event.id} event={event} isNew={newIds.has(event.id)} />
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <span>{data.kpi.events_per_min} events/min</span>
        <span>{events.length} shown · {data.liveEvents.length} total</span>
      </div>
    </div>
  );
}
