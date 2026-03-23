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
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'No user returned' };
    }

    const { data: userData, error: userError } = await supabase.rpc('get_user_by_email_fast', {
      p_email: email
    });

    if (userError || !userData) {
      return { success: false, error: 'Failed to load profile' };
    }

    const profile = Array.isArray(userData) ? userData[0] : userData;

    if (!profile) {
      return { success: false, error: 'Failed to load profile' };
    }

    if (profile.source === 'users') {
      supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', profile.id)
        .then(() => {});
    }

    return { success: true, user: profile as AuthUser };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const startTime = performance.now();

    if (typeof window !== 'undefined') {
      const cachedUser = sessionStorage.getItem('user_cache');
      const cacheTime = sessionStorage.getItem('user_cache_time');

      if (cachedUser && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < 300000) {
          const parsed = JSON.parse(cachedUser);
          console.log(`💾 Using cached user (age: ${age}ms)`);
          return parsed as AuthUser;
        }
      }
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      console.log('❌ No user or email found');
      return null;
    }

    const { data, error } = await supabase.rpc('get_user_by_email_fast', {
      p_email: user.email
    });

    if (error || !data) {
      console.error('❌ RPC error:', error);
      return null;
    }

    const profile = Array.isArray(data) ? data[0] : data;

    if (!profile) {
      return null;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user_cache', JSON.stringify(profile));
      sessionStorage.setItem('user_cache_time', Date.now().toString());
    }

    const totalTime = (performance.now() - startTime).toFixed(0);
    console.log(`✅ getCurrentUser completed in ${totalTime}ms`);
    return profile as AuthUser;
  } catch (error) {
    console.error('❌ getCurrentUser exception:', error);
    return null;
  }
}

export function getRedirectPath(role: string): string {
  switch (role) {
    case 'super_admin':
      return '/admin';
    case 'casino_admin':
      return '/casino/dashboard';
    case 'compliance_officer':
      return '/casino/interventions';
    case 'national_regulator':
    case 'regulator':
      return '/regulator/dashboard';
    case 'provincial_regulator':
      return '/regulator/provincial-dashboard';
    case 'staff':
      return '/staff/profile';
    default:
      return '/';
  }
}
