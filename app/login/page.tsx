'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CircleAlert as AlertCircle, Copy, Check, ChevronDown, ChevronUp, Shield, Building2, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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
    password: 'Admin@SafeBet1',
    sub: 'Full system access',
  },
];

const CASINO_ADMINS: Credential[] = [
  { label: 'Royal Palace Casino', email: 'admin@royalpalace.safebetiq.com', password: 'Casino@Admin1', sub: 'Gauteng' },
  { label: 'Emperors Palace Casino', email: 'admin@emperorspalace.safebetiq.com', password: 'Casino@Admin1', sub: 'Gauteng' },
  { label: 'Montecasino', email: 'admin@montecasino.safebetiq.com', password: 'Casino@Admin1', sub: 'Gauteng' },
  { label: 'Golden Dragon Gaming', email: 'admin@goldendragon.safebetiq.com', password: 'Casino@Admin1', sub: 'Western Cape' },
  { label: 'CapeWin Casino', email: 'admin@capewin.safebetiq.com', password: 'Casino@Admin1', sub: 'Western Cape' },
  { label: 'Sun International Cape Town', email: 'admin@sunintcpt.safebetiq.com', password: 'Casino@Admin1', sub: 'Western Cape' },
  { label: 'Silver Star Resort', email: 'admin@silverstar.safebetiq.com', password: 'Casino@Admin1', sub: 'KwaZulu-Natal' },
  { label: 'Sibaya Casino & Entertainment', email: 'admin@sibaya.safebetiq.com', password: 'Casino@Admin1', sub: 'KwaZulu-Natal' },
  { label: 'Casino Durban', email: 'admin@casinodurban.safebetiq.com', password: 'Casino@Admin1', sub: 'KwaZulu-Natal' },
  { label: 'Graceland Casino', email: 'admin@graceland.safebetiq.com', password: 'Casino@Admin1', sub: 'Mpumalanga' },
  { label: 'Meropa Casino', email: 'admin@meropa.safebetiq.com', password: 'Casino@Admin1', sub: 'Limpopo' },
  { label: 'Windmill Casino', email: 'admin@windmill.safebetiq.com', password: 'Casino@Admin1', sub: 'Free State' },
  { label: 'East London ICC Casino', email: 'admin@easternlcasino.safebetiq.com', password: 'Casino@Admin1', sub: 'Eastern Cape' },
  { label: 'Mmabatho Palms Casino', email: 'admin@mmabatho.safebetiq.com', password: 'Casino@Admin1', sub: 'North West' },
  { label: 'Flamingo Casino', email: 'admin@flamingo.safebetiq.com', password: 'Casino@Admin1', sub: 'Northern Cape' },
  { label: 'Gold Reef Gaming', email: 'admin@goldreef.safebetiq.com', password: 'Casino@Admin1', sub: 'Gauteng' },
  { label: 'Platinum Bets', email: 'admin@platinumbets.safebetiq.com', password: 'Casino@Admin1', sub: 'Gauteng' },
  { label: 'SunBet SA', email: 'admin@sunbet.safebetiq.com', password: 'Casino@Admin1', sub: 'KwaZulu-Natal' },
];

const NATIONAL_REGULATOR: Credential[] = [
  {
    label: 'National Gambling Board',
    email: 'regulator@ngb.gov.za',
    password: 'National@Reg1',
    sub: 'All provinces — full oversight',
  },
];

