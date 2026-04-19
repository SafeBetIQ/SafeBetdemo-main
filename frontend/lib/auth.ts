import { supabase, User } from './supabase';

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  user_role?: string;
  casino_id?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  source?: string;
}

export type AuthUser = User | StaffUser;

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'No user returned from authentication' };
    }

    const profile = await fetchProfile(email.trim().toLowerCase());
    if (!profile) {
      return { success: false, error: 'Account authenticated but no profile found' };
    }

    return { success: true, user: profile };
  } catch {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Fetch the application profile for the given email.
 *
 * Uses the get_user_by_email_fast RPC which checks staff first, then users.
 * Returns null if no profile exists.
 */
async function fetchProfile(email: string): Promise<AuthUser | null> {
  const { data, error } = await supabase.rpc('get_user_by_email_fast', {
    p_email: email,
  });

  if (error || !data) return null;

  const profile = Array.isArray(data) ? data[0] : data;
  return profile ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Check session-storage cache first (5-minute TTL)
    if (typeof window !== 'undefined') {
      const cachedUser = sessionStorage.getItem('user_cache');
      const cacheTime  = sessionStorage.getItem('user_cache_time');

      if (cachedUser && cacheTime) {
        const age = Date.now() - parseInt(cacheTime, 10);
        if (age < 300_000) {
          const parsed = JSON.parse(cachedUser);
          const profile = Array.isArray(parsed) ? parsed[0] : parsed;
          if (profile?.role) {
            return profile as AuthUser;
          }
          // Stale/corrupt cache — clear it
          sessionStorage.removeItem('user_cache');
          sessionStorage.removeItem('user_cache_time');
        }
      }
    }

    // No valid cache — fetch from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;

    const profile = await fetchProfile(user.email);
    if (!profile) return null;

    // Persist to cache
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user_cache', JSON.stringify(profile));
      sessionStorage.setItem('user_cache_time', Date.now().toString());
    }

    return profile;
  } catch {
    return null;
  }
}

/**
 * Returns the dashboard path for the given role.
 * Single authoritative source — both login page and auth context use this.
 */
export function getRedirectPath(role: string): string {
  switch (role) {
    case 'super_admin':           return '/admin';
    case 'casino_admin':          return '/casino/dashboard';
    case 'compliance_officer':    return '/casino/interventions';
    case 'national_regulator':
    case 'regulator':             return '/regulator/dashboard';
    case 'provincial_regulator':  return '/regulator/provincial-dashboard';
    case 'staff':                 return '/staff/profile';
    default:                      return '/';
  }
}
