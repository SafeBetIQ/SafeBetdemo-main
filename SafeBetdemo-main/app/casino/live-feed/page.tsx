'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radio, RefreshCw, Zap, LayoutGrid, List } from 'lucide-react';
import { CasinoDataProvider, useCasinoData } from '@/contexts/CasinoDataContext';
import { LiveBettingFeed } from '@/components/live/LiveBettingFeed';
import { LiveKPIStrip } from '@/components/live/LiveKPIStrip';
import { MachineMonitor } from '@/components/live/MachineMonitor';
import { LiveRiskOverlay } from '@/components/live/LiveRiskOverlay';
import { LiveActivityChart } from '@/components/live/LiveActivityChart';

function LiveFeedInner() {
  const { data, triggerBurst, refreshData } = useCasinoData();
  const [bursting, setBursting] = useState(false);
  const [layout, setLayout] = useState<'split' | 'wide'>('split');

  const handleBurst = async () => {
    setBursting(true);
    await triggerBurst(40);
    setTimeout(() => setBursting(false), 1500);
  };

  return (
    <div className="flex min-h-full flex-col">
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
              {data.isSimulating && (
                <Badge variant="outline" className="text-xs">
                  Simulation Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Real-time event stream · Supabase Realtime</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-none px-3 h-8 ${layout === 'split' ? 'bg-muted' : ''}`}
              onClick={() => setLayout('split')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
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
            size="sm"
            onClick={handleBurst}
            disabled={bursting}
            className="bg-primary text-primary-foreground"
          >
            <Zap className={`h-3.5 w-3.5 mr-1.5 ${bursting ? 'animate-spin' : ''}`} />
            {bursting ? 'Firing…' : 'Burst 40 Events'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        <LiveKPIStrip />

        {layout === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="h-[520px]">
                <LiveBettingFeed />
              </div>
              <LiveActivityChart />
              <MachineMonitor />
            </div>
            <div className="flex flex-col gap-5">
              <LiveRiskOverlay />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <LiveBettingFeed />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <LiveActivityChart />
              <LiveRiskOverlay />
            </div>
            <MachineMonitor />
          </div>
        )}
      </div>
    </div>
  );
}

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
