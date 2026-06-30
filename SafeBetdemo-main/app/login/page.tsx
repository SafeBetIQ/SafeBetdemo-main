'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
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
  ShieldCheck,
  Lock,
  Globe,
  Activity,
  Users,
  BarChart3,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';

interface Credential {
  label: string;
  email: string;
  password: string;
  sub?: string;
}

const SUPER_ADMIN: Credential[] = [
  { label: 'SafeBet IQ Administrator', email: 'admin@safebetiq.com',      password: 'Admin@SafeBet1', sub: 'Full platform access' },
  { label: 'Demo Administrator',        email: 'demo.admin@safebetiq.com', password: 'Admin@SafeBet1', sub: 'Full platform access' },
];

// 6 operators in the demo database
const CASINO_ADMINS: Credential[] = [
  { label: 'Prestige Casino (Demo)', email: 'demo.casino@safebetiq.com', password: 'Casino@Demo1', sub: 'Sandton, Gauteng' },
];

const NATIONAL_REGULATOR: Credential[] = [
  { label: 'National Gambling Board', email: 'demo.regulator@safebetiq.com', password: 'Regulator@Demo1', sub: 'All provinces — full oversight' },
];

function CredentialRow({ cred, onFill }: { cred: Credential; onFill: (email: string, password: string) => void }) {
  const [copied, setCopied] = useState<'email' | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied('email');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <button
      type="button"
      onClick={() => onFill(cred.email, cred.password)}
      className="w-full text-left group rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 transition-all px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#7ED321]/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">{cred.label}</p>
          {cred.sub && (
            <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {cred.sub}
            </p>
          )}
          <p className="text-[10px] text-white/30 font-mono mt-1 truncate">{cred.email}</p>
        </div>
        <div
          className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Copy email"
            onClick={() => copy(cred.email)}
            className="p-1 rounded text-white/30 hover:text-white/70"
          >
            {copied === 'email' ? <Check className="h-3 w-3 text-[#7ED321]" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  const fillCredential = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
    setShowCredentials(false);
  };

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

      let redirectPath = '/';
      switch (profile?.role) {
        case 'super_admin': redirectPath = '/admin'; break;
        case 'casino_admin': redirectPath = '/casino/dashboard'; break;
        case 'compliance_officer': redirectPath = '/casino/dashboard'; break;
        case 'regulator':
        case 'national_regulator': redirectPath = '/regulator/dashboard'; break;
        case 'provincial_regulator': redirectPath = '/regulator/provincial-dashboard'; break;
        case 'staff': redirectPath = '/staff/profile'; break;
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
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(126,211,33,1) 1px, transparent 1px), linear-gradient(90deg, rgba(126,211,33,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Glow effect */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#7ED321]/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="mb-16">
            <Link href="/">
              <Image
                src="/safebet_website_logo copy copy.png"
                alt="SafeBet IQ"
                width={220}
                height={60}
                className="h-12 w-auto object-contain"
                style={{ mixBlendMode: 'lighten' }}
                priority
              />
            </Link>
          </div>

          {/* Headline */}
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

          {/* Platform stats */}
          <div className="grid grid-cols-3 gap-4 mb-12">
            {[
              { icon: Building2, value: '6', label: 'Licensed Operators' },
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

          {/* Capability bullets */}
          <div className="space-y-3 mb-12">
            {[
              { icon: Users, text: 'Real-time player behavioural risk classification across all operators' },
              { icon: BarChart3, text: 'Cross-casino intelligence and provincial heat-map analytics' },
              { icon: ShieldCheck, text: 'Automated intervention workflows aligned to NGA §26 and SARGF standards' },
              { icon: Activity, text: 'Tamper-evident audit trails with ISO 27001 / POPIA compliance controls' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-md bg-[#7ED321]/10 flex items-center justify-center">
                  <Icon className="h-3 w-3 text-[#7ED321]" />
                </div>
                <p className="text-sm text-white/50 leading-snug">{text}</p>
              </div>
            ))}
          </div>

          {/* Demo Flow Guide */}
          <div className="mb-10">
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">
              Recommended Demo Flow
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { step: '1', label: 'Platform Overview', path: '/casino/dashboard' },
                { step: '2', label: 'Player Risk Monitor', path: '/casino/players' },
                { step: '3', label: 'Investigate Player', path: '/casino/players/…/investigate' },
                { step: '4', label: 'Intervention Engine', path: '/casino/interventions' },
                { step: '5', label: 'Nova IQ Intelligence', path: '/nova-iq' },
                { step: '6', label: 'Regulator Dashboard', path: '/regulator/dashboard' },
                { step: '7', label: 'Audit Centre', path: '/admin/audit' },
                { step: '8', label: 'Evidence Pack PDF', path: 'Print from investigate' },
              ].map(({ step, label, path }) => (
                <div key={step} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="flex-shrink-0 h-4 w-4 rounded-full bg-[#7ED321]/20 text-[#7ED321] text-[9px] font-bold flex items-center justify-center">{step}</span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-white/60 leading-none truncate">{label}</div>
                    <div className="text-[9px] text-white/20 leading-none mt-0.5 truncate">{path}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-auto">
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">
              Compliance Standards
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'ISO 27001', sub: 'Information Security' },
                { label: 'POPIA §8', sub: 'Data Protection' },
                { label: 'NGA §26', sub: 'Responsible Gambling' },
                { label: 'SARGF', sub: 'Risk Framework' },
              ].map(({ label, sub }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                >
                  <ShieldCheck className="h-3 w-3 text-[#7ED321] flex-shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold text-white/70 leading-none">{label}</div>
                    <div className="text-[9px] text-white/30 leading-none mt-0.5">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-[#0a0f0d]">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <Link href="/">
            <Image
              src="/safebet_website_logo copy copy.png"
              alt="SafeBet IQ"
              width={200}
              height={54}
              className="h-10 w-auto object-contain mx-auto"
              style={{ mixBlendMode: 'lighten' }}
              priority
            />
          </Link>
        </div>

        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1.5">Sign in to your account</h2>
            <p className="text-sm text-white/40">
              Access your compliance dashboard — all sessions are encrypted and audited.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="bg-red-950/40 border-red-900/60">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/70 text-sm font-medium">
                Email Address
              </Label>
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
              <Label htmlFor="password" className="text-white/70 text-sm font-medium">
                Password
              </Label>
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

          {/* Security note */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[#7ED321]/60" />
            <span className="text-[11px] text-white/25">
              256-bit TLS encryption · All access audited · ISO 27001 aligned
            </span>
          </div>

          {/* Demo credentials */}
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7ED321] animate-pulse" />
                Demo Credentials
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                Click any role to autofill
                {showCredentials ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>

            {showCredentials && (
              <div className="px-4 pb-4 border-t border-white/10">
                <Tabs defaultValue="super_admin" className="w-full mt-3">
                  <TabsList className="w-full bg-white/5 border border-white/10 h-auto flex-wrap gap-1 p-1 rounded-lg mb-3">
                    <TabsTrigger
                      value="super_admin"
                      className="flex-1 text-[10px] data-[state=active]:bg-[#7ED321] data-[state=active]:text-black text-white/40 py-1.5 rounded font-semibold"
                    >
                      Super Admin
                    </TabsTrigger>
                    <TabsTrigger
                      value="casinos"
                      className="flex-1 text-[10px] data-[state=active]:bg-[#7ED321] data-[state=active]:text-black text-white/40 py-1.5 rounded font-semibold"
                    >
                      Casinos
                    </TabsTrigger>
                    <TabsTrigger
                      value="national"
                      className="flex-1 text-[10px] data-[state=active]:bg-[#7ED321] data-[state=active]:text-black text-white/40 py-1.5 rounded font-semibold"
                    >
                      National
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="super_admin" className="mt-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="h-3 w-3 text-white/30" />
                      <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">
                        Full platform access
                      </span>
                    </div>
                    {SUPER_ADMIN.map((c) => (
                      <CredentialRow key={c.email} cred={c} onFill={fillCredential} />
                    ))}
                  </TabsContent>

                  <TabsContent value="casinos" className="mt-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 className="h-3 w-3 text-white/30" />
                      <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">
                        Demo operator — click to autofill
                      </span>
                    </div>
                    <div className="space-y-1">
                      {CASINO_ADMINS.map((c) => (
                        <CredentialRow key={c.email} cred={c} onFill={fillCredential} />
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="national" className="mt-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="h-3 w-3 text-white/30" />
                      <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">
                        National Gambling Board
                      </span>
                    </div>
                    {NATIONAL_REGULATOR.map((c) => (
                      <CredentialRow key={c.email} cred={c} onFill={fillCredential} />
                    ))}
                  </TabsContent>

                </Tabs>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-white/20 mt-6">
            &copy; {new Date().getFullYear()} SafeBet IQ &middot; Powered by AI-driven responsible gaming technology
          </p>
        </div>
      </div>
    </div>
  );
}
