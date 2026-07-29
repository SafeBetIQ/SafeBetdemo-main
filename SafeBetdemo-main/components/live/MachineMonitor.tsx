'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, TriangleAlert as AlertTriangle, LayoutGrid, List, ShieldCheck } from 'lucide-react';
import { useCasinoData, MachineStatus } from '@/contexts/CasinoDataContext';
import { formatPlayerId } from '@/lib/playerIdentity';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MachineStatus['status'], { dot: string; label: string; row: string }> = {
  active:      { dot: 'bg-emerald-500', label: 'Active',  row: 'border-emerald-200/60 bg-emerald-50/30' },
  idle:        { dot: 'bg-slate-300',   label: 'Idle',    row: 'border-border/30 bg-transparent' },
  offline:     { dot: 'bg-red-400',     label: 'Offline', row: 'border-red-200/40 bg-red-50/20' },
  maintenance: { dot: 'bg-amber-500',   label: 'Maint.',  row: 'border-amber-200/40 bg-amber-50/20' },
};

const MACHINE_TYPE_LABEL: Record<string, string> = {
  slot: 'Slot', table: 'Table', rng: 'RNG', live_dealer: 'Live',
};

function riskColor(score: number) {
  if (score >= 80) return 'text-red-600 bg-red-100';
  if (score >= 60) return 'text-orange-600 bg-orange-100';
  if (score >= 40) return 'text-yellow-700 bg-yellow-100';
  return 'text-emerald-700 bg-emerald-100';
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Grid cell (compact view) ────────────────────────────────────────────────

function MachineCell({ machine }: { machine: MachineStatus }) {
  const cfg = STATUS_CONFIG[machine.status] ?? STATUS_CONFIG.idle;
  const isActive = machine.status === 'active';
  const isHighRisk = machine.current_risk_score >= 60;

  return (
    <div className={`rounded-lg border px-3 py-2.5 flex flex-col gap-1.5 transition-all duration-300 ${cfg.row} ${isHighRisk && isActive ? 'ring-1 ring-red-300' : ''}`}>
      {/* Machine ID + type */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${isActive ? 'animate-pulse' : ''}`} />
          <span className="font-mono text-xs font-bold text-foreground">{machine.machine_id}</span>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
          isActive ? 'bg-emerald-100 text-emerald-700' :
          machine.status === 'offline' ? 'bg-red-100 text-red-600' :
          'bg-muted text-muted-foreground'
        }`}>
          {MACHINE_TYPE_LABEL[machine.machine_type] || machine.machine_type}
        </span>
      </div>

      {/* Active session details — SafeBet IQ Player ID only, no PII */}
      {isActive && (
        <>
          {machine.current_player_id && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-primary truncate">
              <ShieldCheck className="h-2.5 w-2.5 flex-shrink-0 text-emerald-600" />
              <span className="truncate">{formatPlayerId(machine.current_player_id)}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="h-2.5 w-2.5" />
            <span>{machine.spins_per_minute.toFixed(1)} spm</span>
            {machine.session_duration_seconds > 0 && (
              <>
                <span>·</span>
                <span>{formatDuration(machine.session_duration_seconds)}</span>
              </>
            )}
          </div>
          {machine.current_risk_score > 0 && (
            <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 w-fit ${riskColor(machine.current_risk_score)}`}>
              {machine.current_risk_score >= 60 && <AlertTriangle className="h-2.5 w-2.5" />}
              Risk {machine.current_risk_score}
            </div>
          )}
          {machine.total_wagered_session > 0 && (
            <div className="text-[10px] text-muted-foreground">
              R {machine.total_wagered_session.toLocaleString(undefined, { maximumFractionDigits: 0 })} wagered
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── List row (detailed view) ────────────────────────────────────────────────

function MachineRow({ machine }: { machine: MachineStatus }) {
  const cfg = STATUS_CONFIG[machine.status] ?? STATUS_CONFIG.idle;
  const isActive = machine.status === 'active';
  const isHighRisk = machine.current_risk_score >= 60;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/40 transition-colors ${isHighRisk && isActive ? 'bg-red-50/30' : isActive ? 'bg-emerald-50/20' : ''}`}>
      {/* Status dot + ID */}
      <div className="flex items-center gap-2 w-24 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${cfg.dot} ${isActive ? 'animate-pulse' : ''}`} />
        <span className="font-mono text-xs font-bold">{machine.machine_id}</span>
      </div>

      {/* Type */}
      <span className="text-xs text-muted-foreground w-12 flex-shrink-0">
        {MACHINE_TYPE_LABEL[machine.machine_type] || machine.machine_type}
      </span>

      {/* SafeBet IQ Player ID — anonymous identifier only */}
      <div className="flex-1 min-w-0">
        {isActive && machine.current_player_id ? (
          <div className="flex items-center gap-1 text-xs font-mono text-primary truncate">
            <ShieldCheck className="h-3 w-3 flex-shrink-0 text-emerald-600" />
            <span className="truncate">{formatPlayerId(machine.current_player_id)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{cfg.label}</span>
        )}
      </div>

      {/* Current game */}
      <div className="w-20 flex-shrink-0 text-xs text-muted-foreground truncate">
        {machine.current_game ? machine.current_game.charAt(0).toUpperCase() + machine.current_game.slice(1) : '—'}
      </div>

      {/* Session duration */}
      <div className="w-14 flex-shrink-0 text-xs text-muted-foreground text-right">
        {machine.session_duration_seconds > 0 ? formatDuration(machine.session_duration_seconds) : '—'}
      </div>

      {/* Wagered */}
      <div className="w-24 flex-shrink-0 text-xs font-medium text-right">
        {machine.total_wagered_session > 0
          ? `R ${machine.total_wagered_session.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          : '—'}
      </div>

      {/* Risk score */}
      <div className="w-16 flex-shrink-0 text-right">
        {isActive && machine.current_risk_score > 0 ? (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${riskColor(machine.current_risk_score)}`}>
            {machine.current_risk_score}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Monitor component ───────────────────────────────────────────────────

export function MachineMonitor() {
  const { data } = useCasinoData();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'idle'>('all');
  const machines = data.machines;

  const stats = useMemo(() => {
    const active = machines.filter(m => m.status === 'active');
    const idle = machines.filter(m => m.status === 'idle');
    const offline = machines.filter(m => m.status === 'offline' || m.status === 'maintenance');
    const highRisk = active.filter(m => m.current_risk_score >= 60);
    const avgSpins = active.length > 0
      ? active.reduce((s, m) => s + m.spins_per_minute, 0) / active.length : 0;
    const totalWagered = active.reduce((s, m) => s + m.total_wagered_session, 0);
    return { active, idle, offline, highRisk, avgSpins, totalWagered };
  }, [machines]);

  const sorted = useMemo(() => {
    const order: Record<string, number> = { active: 0, idle: 1, maintenance: 2, offline: 3 };
    const filtered = filterStatus === 'all' ? machines
      : filterStatus === 'active' ? machines.filter(m => m.status === 'active')
      : machines.filter(m => m.status === 'idle');
    return [...filtered].sort((a, b) => {
      const ao = order[a.status] ?? 4, bo = order[b.status] ?? 4;
      if (ao !== bo) return ao - bo;
      return b.current_risk_score - a.current_risk_score;
    });
  }, [machines, filterStatus]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Machine Monitor</h3>
            <p className="text-xs text-muted-foreground">{machines.length} terminals · casino floor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats.highRisk.length > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-xs">
              {stats.highRisk.length} High Risk
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {stats.active.length}/{machines.length} Active
          </Badge>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`px-2.5 py-1.5 text-xs transition-colors ${view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-2.5 py-1.5 text-xs transition-colors ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-px bg-border">
        {[
          { label: 'Active', value: stats.active.length, color: 'text-emerald-600' },
          { label: 'Idle',   value: stats.idle.length,   color: 'text-slate-500' },
          { label: 'Offline/Maint', value: stats.offline.length, color: 'text-red-500' },
          { label: 'Floor GGR',
            value: `R ${Math.round(stats.totalWagered * 0.05).toLocaleString()}`,
            color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card px-3 py-2 text-center">
            <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pt-2.5 pb-1 border-b border-border/50">
        {(['all', 'active', 'idle'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors capitalize ${filterStatus === f ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
          >
            {f === 'all' ? `All (${machines.length})` : f === 'active' ? `Active (${stats.active.length})` : `Idle (${stats.idle.length})`}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <Zap className="h-3 w-3" /> {stats.avgSpins.toFixed(1)} avg spm
        </div>
      </div>

      {/* Machine grid or list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <Cpu className="h-8 w-8 opacity-30" />
            <span>No machines in this view</span>
          </div>
        ) : view === 'grid' ? (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {sorted.slice(0, 60).map(machine => (
              <MachineCell key={machine.machine_id} machine={machine} />
            ))}
          </div>
        ) : (
          <div>
            {/* List header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/40">
              <span className="w-24">Machine</span>
              <span className="w-12">Type</span>
              <span className="flex-1">SafeBet IQ Player ID</span>
              <span className="w-20">Game</span>
              <span className="w-14 text-right">Duration</span>
              <span className="w-24 text-right">Wagered</span>
              <span className="w-16 text-right">Risk</span>
            </div>
            {sorted.slice(0, 80).map(machine => (
              <MachineRow key={machine.machine_id} machine={machine} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
