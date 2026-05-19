'use client';

import React from 'react';
import { AppShell } from './AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setSettled(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    const publicRoutes = ['/', '/login', '/nova-iq', '/wellbeing-game'];
    if (settled && !user && !publicRoutes.includes(pathname)) {
      router.push('/login');
    }
  }, [user, settled, router, pathname]);

  if (loading || !settled) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
