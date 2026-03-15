'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';
import { Shield, Brain, Activity, Zap, Network, ShieldOff, Building2, Globe, Lock, ChartBar as BarChart3, Users, ArrowRight, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, TrendingUp, FileText, Server, Layers, Database, Bell } from 'lucide-react';

const PLATFORM_LAYERS = [
  { label: 'Casino Platforms', desc: 'SOFTSWISS / Altenar / Bet Software / Playtech', color: 'bg-slate-100 text-slate-700' },
  { label: 'SafeBet IQ Integration Layer', desc: 'Tenant-aware API connectors per operator', color: 'bg-blue-50 text-blue-700' },
  { label: 'Data Ingestion Engine', desc: 'Sessions · Bets · Deposits · Withdrawals', color: 'bg-sky-50 text-sky-700' },
  { label: 'Behavioural Intelligence Engine', desc: 'Rule-based risk scoring & pattern detection', color: 'bg-teal-50 text-teal-700' },
  { label: 'Intervention Engine', desc: 'Automated alerts · WhatsApp · Twilio · Email', color: 'bg-amber-50 text-amber-700' },
  { label: 'Operator Compliance Dashboards', desc: 'Player risk · Interventions · Self-exclusion', color: 'bg-emerald-50 text-emerald-700' },
  { label: 'Regulator Intelligence Platform', desc: 'National & 9 provincial regulators', color: 'bg-green-50 text-green-700' },
];

const CORE_MODULES = [
  {
    icon: Brain,
    title: 'Behavioural Risk Intelligence',
    description: 'Rule-based analysis of session duration, deposit frequency, loss escalation, and bet intensity. Risk levels: Low · Moderate · High · Critical.',
    tags: ['Default Module'],
  },
  {
    icon: Bell,
    title: 'Responsible Gambling Interventions',
    description: 'Threshold-triggered interventions delivered via WhatsApp, Twilio, and email. All interventions logged with outcome tracking.',
    tags: ['Default Module'],
  },
  {
    icon: FileText,
    title: 'Compliance Reporting',
    description: 'National Gambling Act compliance scores, downloadable reports, audit trails, and NRGP contribution tracking.',
    tags: ['Default Module'],
  },
  {
    icon: Network,
    title: 'Cross-Operator Intelligence',
    description: 'Pseudonymised detection of operator hopping, multi-platform gambling, and loss-chasing across the national network.',
    tags: ['Optional Module'],
  },
  {
    icon: ShieldOff,
    title: 'Self-Exclusion Network',
    description: 'Operators submit self-exclusion events. SafeBet IQ distributes protection intelligence across the entire operator network.',
    tags: ['Optional Module'],
  },
  {
    icon: BarChart3,
    title: 'Regulator Intelligence',
    description: 'National and provincial regulator dashboards with high-risk player analytics, intervention statistics, and behavioural insights.',
    tags: ['Optional Module'],
  },
];

const INTEGRATIONS = [
  'SOFTSWISS', 'Altenar', 'Bet Software', 'Playtech', 'Evolution Gaming',
  'Twilio', 'WhatsApp Business API',
];

const COMPLIANCE = [
  'ISO 27001', 'SOC 2', 'GDPR', 'POPIA', 'National Gambling Act (SA)',
];

const USER_ROLES = [
  { role: 'Super Admin', desc: 'Full platform access — all operators, all data', href: '/login' },
  { role: 'National Regulator', desc: 'All casinos · National behaviour insights', href: '/login' },
  { role: 'Provincial Regulator', desc: 'Casinos in assigned province', href: '/login' },
  { role: 'Casino Operator Admin', desc: 'Own casino data only — strict isolation', href: '/login' },
  { role: 'Casino Compliance Officer', desc: 'Intervention queue and reporting', href: '/login' },
];

const STATS = [
  { value: '50K+', label: 'Players Protected' },
  { value: '13', label: 'Licensed Operators' },
  { value: '9', label: 'Provincial Regulators' },
  { value: '99.8%', label: 'Platform Uptime' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* HERO */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-black to-black pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          <Badge className="mb-6 bg-teal-900/40 text-teal-300 border border-teal-800 text-xs px-4 py-1.5 rounded-full">
            Global Responsible Gambling Intelligence Platform
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            The Intelligence Layer
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
              Above Casino Platforms
            </span>
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            SafeBet IQ sits above casino software as a behavioural intelligence layer.
            It analyses player behaviour, detects harmful patterns, triggers interventions,
            and delivers compliance intelligence to operators and regulators — in real time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-8">
              <Link href="/login">Access Platform</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white px-8">
              <Link href="/safeplay-connect">API Documentation</Link>
            </Button>
          </div>

          {/* Stats Strip */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ARCHITECTURE LAYERS */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Platform Architecture</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              A layered intelligence design built for scale, security, and strict multi-tenant data isolation.
            </p>
          </div>

          <div className="space-y-2">
            {PLATFORM_LAYERS.map((layer, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-800 bg-gray-950 hover:border-gray-700 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400 font-mono flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white">{layer.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{layer.desc}</p>
                </div>
                {i < PLATFORM_LAYERS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-700 flex-shrink-0 rotate-90 md:rotate-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE MODULES */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Feature Module System</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Super Admin can enable or disable modules per casino operator.
              Default modules are active for all operators.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE_MODULES.map((module, i) => {
              const Icon = module.icon;
              return (
                <div key={i} className="p-5 rounded-xl border border-gray-800 bg-gray-950 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-teal-400" />
                    </div>
                    <div className="flex gap-1">
                      {module.tags.map((tag, j) => (
                        <span
                          key={j}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            tag === 'Default Module'
                              ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-2">{module.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{module.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* USER ROLES */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Role-Based Access Control</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Strict multi-tenant isolation enforced at database level via Supabase Row Level Security.
              No operator can ever see another operator&apos;s data.
            </p>
          </div>

          <div className="space-y-3">
            {USER_ROLES.map((r, i) => (
              <Link
                key={i}
                href={r.href}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-800 bg-gray-950 hover:border-gray-600 hover:bg-gray-900 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                    <Users className="h-4 w-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{r.role}</p>
                    <p className="text-xs text-gray-500">{r.desc}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATIONS + COMPLIANCE */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/50">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Layers className="h-5 w-5 text-teal-400" />
              Casino Platform Integrations
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              Each casino operator configures their own credentials. Integrations are never global or hardcoded.
            </p>
            <div className="flex flex-wrap gap-2">
              {INTEGRATIONS.map((name, i) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" />
              Security & Compliance
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              Privacy-by-design architecture. No personal identity data stored. Pseudonymised player tokens throughout.
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {COMPLIANCE.map((name, i) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                  {name}
                </span>
              ))}
            </div>
            <div className="space-y-2">
              {[
                'Data encryption at rest and in transit',
                'Role-based access control via Supabase RLS',
                'Comprehensive audit logging',
                'API rate limiting and circuit breakers',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to access the platform?</h2>
          <p className="text-gray-400 text-sm mb-8">
            Use the demo credentials to explore any role — Super Admin, Casino Operator, National Regulator, or Provincial Regulator.
          </p>
          <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-10">
            <Link href="/login">
              Sign In to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
