'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ModuleProvider } from '@/contexts/ModuleContext';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ModuleProvider>
        {children}
        <Toaster />
      </ModuleProvider>
    </AuthProvider>
  );
}
