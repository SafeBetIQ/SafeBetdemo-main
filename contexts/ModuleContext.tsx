'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const userRole = (user as any)?.role;
  const [modules, setModules] = useState<CasinoModule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadModules = async () => {
    if (!user) {
      console.log('[ModuleContext] No user, clearing modules');
      setModules([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[ModuleContext] Loading modules for user:', user.email, 'role:', userRole);

      let casinoId: string | null = null;

      if (userRole === 'casino_admin') {
        // For casino admins, use the casino_id from the user object
        casinoId = (user as any).casino_id;
        console.log('[ModuleContext] Casino admin, casino_id:', casinoId);

        if (!casinoId) {
          console.error('[ModuleContext] Casino admin has no casino_id');
          setModules([]);
          setLoading(false);
          return;
        }
      } else if (userRole === 'staff') {
        const { data: staffData } = await supabase
          .from('staff')
          .select('casino_id')
          .eq('auth_user_id', user.id)
          .single();

        if (staffData?.casino_id) {
          casinoId = staffData.casino_id;
          console.log('[ModuleContext] Staff user, casino_id:', casinoId);
        } else {
          console.log('[ModuleContext] Staff user but no casino found');
          setModules([]);
          setLoading(false);
          return;
        }
      }

      if (userRole === 'casino_admin' || userRole === 'staff') {
        console.log('[ModuleContext] Calling get_casino_modules for casino:', casinoId);
        const { data, error } = await supabase.rpc('get_casino_modules', {
          p_casino_id: casinoId,
        });

        if (error) {
          console.error('[ModuleContext] Error loading modules:', error);
          setModules([]);
        } else {
          console.log('[ModuleContext] Loaded modules:', data?.length || 0, 'modules');
          console.log('[ModuleContext] Module slugs:', data?.map((m: any) => m.slug));
          setModules(data || []);
        }
      } else if (userRole === 'super_admin' || userRole === 'regulator') {
        console.log('[ModuleContext] Loading all active modules for admin/regulator');
        const { data } = await supabase
          .from('software_modules')
          .select('id, name, slug, description, category')
          .eq('is_active', true);

        const mappedModules = (data || []).map((m: any) => ({
          module_id: m.id,
          name: m.name,
          slug: m.slug,
          description: m.description,
          category: m.category,
          enabled_at: new Date().toISOString(),
        }));
        console.log('[ModuleContext] Loaded modules:', mappedModules.length, 'modules');
        setModules(mappedModules);
      } else {
        console.log('[ModuleContext] Unknown role, clearing modules');
        setModules([]);
      }
    } catch (error) {
      console.error('[ModuleContext] Error in loadModules:', error);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();

    // Set up realtime subscription for casino_modules changes
    if (user && (userRole === 'casino_admin' || userRole === 'staff')) {
      // For staff users, we need to get their casino_id first
      const setupSubscription = async () => {
        let casinoId: string | null = null;

        if (userRole === 'casino_admin') {
          casinoId = (user as any).casino_id;
        } else if (userRole === 'staff') {
          const { data: staffData } = await supabase
            .from('staff')
            .select('casino_id')
            .eq('auth_user_id', user.id)
            .single();

          if (staffData?.casino_id) {
            casinoId = staffData.casino_id;
          }
        }

        if (!casinoId) {
          console.log('[ModuleContext] No casino_id for subscription');
          return null;
        }

        // Subscribe to changes for this specific casino
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
            (payload) => {
              console.log('[ModuleContext] Casino modules changed for casino:', casinoId, payload);
              // Small delay to ensure database is consistent
              setTimeout(() => {
                loadModules();
              }, 100);
            }
          )
          .subscribe((status) => {
            console.log('[ModuleContext] Subscription status:', status);
          });

        return channel;
      };

      let channelPromise = setupSubscription();

      return () => {
        channelPromise.then((channel) => {
          if (channel) {
            supabase.removeChannel(channel);
          }
        });
      };
    }
  }, [user, userRole]);

  const hasModule = (slug: string): boolean => {
    if (userRole === 'super_admin' || userRole === 'regulator') {
      return true;
    }
    return modules.some((m) => m.slug === slug);
  };

  const refreshModules = async () => {
    await loadModules();
  };

  return (
    <ModuleContext.Provider value={{ modules, hasModule, loading, refreshModules }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
}
