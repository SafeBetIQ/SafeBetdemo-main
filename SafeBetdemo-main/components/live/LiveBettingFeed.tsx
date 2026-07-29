'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Activity, TrendingUp, TrendingDown, TriangleAlert as AlertTriangle,
  Wifi, WifiOff, ArrowDownCircle, ArrowUpCircle, LogIn, ShieldAlert,
  CreditCard, Cpu, LogOut, Star, Ban, Zap, Trophy,
} from 'lucide-react';
import { useCasinoData, LiveEvent } from '@/contexts/CasinoDataContext';
import { formatPlayerId, playerAvatarChars } from '@/lib/playerIdentity';

// ─── Event type display config ────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, {
  label: string;
  className: string;
  Icon: React.ElementType;
  showAmount: boolean;
}> = {
  CARD_INSERT:           { label: 'Auth',           className: 'bg-violet-50 text-violet-700 border-violet-200',  Icon: CreditCard,     showAmount: false },
  MACHINE_ALLOCATED:     { label: 'Machine',        className: 'bg-slate-50 text-slate-700 border-slate-200',     Icon: Cpu,            showAmount: false },
  SESSION_START:         { label: 'Session Start',  className: 'bg-blue-50 text-blue-700 border-blue-200',        Icon: LogIn,          showAmount: false },
  BET_PLACED:            { label: 'Bet',            className: 'bg-brand-50 text-brand-700 border-brand-200',     Icon: Activity,       showAmount: true  },
  JACKPOT:               { label: 'JACKPOT!',       className: 'bg-yellow-100 text-yellow-800 border-yellow-300', Icon: Trophy,         showAmount: true  },
  RISK_ALERT:            { label: 'Risk Alert',     className: 'bg-red-50 text-red-700 border-red-200',           Icon: ShieldAlert,    showAmount: false },
  INTERVENTION_TRIGGERED:{ label: 'Intervention',  className: 'bg-orange-50 text-orange-700 border-orange-200',  Icon: Zap,            showAmount: false },
  CASH_OUT:              { label: 'Cash Out',       className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ArrowUpCircle, showAmount: true  },
  SESSION_END:           { label: 'Session End',    className: 'bg-slate-50 text-slate-600 border-slate-200',     Icon: LogOut,         showAmount: false },
  CARD_REMOVED:          { label: 'Session Close',  className: 'bg-slate-50 text-slate-500 border-slate-200',     Icon: CreditCard,     showAmount: false },
  MACHINE_IDLE:          { label: 'Machine Idle',   className: 'bg-slate-50 text-slate-400 border-slate-100',     Icon: Cpu,            showAmount: false },
  MACHINE_FAULT:         { label: 'Fault',          className: 'bg-amber-50 text-amber-700 border-amber-200',     Icon: AlertTriangle,  showAmount: false },
  VIP_ACTIVITY:          { label: 'VIP',            className: 'bg-yellow-50 text-yellow-700 border-yellow-200',  Icon: Star,           showAmount: true  },
  DEPOSIT:               { label: 'Deposit',        className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ArrowDownCircle, showAmount: true },
  WITHDRAWAL:            { label: 'Withdrawal',     className: 'bg-blue-50 text-blue-700 border-blue-200',        Icon: ArrowUpCircle,  showAmount: true  },
  SELF_EXCLUSION:        { label: 'Self-Excluded',  className: 'bg-red-50 text-red-800 border-red-300',           Icon: Ban,            showAmount: false },
  SECURITY_EVENT:        { label: 'Security',       className: 'bg-red-100 text-red-900 border-red-300',          Icon: ShieldAlert,    showAmount: false },
};

const FALLBACK_CONFIG = EVENT_CONFIG.BET_PLACED;

const RISK_CONFIG = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'High',     className: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium:   { label: 'Medium',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:      { label: 'Low',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  } catch { return '--:--:--'; }
}

