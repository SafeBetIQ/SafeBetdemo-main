'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CircleAlert as AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { getRedirectPath } from '@/lib/auth';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1 — Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        const msg = authError.message ?? '';
        if (/invalid|credentials|password/i.test(msg)) {
          setError('Invalid email or password. Please contact your administrator.');
        } else if (/rate|too many/i.test(msg)) {
          setError('Too many login attempts. Please wait a few minutes and try again.');
        } else if (/confirm|verified/i.test(msg)) {
          setError('Email not verified. Please contact your administrator.');
        } else {
          setError(msg || 'Login failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Login failed. No user returned from authentication.');
        setLoading(false);
        return;
      }

      // Step 2 — Fetch application profile
      const { data: userData, error: userError } = await supabase.rpc('get_user_by_email_fast', {
        p_email: email.trim().toLowerCase(),
      });

      if (userError) {
        setError('Unable to load your profile. Please try again.');
        setLoading(false);
        return;
      }

      const profile = Array.isArray(userData) ? userData[0] : userData;

      if (!profile) {
        setError(
          'Account authenticated but no profile found. ' +
          'Please contact your administrator to ensure your account is set up correctly.'
        );
        setLoading(false);
        return;
      }

      if (!profile.is_active) {
        setError('Your account has been deactivated. Please contact your administrator.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Step 3 — Cache profile & update last_login
      sessionStorage.setItem('user_cache', JSON.stringify(profile));
      sessionStorage.setItem('user_cache_time', Date.now().toString());

      if (profile.source === 'users') {
        supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', profile.id)
          .then(() => {});
      }

      // Step 4 — Route
      router.replace(getRedirectPath(profile.role ?? ''));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Link href="/">
            <Image
              src="/safebet-logo-transparent.png"
              alt="SafeBet IQ"
              width={354}
              height={95}
              className="h-24 w-auto"
              priority
            />
          </Link>
        </div>

        {/* Login card */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden">

          {/* Card header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-800/60">
            <h1 className="text-xl font-bold text-white text-center">Welcome back</h1>
            <p className="text-sm text-gray-400 text-center mt-1">Sign in to your dashboard</p>
          </div>

          {/* Login form */}
          <div className="px-6 py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-950/50 border-red-900">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-300 text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-950 border-gray-700 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-brand-500 h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300 text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-gray-950 border-gray-700 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-brand-500 h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold h-11 text-sm mt-2 transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-5">
          Powered by AI-driven responsible gaming technology
        </p>
      </div>
    </div>
  );
}
