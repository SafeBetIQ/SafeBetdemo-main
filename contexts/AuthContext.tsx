'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, signOut as authSignOut, AuthUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingUserRef = useRef(false);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    if (fetchingUserRef.current) {
      return;
    }

    try {
      fetchingUserRef.current = true;
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
      fetchingUserRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('user_cache');
          sessionStorage.removeItem('user_cache_time');
        }
        router.push('/login');
      } else if (event === 'SIGNED_IN') {
        if (!fetchingUserRef.current) {
          fetchUser();
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [fetchUser, router]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    router.push('/login');
  }, [router]);

  const refetchUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const value = useMemo(
    () => ({ user, loading, signOut, refetchUser }),
    [user, loading, signOut, refetchUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