const AVATAR_COLORS = [
  'from-brand-500 to-blue-600', 'from-emerald-500 to-brand-600',
  'from-orange-500 to-red-600', 'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-600', 'from-amber-500 to-yellow-600',
];
function avatarColor(playerId: string) {
  const idx = playerId.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// Build the detail line shown below the player ID
function buildDetailLine(event: LiveEvent): string {
  const meta = event.metadata as Record<string, unknown>;
  const parts: string[] = [];

  const game = event.game_type;
  if (game) parts.push(game.charAt(0).toUpperCase() + game.slice(1));
  if (event.machine_id) parts.push(event.machine_id);

  switch (event.event_type) {
    case 'CARD_INSERT':
      if (meta?.is_vip) parts.push('VIP');
      break;
    case 'MACHINE_ALLOCATED':
      if (meta?.casino_floor_location) parts.push(String(meta.casino_floor_location));
      if (meta?.machine_type) parts.push(String(meta.machine_type));
      break;
    case 'SESSION_START':
      if (meta?.initial_balance != null) parts.push(`Balance R${Number(meta.initial_balance).toLocaleString()}`);
      break;
    case 'SESSION_END': {
      const dur = meta?.duration_minutes != null ? `${meta.duration_minutes} min` : null;
      const bets = meta?.total_bets != null ? `${meta.total_bets} bets` : null;
      if (dur) parts.push(dur);
      if (bets) parts.push(bets);
      break;
    }
    case 'CASH_OUT':
      if (meta?.net_result != null) {
        const net = Number(meta.net_result);
        parts.push(net >= 0 ? `Net win R${net.toLocaleString()}` : `Net loss R${Math.abs(net).toLocaleString()}`);
      }
      break;
    case 'RISK_ALERT':
      if (meta?.alert_reason) parts.push(String(meta.alert_reason).replace(/_/g, ' '));
      break;
    case 'INTERVENTION_TRIGGERED':
      if (meta?.channel) parts.push(`via ${meta.channel}`);
      break;
    case 'DEPOSIT':
      if (meta?.deposit_method) parts.push(String(meta.deposit_method));
      break;
    case 'JACKPOT':
      parts.push('JACKPOT WIN');
      break;
    default:
      break;
  }

  parts.push(formatSATime(event.created_at));
  return parts.join(' · ');
}

// Build the right-side amount display
function amountDisplay(event: LiveEvent): { label: string; value: string; className: string } | null {
  const cfg = EVENT_CONFIG[event.event_type];
  if (!cfg?.showAmount) return null;

  switch (event.event_type) {
    case 'BET_PLACED':
    case 'JACKPOT':
      return {
        label: 'Bet',
        value: `R ${event.bet_amount.toLocaleString()}`,
        className: 'text-foreground',
      };
    case 'DEPOSIT':
      return { label: 'Deposited', value: `R ${event.bet_amount.toLocaleString()}`, className: 'text-emerald-600' };
    case 'WITHDRAWAL':
      return { label: 'Withdrew', value: `R ${event.bet_amount.toLocaleString()}`, className: 'text-blue-600' };
    case 'CASH_OUT': {
      const meta = event.metadata as Record<string, unknown>;
      const amt = meta?.cashout_amount != null ? Number(meta.cashout_amount) : event.bet_amount;
      return { label: 'Cashed out', value: `R ${amt.toLocaleString()}`, className: 'text-emerald-600' };
    }
    case 'VIP_ACTIVITY':
      return { label: 'Bet', value: `R ${event.bet_amount.toLocaleString()}`, className: 'text-yellow-700' };
    default:
      return null;
  }
}

// ─── Row component ────────────────────────────────────────────────────────────

interface BetRowProps { event: LiveEvent; isNew: boolean }

function EventRow({ event, isNew }: BetRowProps) {
  const level = riskLevel(event.risk_score);
  const riskCfg = RISK_CONFIG[level];
  const pidLabel = formatPlayerId(event.player_id);
  const isWin = event.outcome === 'win';
  const isLoss = event.outcome === 'loss';
  const flags = event.risk_flags || [];
  const evCfg = EVENT_CONFIG[event.event_type] ?? FALLBACK_CONFIG;
  const EvIcon = evCfg.Icon;
  const amt = amountDisplay(event);
  const detailLine = buildDetailLine(event);
  const isJackpot = event.event_type === 'JACKPOT';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-all duration-300 ${
        isNew
          ? isJackpot
            ? 'bg-yellow-50 ring-1 ring-yellow-300 animate-pulse-once'
            : 'bg-primary/5 animate-pulse-once'
          : 'hover:bg-muted/30'
      }`}
    >
      {/* Anonymous player avatar — derived from SafeBet IQ Player ID */}
      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(event.player_id)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
        {playerAvatarChars(event.player_id)}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* SafeBet IQ Player ID — the ONLY player identifier */}
          <span className="font-mono text-xs font-semibold text-foreground tracking-wide truncate">
            {pidLabel}
          </span>

          {/* Event type badge */}
          <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium ${evCfg.className}`}>
            <EvIcon className="h-2.5 w-2.5" />
            {evCfg.label}
          </span>

          {/* Risk flags */}
          {flags.includes('loss_chasing') && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Loss Chasing</span>
          )}
          {flags.includes('excessive_time') && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Time Alert</span>
          )}
          {flags.includes('bet_escalation') && (
            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">Escalation</span>
          )}
          {flags.includes('ai_flagged') && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">AI Flagged</span>
          )}
          {flags.includes('large_deposit') && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Large Deposit</span>
          )}
        </div>

        <div className="mt-0.5 text-xs text-muted-foreground truncate">{detailLine}</div>
      </div>

      {/* Amount display (primary) */}
      {amt && (
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-muted-foreground">{amt.label}</div>
          <div className={`font-bold text-sm ${amt.className}`}>{amt.value}</div>
        </div>
      )}

      {/* Win / loss outcome for bets */}
      {(event.event_type === 'BET_PLACED' || event.event_type === 'JACKPOT') && (isWin || isLoss) && (
        <div className="text-right flex-shrink-0 min-w-[72px]">
          <div className="text-xs text-muted-foreground">{isWin ? 'Won' : 'Lost'}</div>
          <div className={`font-bold text-sm flex items-center justify-end gap-0.5 ${isWin ? 'text-emerald-600' : 'text-red-500'}`}>
            {isWin
              ? <><TrendingUp className="h-3 w-3" /> R {event.win_amount.toLocaleString()}</>
              : <><TrendingDown className="h-3 w-3" /> R {event.bet_amount.toLocaleString()}</>
            }
          </div>
        </div>
      )}

      {/* Risk score badge (only when meaningful) */}
      {event.risk_score > 0 && !['CARD_INSERT', 'MACHINE_ALLOCATED', 'MACHINE_IDLE', 'CARD_REMOVED', 'SESSION_START'].includes(event.event_type) && (
        <div className="flex-shrink-0 text-right">
          <Badge className={`text-[10px] px-2 py-0.5 border font-semibold ${riskCfg.className}`}>
            {event.risk_score}
          </Badge>
          {level === 'critical' && <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 mx-auto" />}
        </div>
      )}
    </div>
  );
}

