'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CircleAlert as AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  Building2,
  MapPin,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { getRedirectPath } from '@/lib/auth';
import Link from 'next/link';

// ─── Demo credentials (match auth.users after running migrations) ─────────────
// All accounts use the password: Demo@SafeBet2025!
const DEMO_PASSWORD = 'Demo@SafeBet2025!';

interface Credential {
  label: string;
  email: string;
  password: string;
  sub?: string;
}

const SUPER_ADMIN: Credential[] = [
  {
    label: 'Super Admin',
    email: 'superadmin@safebetiq.com',
    password: DEMO_PASSWORD,
    sub: 'Full platform access — all casinos & analytics',
  },
];

const CASINO_ADMINS: Credential[] = [
  { label: 'Royal Palace Casino',  email: 'admin@royalpalace.safebetiq.com',  password: DEMO_PASSWORD, sub: 'Gauteng' },
  { label: 'Golden Dragon Gaming', email: 'admin@goldendragon.safebetiq.com', password: DEMO_PASSWORD, sub: 'Western Cape' },
  { label: 'Silver Star Resort',   email: 'admin@silverstar.safebetiq.com',   password: DEMO_PASSWORD, sub: 'North West' },
];

const NATIONAL_REGULATOR: Credential[] = [
  {
    label: 'National Gambling Board',
    email: 'regulator@ngb.gov.za',
    password: DEMO_PASSWORD,
    sub: 'All provinces — full oversight',
  },
];

const PROVINCIAL_REGULATORS: Credential[] = [
  { label: 'Gauteng Gambling Board',                  email: 'regulator@gauteng.pgb.gov.za',      password: DEMO_PASSWORD, sub: 'Gauteng' },
  { label: 'Western Cape Gambling & Racing Board',     email: 'regulator@westerncape.pgb.gov.za',  password: DEMO_PASSWORD, sub: 'Western Cape' },
  { label: 'KwaZulu-Natal Gaming & Betting Board',     email: 'regulator@kwazulunatal.pgb.gov.za', password: DEMO_PASSWORD, sub: 'KwaZulu-Natal' },
  { label: 'Mpumalanga Gaming Board',                  email: 'regulator@mpumalanga.pgb.gov.za',   password: DEMO_PASSWORD, sub: 'Mpumalanga' },
  { label: 'Limpopo Gambling Board',                   email: 'regulator@limpopo.pgb.gov.za',      password: DEMO_PASSWORD, sub: 'Limpopo' },
  { label: 'Free State Gambling, Liquor & Tourism',    email: 'regulator@freestate.pgb.gov.za',    password: DEMO_PASSWORD, sub: 'Free State' },
  { label: 'Eastern Cape Gambling & Betting Board',    email: 'regulator@easterncape.pgb.gov.za',  password: DEMO_PASSWORD, sub: 'Eastern Cape' },
  { label: 'North West Gambling Board',                email: 'regulator@northwest.pgb.gov.za',    password: DEMO_PASSWORD, sub: 'North West' },
  { label: 'Northern Cape Gambling Board',             email: 'regulator@northerncape.pgb.gov.za', password: DEMO_PASSWORD, sub: 'Northern Cape' },
];

