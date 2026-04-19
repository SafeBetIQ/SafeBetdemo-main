'use client';

import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { CasinoDataProvider } from '@/contexts/CasinoDataContext';
import { CasinoSettingsProvider } from '@/contexts/CasinoSettingsContext';
import { RevenueDashboard } from '@/components/analytics/RevenueDashboard';
import { PageHeader } from '@/components/saas/PageHeader';

function RevenuePageInner() {
  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        <PageHeader
          title="Revenue Intelligence"
          subtitle="Real-time revenue protection impact — derived from active player risk profiles and live betting events"
        />
        <div className="flex-1 p-6 min-w-0">
          <RevenueDashboard />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function RevenueIntelligencePage() {
  return (
    <CasinoAdminGuard>
      <CasinoSettingsProvider>
        <CasinoDataProvider>
          <RevenuePageInner />
        </CasinoDataProvider>
      </CasinoSettingsProvider>
    </CasinoAdminGuard>
  );
}
