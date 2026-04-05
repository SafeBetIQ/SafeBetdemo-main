'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, Clock, TriangleAlert as AlertTriangle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCasinoData, MachineStatus } from '@/contexts/CasinoDataContext';

const STATUS_CONFIG: Record<MachineStatus['status'], { dot: string; label: string; row: string }> = {
  active: { dot: 'bg-emerald-500', label: 'Active', row: 'border-emerald-200/50 bg-emerald-50/30' },
  idle: { dot: 'bg-slate-400', label: 'Idle', row: 'border-border/40 bg-transparent' },
  offline: { dot: 'bg-red-400', label: 'Offline', row: 'border-red-200/40 bg-red-50/20' },
  maintenance: { dot: 'bg-amber-500', label: 'Maint.', row: 'border-amber-200/40 bg-amber-50/20' },
};

const MACHINE_TYPE_LABEL: Record<string, string> = {
  slot: 'Slot',
  table: 'Table',
  rng: 'RNG',
  live_dealer: 'Live',
};

function riskColor(score: number) {
  if (score >= 80) return 'text-red-600 bg-red-100';
  if (score >= 60) return 'text-orange-600 bg-orange-100';
  if (score >= 40) return 'text-yellow-700 bg-yellow-100';
  return 'text-emerald-700 bg-emerald-100';
}

function MachineCell({ machine }: { machine: MachineStatus }) {
  const cfg = STATUS_CONFIG[machine.status] || STATUS_CONFIG.idle;
  const isActive = machine.status === 'active';
  const isHighRisk = machine.current_risk_score >= 60;

  return (
    <div className={`rounded-lg border px-3 py-2.5 flex flex-col gap-1.5 transition-all duration-200 ${cfg.row} ${isHighRisk && isActive ? 'ring-1 ring-red-300' : ''}`}>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${isActive ? 'animate-pulse' : ''}`} />
          <span className="font-mono text-xs font-bold text-foreground">{machine.machine_id}</span>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.dot === 'bg-emerald-500' ? 'bg-emerald-100 text-emerald-700' : cfg.dot === 'bg-red-400' ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`}>
          {MACHINE_TYPE_LABEL[machine.machine_type] || machine.machine_type}
        </span>
      </div>

      {isActive && (
        <>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="h-2.5 w-2.5" />
            <span>{machine.spins_per_minute.toFixed(1)} spm</span>
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

interface SummaryRowProps { label: string; value: number | string; color?: string }
function SummaryRow({ label, value, color }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color || 'text-foreground'}`}>{value}</span>
    </div>
  );
}

export function MachineMonitor() {
  const { data } = useCasinoData();
  const machines = data.machines;

  const stats = useMemo(() => {
    const active = machines.filter(m => m.status === 'active');
    const idle = machines.filter(m => m.status === 'idle');
    const offline = machines.filter(m => m.status === 'offline' || m.status === 'maintenance');
    const highRisk = active.filter(m => m.current_risk_score >= 60);
    const avgSpins = active.length > 0
      ? active.reduce((s, m) => s + m.spins_per_minute, 0) / active.length
      : 0;
    return { active, idle, offline, highRisk, avgSpins };
  }, [machines]);

  const sorted = useMemo(() => {
    return [...machines].sort((a, b) => {
      const order = { active: 0, idle: 1, maintenance: 2, offline: 3 };
      const ao = order[a.status] ?? 4;
      const bo = order[b.status] ?? 4;
      if (ao !== bo) return ao - bo;
      return b.current_risk_score - a.current_risk_score;
    });
  }, [machines]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Machine Monitor</h3>
            <p className="text-xs text-muted-foreground">{machines.length} terminals tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {stats.highRisk.length > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-xs">
              {stats.highRisk.length} High Risk
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {stats.active.length} Active
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Real-time status of all gaming terminals. Each cell shows machine ID, type, spins per minute, risk score, and session wagered. Active machines pulse green; high-risk sessions (score ≥ 60) are highlighted with a red ring. Machines are sorted by status then risk score.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border">
        <div className="bg-card px-4 py-3 text-center">
          <div className="text-xl font-bold text-emerald-600">{stats.active.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active</div>
        </div>
        <div className="bg-card px-4 py-3 text-center">
          <div className="text-xl font-bold text-slate-500">{stats.idle.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Idle</div>
        </div>
        <div className="bg-card px-4 py-3 text-center">
          <div className="text-xl font-bold text-red-500">{stats.offline.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Offline</div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border space-y-1.5">
        <SummaryRow label="Avg Spins / Min" value={stats.avgSpins.toFixed(1)} color="text-primary" />
        <SummaryRow
          label="High-Risk Sessions"
          value={stats.highRisk.length}
          color={stats.highRisk.length > 0 ? 'text-red-600' : 'text-muted-foreground'}
        />
        <SummaryRow label="Utilisation" value={`${machines.length > 0 ? Math.round((stats.active.length / machines.length) * 100) : 0}%`} />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <Cpu className="h-8 w-8 opacity-30" />
            <span>No machine data yet…</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {sorted.slice(0, 40).map(machine => (
              <MachineCell key={machine.machine_id} machine={machine} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
