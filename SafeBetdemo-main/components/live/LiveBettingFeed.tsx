'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Activity, TrendingUp, TrendingDown,
  TriangleAlert as AlertTriangle, Wifi, WifiOff,
  ArrowDownCircle, ArrowUpCircle, LogIn, ShieldAlert,
} from 'lucide-react';
import { useCasinoData, LiveEvent } from '@/contexts/CasinoDataContext';

const RISK_CONFIG = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'High',     className: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium:   { label: 'Medium',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:      { label: 'Low',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
  BET_PLACED:    { label: 'Bet',        className: 'bg-brand-50 text-brand-700 border-brand-200', Icon: Activity },
  DEPOSIT:       { label: 'Deposit',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ArrowDownCircle },
  WITHDRAWAL:    { label: 'Withdrawal', className: 'bg-blue-50 text-blue-700 border-blue-200', Icon: ArrowUpCircle },
  SESSION_START: { label: 'Session',    className: 'bg-violet-50 text-violet-700 border-violet-200', Icon: LogIn },
  RISK_ALERT:    { label: 'Risk Alert', className: 'bg-red-50 text-red-700 border-red-200', Icon: ShieldAlert },
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
  'from-brand-500 to-blue-600',
  'from-emerald-500 to-brand-600',
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

function amountLabel(event: LiveEvent): { label: string; value: string; className: string } {
  const type = event.event_type;
  if (type === 'DEPOSIT') {
    return { label: 'Deposited', value: `R ${event.bet_amount.toLocaleString()}`, className: 'text-emerald-600' };
  }
  if (type === 'WITHDRAWAL') {
    return { label: 'Withdrew', value: `R ${event.bet_amount.toLocaleString()}`, className: 'text-blue-600' };
  }
  if (type === 'SESSION_START') {
    const bal = event.balance_after;
    return { label: 'Balance', value: bal != null ? `R ${bal.toLocaleString()}` : '—', className: 'text-muted-foreground' };
  }
  if (type === 'RISK_ALERT') {
    return { label: 'Session', value: `${Math.round(event.duration_seconds / 60)}m`, className: 'text-red-600' };
  }
  return { label: 'Bet', value: `R ${event.bet_amount.toLocaleString()}`, className: 'text-foreground' };
}

interface BetRowProps {
  event: LiveEvent;
  isNew: boolean;
}

function BetRow({ event, isNew }: BetRowProps) {
  const level = riskLevel(event.risk_score);
  const riskCfg = RISK_CONFIG[level];
  const name = playerName(event);
  const isWin = event.outcome === 'win';
  const isActive = event.outcome === 'active' || event.outcome === null;
  const flags = event.risk_flags || [];
  const evCfg = EVENT_TYPE_CONFIG[event.event_type] ?? EVENT_TYPE_CONFIG.BET_PLACED;
  const EvIcon = evCfg.Icon;
  const amt = amountLabel(event);

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
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{name}</span>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
            {event.player_id.slice(-6)}
          </span>
          {/* Event type badge */}
          <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium ${evCfg.className}`}>
            <EvIcon className="h-2.5 w-2.5" />
            {evCfg.label}
          </span>
          {flags.includes('loss_chasing') && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Loss Chasing</span>
          )}
          {flags.includes('excessive_time') && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Time Alert</span>
          )}
          {flags.includes('ai_flagged') && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">AI Flagged</span>
          )}
          {flags.includes('large_deposit') && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Large Deposit</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span>{event.game_type ? event.game_type.charAt(0).toUpperCase() + event.game_type.slice(1) : 'Slots'}</span>
          {event.machine_id && <span>· {event.machine_id}</span>}
          <span>· {formatSATime(event.created_at)}</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-xs text-muted-foreground">{amt.label}</div>
        <div className={`font-bold text-sm ${amt.className}`}>{amt.value}</div>
      </div>

      {event.event_type === 'BET_PLACED' && !isActive && (
        <div className="text-right flex-shrink-0 min-w-[72px]">
          <div className="text-xs text-muted-foreground">{isWin ? 'Won' : 'Lost'}</div>
          <div className={`font-bold text-sm flex items-center justify-end gap-0.5 ${isWin ? 'text-emerald-600' : 'text-red-500'}`}>
            {isWin ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isWin ? `R ${event.win_amount.toLocaleString()}` : `-R ${event.bet_amount.toLocaleString()}`}
          </div>
        </div>
      )}

      <div className="flex-shrink-0 text-right">
        {event.risk_score > 0 && (
          <Badge className={`text-[10px] px-2 py-0.5 border font-semibold ${riskCfg.className}`}>
            {event.risk_score}
          </Badge>
        )}
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

  const events = data.liveEvents.slice(0, 40);
  const criticalCount = events.filter(e => e.risk_score >= 80).length;
  const depositCount = events.filter(e => e.event_type === 'DEPOSIT').length;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Live Casino Feed</h3>
            <p className="text-xs text-muted-foreground">SAST {currentTime}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-xs animate-pulse">
              {criticalCount} Critical
            </Badge>
          )}
          {depositCount > 0 && (
            <Badge className="bg-emerald-600 text-white border-0 text-xs">
              {depositCount} Deposits
            </Badge>
          )}
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
        <span>{data.kpi.events_per_min} events/min · {data.interventions.length} interventions</span>
        <span>{events.length} shown · {data.liveEvents.length} total</span>
      </div>
    </div>
  );
}
