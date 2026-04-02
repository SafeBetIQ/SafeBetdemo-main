'use client';

import React from 'react';
import { AppShell } from './AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setSettled(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (settled && !user) {
      router.push('/login');
    }
  }, [user, settled, router]);

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
