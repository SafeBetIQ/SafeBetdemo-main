'use client';

import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { CasinoSettingsProvider } from '@/contexts/CasinoSettingsContext';
import { CasinoSettingsPanel } from '@/components/casino/CasinoSettingsPanel';
import { PageHeader } from '@/components/saas/PageHeader';

function SettingsPageInner() {
  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        <PageHeader
          title="Intervention Settings"
          subtitle="Configure thresholds, channels, cooldown and message templates per casino — applied immediately to the intervention engine"
        />
        <div className="flex-1 p-6 min-w-0">
          <CasinoSettingsPanel />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CasinoSettingsPage() {
  return (
    <CasinoAdminGuard>
      <CasinoSettingsProvider>
        <SettingsPageInner />
      </CasinoSettingsProvider>
    </CasinoAdminGuard>
  );
}