// ─── Feed component ───────────────────────────────────────────────────────────

export function LiveBettingFeed() {
  const { data } = useCasinoData();
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevCountRef = useRef(0);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const tick = () => setCurrentTime(
      new Date().toLocaleTimeString('en-ZA', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'Africa/Johannesburg',
      })
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const events = data.liveEvents;
    if (events.length > prevCountRef.current) {
      const freshIds = new Set(
        events.slice(0, events.length - prevCountRef.current).map(e => e.id)
      );
      setNewIds(freshIds);
      setTimeout(() => setNewIds(new Set()), 1800);
    }
    prevCountRef.current = events.length;
  }, [data.liveEvents]);

  const events = data.liveEvents.slice(0, 50);
  const criticalCount = events.filter(e => e.risk_score >= 80).length;
  const jackpotCount = events.filter(e => e.event_type === 'JACKPOT').length;
  const interventionCount = events.filter(e => e.event_type === 'INTERVENTION_TRIGGERED').length;
  const activeSessions = events.filter(e => e.event_type === 'SESSION_START').length;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
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
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {jackpotCount > 0 && (
            <Badge className="bg-yellow-500 text-white border-0 text-xs animate-pulse">
              🏆 {jackpotCount} Jackpot{jackpotCount > 1 ? 's' : ''}
            </Badge>
          )}
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-xs animate-pulse">
              {criticalCount} Critical
            </Badge>
          )}
          {interventionCount > 0 && (
            <Badge className="bg-orange-500 text-white border-0 text-xs">
              {interventionCount} Interventions
            </Badge>
          )}
          {activeSessions > 0 && (
            <Badge className="bg-blue-500 text-white border-0 text-xs">
              {activeSessions} Started
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

      {/* Event stream */}
      <div className="overflow-y-auto flex-1">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <span>Waiting for events…</span>
          </div>
        ) : (
          events.map(event => (
            <EventRow key={event.id} event={event} isNew={newIds.has(event.id)} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <span>{data.kpi.events_per_min} events/min · {data.interventions.length} interventions triggered</span>
        <span>{events.length} shown · {data.liveEvents.length} total</span>
      </div>
    </div>
  );
}
