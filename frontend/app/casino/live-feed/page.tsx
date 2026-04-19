'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radio, RefreshCw, Zap, LayoutGrid, List, Brain, Bell, Shield } from 'lucide-react';
import { CasinoDataProvider, useCasinoData } from '@/contexts/CasinoDataContext';
import { LiveBettingFeed } from '@/components/live/LiveBettingFeed';
import { LiveKPIStrip } from '@/components/live/LiveKPIStrip';
import { MachineMonitor } from '@/components/live/MachineMonitor';
import { LiveRiskOverlay } from '@/components/live/LiveRiskOverlay';
import { LiveActivityChart } from '@/components/live/LiveActivityChart';
import { LiveRiskEnginePanel } from '@/components/live/LiveRiskEnginePanel';
import { LiveAlertsPanel } from '@/components/live/LiveAlertsPanel';

// ── Right-column tab types ────────────────────────────────────────────────────

type RightTab = 'engine' | 'alerts' | 'riskfeed';

const RIGHT_TABS: {
  key: RightTab;
  label: string;
  icon: React.ElementType;
  badgeFn?: (data: ReturnType<typeof useCasinoData>['data']) => number | null;
}[] = [
  {
    key: 'engine',
    label: 'Risk Engine',
    icon: Brain,
    badgeFn: (d) => {
      const c = d.activePlayers.filter(p => p.risk_level === 'critical').length;
      return c > 0 ? c : null;
    },
  },
  {
    key: 'alerts',
    label: 'Alerts',
    icon: Bell,
    badgeFn: (d) => d.liveAlerts.length > 0 ? d.liveAlerts.length : null,
  },
  {
    key: 'riskfeed',
    label: 'Risk Feed',
    icon: Shield,
    badgeFn: (d) => {
      const c = d.liveEvents.filter(e => e.risk_score >= 80).length;
      return c > 0 ? c : null;
    },
  },
];

// ── Inner page (needs access to context) ─────────────────────────────────────

function LiveFeedInner() {
  const { data, triggerBurst, refreshData } = useCasinoData();
  const [bursting, setBursting] = useState(false);
  const [layout, setLayout] = useState<'split' | 'wide'>('split');
  const [rightTab, setRightTab] = useState<RightTab>('engine');

  const handleBurst = async () => {
    setBursting(true);
    await triggerBurst(40);
    setTimeout(() => setBursting(false), 1500);
  };

  const unreadAlerts = data.liveAlerts.filter(a => a.dispatch_status === 'pending').length;
  const criticalRisk = data.activePlayers.filter(p => p.risk_level === 'critical').length;

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Live Casino Feed</h1>
              <Badge className={`text-xs border-0 ${data.realtimeConnected ? 'bg-emerald-500 text-white animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                {data.realtimeConnected ? 'LIVE' : 'Connecting…'}
              </Badge>
              {criticalRisk > 0 && (
                <Badge className="bg-red-600 text-white border-0 text-xs animate-pulse">
                  {criticalRisk} Critical
                </Badge>
              )}
              {data.isSimulating && (
                <Badge variant="outline" className="text-xs">Simulation</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time stream · SafeBet AI risk engine · Supabase Realtime
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant="ghost" size="sm"
              className={`rounded-none px-3 h-8 ${layout === 'split' ? 'bg-muted' : ''}`}
              onClick={() => setLayout('split')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className={`rounded-none px-3 h-8 ${layout === 'wide' ? 'bg-muted' : ''}`}
              onClick={() => setLayout('wide')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm" onClick={handleBurst} disabled={bursting}
            className="bg-primary text-primary-foreground"
          >
            <Zap className={`h-3.5 w-3.5 mr-1.5 ${bursting ? 'animate-spin' : ''}`} />
            {bursting ? 'Firing…' : 'Burst 40 Events'}
          </Button>
        </div>
      </div>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* KPI strip */}
        <LiveKPIStrip />

        {layout === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ── Left column ─────────────────────────────────────────────── */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="h-[520px]">
                <LiveBettingFeed />
              </div>
              <LiveActivityChart />
              <MachineMonitor />
            </div>

            {/* ── Right column — tabbed control panel ─────────────────────── */}
            <div className="flex flex-col gap-0">
              {/* Tab bar */}
              <div className="flex items-center gap-0 bg-muted rounded-t-xl border border-border border-b-0 overflow-hidden">
                {RIGHT_TABS.map(({ key, label, icon: Icon, badgeFn }) => {
                  const count = badgeFn?.(data) ?? null;
                  const isActive = rightTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setRightTab(key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-all relative ${
                        isActive
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{label}</span>
                      {count !== null && (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none ${
                          key === 'alerts' && data.liveAlerts.filter(a => a.risk_score_at_trigger >= 80).length > 0
                            ? 'bg-red-500 text-white'
                            : key === 'engine' && count > 0
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="border border-border border-t-0 rounded-b-xl overflow-hidden" style={{ height: '780px' }}>
                {rightTab === 'engine' && <LiveRiskEnginePanel />}
                {rightTab === 'alerts' && <LiveAlertsPanel />}
                {rightTab === 'riskfeed' && (
                  <div className="h-full">
                    <LiveRiskOverlay />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Wide / single-column layout ─────────────────────────────────── */
          <div className="space-y-5">
            <div className="h-[520px]">
              <LiveBettingFeed />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <LiveActivityChart />
              <LiveRiskEnginePanel />
              <LiveAlertsPanel />
            </div>
            <LiveRiskOverlay />
            <MachineMonitor />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function LiveFeedPage() {
  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <CasinoDataProvider>
          <LiveFeedInner />
        </CasinoDataProvider>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
