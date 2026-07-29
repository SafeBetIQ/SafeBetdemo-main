'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CasinoAdminGuardProps {
  children: React.ReactNode;
}

export function CasinoAdminGuard({ children }: CasinoAdminGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setSettled(true), 300);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (settled && user) {
      if (user.role === 'regulator' || user.role === 'national_regulator' || user.role === 'provincial_regulator') {
        router.push('/regulator/dashboard');
      } else if (user.role === 'casino_staff' || user.role === 'staff') {
        // Staff roles have no operator surface after the v1.5 rationalisation.
        router.push('/login');
      }
    } else if (settled && !user) {
      router.push('/login');
    }
  }, [user, settled, router]);

  if (loading || !settled) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'casino_admin' && user.role !== 'super_admin' && user.role !== 'compliance_officer')) {
    return (
      <div className="flex h-screen items-center justify-center p-4 bg-black">
        <Alert className="max-w-md border-gray-800 bg-gray-900">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-white">Access Denied</AlertTitle>
          <AlertDescription className="text-gray-400">
            You do not have permission to access this page. Only casino administrators can view this content.
          </AlertDescription>
          <div className="mt-4">
            <Button onClick={() => router.push('/login')} variant="outline" className="border-gray-700 text-gray-300">
              Return to Login
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
