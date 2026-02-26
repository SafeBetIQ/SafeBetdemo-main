'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CasinoAdminGuardProps {
  children: React.ReactNode;
}

export function CasinoAdminGuard({ children }: CasinoAdminGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'casino_staff') {
        router.push('/staff/academy');
      } else if (user.role === 'regulator') {
        router.push('/regulator/dashboard');
      } else if (user.role === 'super_admin') {
        return;
      } else if (user.role !== 'casino_admin') {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'casino_admin' && user.role !== 'super_admin')) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to access this page. Only casino administrators can view this content.
          </AlertDescription>
          <div className="mt-4">
            <Button onClick={() => router.push('/login')}>
              Return to Login
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
