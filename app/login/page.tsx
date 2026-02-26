'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const startTime = performance.now();

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        setError('Supabase is not configured. Please check environment variables.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Login failed');
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.rpc('get_user_by_email_fast', {
        user_email: email
      });

      if (userError || !userData) {
        setError('Failed to load profile');
        setLoading(false);
        return;
      }

      sessionStorage.setItem('user_cache', JSON.stringify(userData));
      sessionStorage.setItem('user_cache_time', Date.now().toString());

      if (userData.source === 'users') {
        supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userData.id)
          .then(() => {});
      }

      let redirectPath = '/';
      switch (userData.role) {
        case 'super_admin':
          redirectPath = '/admin';
          break;
        case 'casino_admin':
          redirectPath = '/casino/dashboard';
          break;
        case 'regulator':
          redirectPath = '/regulator/dashboard';
          break;
        case 'staff':
          redirectPath = '/staff/academy';
          break;
      }

      router.replace(redirectPath);
    } catch (err: any) {
      if (err?.message?.includes('fetch')) {
        setError('Network error: Unable to connect to authentication service. Please check your internet connection and ensure environment variables are set correctly.');
      } else {
        setError(err?.message || 'An unexpected error occurred');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Link href="/">
            <Image
              src="/safebet-logo-transparent.png"
              alt="SafeBet IQ Logo"
              width={354}
              height={95}
              className="h-24 w-auto"
              priority
            />
          </Link>
        </div>

        <Card className="bg-gray-900 border-gray-800 shadow-xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-white">
              Welcome back
            </CardTitle>
            <CardDescription className="text-center text-gray-400">
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-950/50 border-red-900">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300 font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-950 border-gray-800 text-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300 font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-950 border-gray-800 text-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-400 hover:bg-brand-500 text-black font-semibold py-6 text-base shadow-md"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-sm text-gray-400 text-center mb-3 font-medium">
                Demo Accounts
              </p>
              <div className="space-y-2 text-xs">
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <p className="font-semibold text-gray-300 mb-1">Super Admin</p>
                  <p className="text-gray-400 font-mono">superadmin@safebetiq.com</p>
                  <p className="text-gray-500 font-mono">Super@2024!</p>
                </div>
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <p className="font-semibold text-gray-300 mb-1">Casino Admin (Royal Palace)</p>
                  <p className="text-gray-400 font-mono">admin@royalpalace.safebetiq.com</p>
                  <p className="text-gray-500 font-mono">Admin123!</p>
                </div>
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <p className="font-semibold text-gray-300 mb-1">Regulator</p>
                  <p className="text-gray-400 font-mono">regulator@ngb.gov.za</p>
                  <p className="text-gray-500 font-mono">Regulator123!</p>
                </div>
                <div className="bg-brand-950 p-3 rounded-lg border border-brand-700">
                  <p className="font-semibold text-brand-300 mb-1">Staff (Training Academy)</p>
                  <p className="text-brand-400 font-mono">james.anderson@royalpalace.safebetiq.com</p>
                  <p className="text-brand-400 font-mono">Staff123!</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                Click any credential to copy • All passwords are demo only
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          Powered by AI-driven responsible gaming technology
        </p>
      </div>
    </div>
  );
}
