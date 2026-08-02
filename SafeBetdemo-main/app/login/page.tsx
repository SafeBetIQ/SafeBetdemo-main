'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CircleAlert as AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  Globe,
  Activity,
  Users,
  BarChart3,
  Building2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { DemoOperatorSelector } from '@/components/DemoOperatorSelector';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        const msg = authError.message || '';
        if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('password')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')) {
          setError('Too many login attempts. Please wait a few minutes and try again.');
        } else if (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('verified')) {
          setError('Email not verified. Please contact your administrator.');
        } else {
          setError(msg || 'Login failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.rpc('get_user_by_email_fast', { p_email: email });

      if (userError) {
        setError('Unable to load your profile. Please try again.');
        setLoading(false);
        return;
      }

      const profile = Array.isArray(userData) ? userData[0] : userData;

      if (!profile) {
        setError('Account not found in the system. Please contact your administrator.');
        setLoading(false);
        return;
      }

      sessionStorage.setItem('user_cache', JSON.stringify(profile));
      sessionStorage.setItem('user_cache_time', Date.now().toString());

      if (profile?.source === 'users') {
        supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', profile.id).then(() => {});
      }

      // Role/tenant come from the verified server-side profile, NOT the selector.
      let redirectPath = '/';
      switch (profile?.role) {
        case 'super_admin': redirectPath = '/admin'; break;
        case 'casino_admin': redirectPath = '/casino/dashboard'; break;
        case 'compliance_officer': redirectPath = '/casino/dashboard'; break;
        case 'regulator':
        case 'national_regulator': redirectPath = '/regulator/dashboard'; break;
        case 'provincial_regulator': redirectPath = '/regulator/intelligence'; break;
      }

      router.replace(redirectPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f0d] flex">
      {/* Left panel — brand & trust */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] flex-col relative overflow-hidden bg-gradient-to-br from-[#0d1a10] via-[#0a1a12] to-[#060d08]">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(126,211,33,1) 1px, transparent 1px), linear-gradient(90deg, rgba(126,211,33,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#7ED321]/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7ED321]/10 border border-[#7ED321]/20 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7ED321] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#7ED321] tracking-widest uppercase">
                Responsible Gambling Intelligence
              </span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Protecting players.<br />
              <span className="text-[#7ED321]">Empowering</span> regulators.
            </h1>
            <p className="text-white/50 text-base leading-relaxed max-w-md">
              South Africa&rsquo;s AI-driven compliance platform — connecting operators, provincial boards, and the National Gambling Board in real time.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-12">
            {[
              { icon: Building2, value: '6', label: 'Demo Operators' },
              { icon: Globe, value: '9', label: 'Provincial Boards' },
              { icon: Activity, value: '24/7', label: 'Live Monitoring' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <Icon className="h-4 w-4 text-[#7ED321] mx-auto mb-2" />
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-[10px] text-white/40 font-medium mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3 mb-12">
            {[
              { icon: Users, text: 'Real-time player behavioural risk classification across all operators' },
              { icon: BarChart3, text: 'Cross-casino intelligence and provincial heat-map analytics' },
              { icon: ShieldCheck, text: 'Automated intervention workflows triggered by AI-driven risk scoring' },
              { icon: Activity, text: 'Tamper-evident audit trails for every player interaction and regulatory action' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-md bg-[#7ED321]/10 flex items-center justify-center">
                  <Icon className="h-3 w-3 text-[#7ED321]" />
                </div>
                <p className="text-sm text-white/50 leading-snug">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-auto rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
            <p className="text-[11px] text-amber-200/80 leading-snug">
              <span className="font-semibold">Non-production demo · synthetic data.</span> This environment demonstrates
              certified monitoring, evidence and audit workflows against a synthetic six-casino dataset. It does not
              process real operator traffic and is not a statement of production readiness or regulatory approval.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-[#0a0f0d] overflow-y-auto">
        <div className="mb-8">
          <Link href="/">
            <Image
              src="/safebet_website_logo copy copy.png"
              alt="SafeBet IQ"
              width={320}
              height={86}
              className="h-20 w-auto object-contain mx-auto"
              style={{ mixBlendMode: 'lighten' }}
              priority
            />
          </Link>
        </div>

        <div className="w-full max-w-[460px]">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1.5">Sign in to your account</h2>
            <p className="text-sm text-white/40">
              Access your compliance dashboard — all sessions are encrypted and audited.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="bg-red-950/40 border-red-900/60">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/70 text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@organisation.gov.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-[#7ED321]/50 focus-visible:border-[#7ED321]/50 h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/70 text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-[#7ED321]/50 focus-visible:border-[#7ED321]/50 h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#7ED321] hover:bg-[#6bbf1a] text-black font-bold h-11 text-sm mt-2 transition-colors"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Sign in securely
                </span>
              )}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[#7ED321]/60" />
            <span className="text-[11px] text-white/25">256-bit TLS encryption · All access audited</span>
          </div>

          {/* Six-casino demo selector (secure one-click server-side login; demo only) */}
          <DemoOperatorSelector />

          <p className="text-center text-[11px] text-white/20 mt-6">
            &copy; {new Date().getFullYear()} SafeBet IQ &middot; Powered by AI-driven responsible gaming technology
          </p>
        </div>
      </div>
    </div>
  );
}