const PROVINCIAL_REGULATORS: Credential[] = [
  { label: 'Gauteng Gambling Board', email: 'regulator@gauteng.pgb.gov.za', password: 'Province@Reg1', sub: 'Gauteng' },
  { label: 'Western Cape Gambling & Racing Board', email: 'regulator@westerncape.pgb.gov.za', password: 'Province@Reg1', sub: 'Western Cape' },
  { label: 'KwaZulu-Natal Gaming & Betting Board', email: 'regulator@kwazulunatal.pgb.gov.za', password: 'Province@Reg1', sub: 'KwaZulu-Natal' },
  { label: 'Mpumalanga Gaming Board', email: 'regulator@mpumalanga.pgb.gov.za', password: 'Province@Reg1', sub: 'Mpumalanga' },
  { label: 'Limpopo Gambling Board', email: 'regulator@limpopo.pgb.gov.za', password: 'Province@Reg1', sub: 'Limpopo' },
  { label: 'Free State Gambling, Liquor & Tourism', email: 'regulator@freestate.pgb.gov.za', password: 'Province@Reg1', sub: 'Free State' },
  { label: 'Eastern Cape Gambling & Betting Board', email: 'regulator@easterncape.pgb.gov.za', password: 'Province@Reg1', sub: 'Eastern Cape' },
  { label: 'North West Gambling Board', email: 'regulator@northwest.pgb.gov.za', password: 'Province@Reg1', sub: 'North West' },
  { label: 'Northern Cape Gambling Board', email: 'regulator@northerncape.pgb.gov.za', password: 'Province@Reg1', sub: 'Northern Cape' },
];

function CredentialRow({
  cred,
  onFill,
}: {
  cred: Credential;
  onFill: (email: string, password: string) => void;
}) {
  const [copied, setCopied] = useState<'email' | 'pass' | null>(null);

  const copy = (text: string, field: 'email' | 'pass') => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <button
      type="button"
      onClick={() => onFill(cred.email, cred.password)}
      className="w-full text-left group rounded-lg border border-gray-800 bg-gray-950 hover:border-gray-600 hover:bg-gray-900 transition-all px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-600"
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
        <div
          className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Copy email"
            onClick={() => copy(cred.email, 'email')}
            className="p-1 rounded text-gray-500 hover:text-gray-300"
          >
            {copied === 'email' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-gray-600 font-mono mt-1 group-hover:text-gray-500 transition-colors">
        {cred.password}
      </p>
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  const fillCredential = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setLoading(true);

    try {
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
        p_email: email,
      });

      if (userError || !userData) {
        setError('Failed to load user profile');
        setLoading(false);
        return;
      }

      const profile = Array.isArray(userData) ? userData[0] : userData;

      sessionStorage.setItem('user_cache', JSON.stringify(profile));
      sessionStorage.setItem('user_cache_time', Date.now().toString());

      if (profile?.source === 'users') {
        supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', profile.id)
          .then(() => {});
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
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
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
          <div className="px-6 pt-6 pb-4">
            <h1 className="text-xl font-bold text-white text-center">Welcome back</h1>
            <p className="text-sm text-gray-400 text-center mt-1">Sign in to your dashboard</p>
          </div>

          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-950/50 border-red-900">
                  <AlertCircle className="h-4 w-4 text-red-400" />
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
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-950 border-gray-700 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-gray-500 h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300 text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-950 border-gray-700 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-gray-500 h-10"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-white hover:bg-gray-100 text-black font-semibold h-11 text-sm mt-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </div>

          {/* Demo credentials section */}
          <div className="border-t border-gray-800">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="w-full flex items-center justify-between px-6 py-3.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
            >
              <span className="font-medium">Demo Credentials</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                Click to autofill
                {showCredentials ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>

            {showCredentials && (
              <div className="px-4 pb-4">
                <Tabs defaultValue="super_admin" className="w-full">
                  <TabsList className="w-full bg-gray-950 border border-gray-800 h-auto flex-wrap gap-1 p-1 rounded-lg mb-3">
                    <TabsTrigger
                      value="super_admin"
                      className="flex-1 text-[10px] data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      Super Admin
                    </TabsTrigger>
                    <TabsTrigger
                      value="casinos"
                      className="flex-1 text-[10px] data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      Casinos
                    </TabsTrigger>
                    <TabsTrigger
                      value="national"
                      className="flex-1 text-[10px] data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      National Reg
                    </TabsTrigger>
                    <TabsTrigger
                      value="provincial"
                      className="flex-1 text-[10px] data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-500 py-1.5 rounded"
                    >
                      Provincial Reg
                    </TabsTrigger>
                  </TabsList>

                  {/* Super Admin */}
                  <TabsContent value="super_admin" className="mt-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                        Full system access
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
                        18 Licensed operators — all use Casino@Admin1
                      </span>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5 custom-scrollbar">
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
                        9 provincial boards — all use Province@Reg1
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
      </div>
    </div>
  );
}
