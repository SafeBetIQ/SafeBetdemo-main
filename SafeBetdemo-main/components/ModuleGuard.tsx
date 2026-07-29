'use client';

import { useModules } from '@/contexts/ModuleContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

const MODULE_LABELS: Record<string, string> = {
  'behavioural-risk-intelligence': 'Behavioural Risk Intelligence',
  'responsible-gambling-alerts': 'Responsible Gambling Alerts',
  'compliance-reporting': 'Compliance Reporting',
  'cross-operator-monitoring': 'Cross Operator Monitoring',
  'self-exclusion-network': 'Self Exclusion Network',
  'ai-risk-forecasting': 'AI Risk Forecasting',
  'regulator-intelligence': 'Regulator Intelligence',
};

interface ModuleGuardProps {
  slug: string;
  children: ReactNode;
  fallbackHref?: string;
}

export function ModuleGuard({ slug, children, fallbackHref = '/casino/dashboard' }: ModuleGuardProps) {
  const { hasModule, loading } = useModules();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const userRole = (user as any)?.role;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasModule(slug)) {
    const moduleLabel = MODULE_LABELS[slug] || slug;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Module Not Activated</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">{moduleLabel}</span> is not enabled
                for your account. Contact your Super Administrator to activate this module.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(fallbackHref)}
              className="flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