// ─── Credential row component ─────────────────────────────────────────────────
function CredentialRow({
  cred,
  onFill,
}: {
  cred: Credential;
  onFill: (email: string, password: string) => void;
}) {
  const [copied, setCopied] = useState<'email' | null>(null);

  const copyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cred.email).catch(() => {});
    setCopied('email');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <button
      type="button"
      onClick={() => onFill(cred.email, cred.password)}
      className="w-full text-left group rounded-lg border border-gray-800 bg-gray-950 hover:border-brand-700/60 hover:bg-gray-900 transition-all px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-700/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-200 truncate">{cred.label}</p>
          {cred.sub && (
            <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {cred.sub}
            </p>
          )}
          <p className="text-[10px] text-gray-400 font-mono mt-1 truncate">{cred.email}</p>
        </div>
        <button
          type="button"
          title="Copy email"
          onClick={copyEmail}
          className="shrink-0 p-1 rounded text-gray-600 hover:text-brand-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          {copied === 'email'
            ? <Check className="h-3 w-3 text-brand-400" />
            : <Copy className="h-3 w-3" />
          }
        </button>
      </div>
      <p className="text-[10px] text-gray-700 font-mono mt-1 group-hover:text-gray-500 transition-colors select-none">
        {cred.password}
      </p>
    </button>
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  const fillCredential = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
  };

  const handleDemoLogin = async (email: string, password: string) => {
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message || 'Demo login failed.');
      setLoading(false);
      return;
    }
    router.push('/dashboard');
  };

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
          setError('Invalid email or password. Use the demo credentials below or contact your administrator.');
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

          {/* 1-click demo login buttons — always rendered, no env condition */}
          <div className="border-t border-gray-800 px-6 py-4 flex flex-col gap-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold text-center mb-1">Quick Demo Login</p>
            <Button
              type="button"
              onClick={() => handleDemoLogin('superadmin@safebetiq.com', DEMO_PASSWORD)}
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold h-10 text-sm transition-colors"
            >
              Login as Admin
            </Button>
            <Button
              type="button"
              onClick={() => handleDemoLogin('admin@royalpalace.safebetiq.com', DEMO_PASSWORD)}
              disabled={loading}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold h-10 text-sm transition-colors"
            >
              Login as Casino
            </Button>
            <Button
              type="button"
              onClick={() => handleDemoLogin('regulator@ngb.gov.za', DEMO_PASSWORD)}
              disabled={loading}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold h-10 text-sm transition-colors"
            >
              Login as Regulator
            </Button>
          </div>

          {/* Demo credentials panel */}
          <div className="border-t border-gray-800">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="w-full flex items-center justify-between px-6 py-3.5 text-sm text-gray-400 hover:text-brand-400 hover:bg-gray-800/40 transition-colors"
            >
              <span className="font-medium">Demo Credentials</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                Click any row to autofill
                {showCredentials
                  ? <ChevronUp className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />
                }
              </span>
            </button>

            {showCredentials && (
              <div className="px-4 pb-5">

                {/* Password hint */}
                <div className="mb-3 px-3 py-2 rounded-lg bg-brand-950/40 border border-brand-900/50">
                  <p className="text-[11px] text-brand-400 font-medium">
                    All demo accounts use the same password:
                  </p>
                  <p className="text-[11px] text-brand-300 font-mono mt-0.5 select-all">
                    Demo@SafeBet2025!
                  </p>
                </div>

                <Tabs defaultValue="super_admin" className="w-full">
                  <TabsList className="w-full bg-gray-950 border border-gray-800 h-auto flex-wrap gap-1 p-1 rounded-lg mb-3">
                    <TabsTrigger
                      value="super_admin"
                      className="flex-1 text-[10px] data-[state=active]:bg-brand-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      Super Admin
                    </TabsTrigger>
                    <TabsTrigger
                      value="casinos"
                      className="flex-1 text-[10px] data-[state=active]:bg-brand-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      Casinos
                    </TabsTrigger>
                    <TabsTrigger
                      value="national"
                      className="flex-1 text-[10px] data-[state=active]:bg-brand-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      National Reg
                    </TabsTrigger>
                    <TabsTrigger
                      value="provincial"
                      className="flex-1 text-[10px] data-[state=active]:bg-brand-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      Provincial Reg
                    </TabsTrigger>
                  </TabsList>

                  {/* Super Admin */}
                  <TabsContent value="super_admin" className="mt-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                        Full platform access
                      </span>
                    </div>
                    {SUPER_ADMIN.map((c) => (
                      <CredentialRow key={c.email} cred={c} onFill={fillCredential} />
                    ))}
                  </TabsContent>

                  {/* Casino Admins */}
                  <TabsContent value="casinos" className="mt-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                        3 live casino operators
                      </span>
                    </div>
                    <div className="space-y-1">
                      {CASINO_ADMINS.map((c) => (
                        <CredentialRow key={c.email} cred={c} onFill={fillCredential} />
                      ))}
                    </div>
                  </TabsContent>

                  {/* National Regulator */}
                  <TabsContent value="national" className="mt-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                        National Gambling Board — all casinos
                      </span>
                    </div>
                    {NATIONAL_REGULATOR.map((c) => (
                      <CredentialRow key={c.email} cred={c} onFill={fillCredential} />
                    ))}
                  </TabsContent>

                  {/* Provincial Regulators */}
                  <TabsContent value="provincial" className="mt-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                        9 provincial boards
                      </span>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5 custom-scrollbar">
                      {PROVINCIAL_REGULATORS.map((c) => (
                        <CredentialRow key={c.email} cred={c} onFill={fillCredential} />
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-5">
          Powered by AI-driven responsible gaming technology
        </p>
        <p className="text-center text-[10px] text-gray-700 mt-1 font-mono">
          build: {process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'dev'}
        </p>
      </div>
    </div>
  );
}
