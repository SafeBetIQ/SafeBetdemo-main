'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface CasinoModule {
  module_id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  enabled_at: string;
  expires_at?: string;
}

interface ModuleContextType {
  modules: CasinoModule[];
  hasModule: (slug: string) => boolean;
  loading: boolean;
  refreshModules: () => Promise<void>;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userRole = (user as any)?.role as string | undefined;
  const userId = (user as any)?.id as string | undefined;
  const userCasinoId = (user as any)?.casino_id as string | undefined;

  const [modules, setModules] = useState<CasinoModule[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const loadModules = useCallback(async () => {
    if (loadingRef.current) return;

    if (!userId || !userRole) {
      setModules([]);
      setLoading(false);
      return;
    }

    try {
      loadingRef.current = true;

      let casinoId: string | null = null;

      if (userRole === 'casino_admin' || userRole === 'compliance_officer') {
        casinoId = userCasinoId ?? null;

        if (!casinoId) {
          const { data: userData } = await supabase
            .from('users')
            .select('casino_id')
            .eq('id', userId)
            .maybeSingle();
          casinoId = userData?.casino_id ?? null;
        }
      } else if (userRole === 'staff') {
        const { data: staffData } = await supabase
          .from('staff')
          .select('casino_id')
          .eq('auth_user_id', userId)
          .single();
        casinoId = staffData?.casino_id ?? null;

        if (!casinoId) {
          setModules([]);
          setLoading(false);
          return;
        }
      }

      if (userRole === 'casino_admin' || userRole === 'compliance_officer' || userRole === 'staff') {
        if (casinoId) {
          const { data, error } = await supabase.rpc('get_casino_modules', {
            p_casino_id: casinoId,
          });

          setModules(error ? [] : (data || []));
        } else {
          setModules([]);
        }
      } else if (
        userRole === 'super_admin' ||
        userRole === 'regulator' ||
        userRole === 'provincial_regulator' ||
        userRole === 'national_regulator'
      ) {
        const { data } = await supabase
          .from('software_modules')
          .select('id, name, slug, description, category')
          .eq('is_active', true);

        setModules(
          (data || []).map((m: any) => ({
            module_id: m.id,
            name: m.name,
            slug: m.slug,
            description: m.description,
            category: m.category,
            enabled_at: new Date().toISOString(),
          }))
        );
      } else {
        setModules([]);
      }
    } catch {
      setModules([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [userId, userRole, userCasinoId]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  useEffect(() => {
    if (!userId || !(userRole === 'casino_admin' || userRole === 'compliance_officer' || userRole === 'staff')) {
      return;
    }

    let cancelled = false;

    const setupSubscription = async () => {
      let casinoId: string | null = userCasinoId ?? null;

      if (!casinoId && (userRole === 'casino_admin' || userRole === 'compliance_officer')) {
        const { data: ud } = await supabase
          .from('users')
          .select('casino_id')
          .eq('id', userId)
          .maybeSingle();
        casinoId = ud?.casino_id ?? null;
      } else if (!casinoId && userRole === 'staff') {
        const { data: staffData } = await supabase
          .from('staff')
          .select('casino_id')
          .eq('auth_user_id', userId)
          .single();
        casinoId = staffData?.casino_id ?? null;
      }

      if (!casinoId || cancelled) return null;

      const channel = supabase
        .channel(`casino-modules-${casinoId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'casino_modules',
            filter: `casino_id=eq.${casinoId}`,
          },
          () => {
            setTimeout(() => loadModules(), 100);
          }
        )
        .subscribe();

      return channel;
    };

    const channelPromise = setupSubscription();

    return () => {
      cancelled = true;
      channelPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel);
      });
    };
  }, [userId, userRole, userCasinoId, loadModules]);

  const hasModule = useCallback(
    (slug: string): boolean => {
      if (
        userRole === 'super_admin' ||
        userRole === 'regulator' ||
        userRole === 'provincial_regulator' ||
        userRole === 'national_regulator'
      ) {
        return true;
      }
      return modules.some((m) => m.slug === slug);
    },
    [userRole, modules]
  );

  const refreshModules = useCallback(async () => {
    await loadModules();
  }, [loadModules]);

  return (
    <ModuleContext.Provider value={{ modules, hasModule, loading, refreshModules }}>
      {children}
    </ModuleContext.Provider>
  );
}

const MODULE_SSR_DEFAULTS: ModuleContextType = {
  modules: [],
  hasModule: () => false,
  loading: true,
  refreshModules: async () => {},
};

export function useModules() {
  const context = useContext(ModuleContext);
  // Return safe defaults during SSR / build-time prerender instead of throwing.
  if (context === undefined) return MODULE_SSR_DEFAULTS;
  return context;
}
