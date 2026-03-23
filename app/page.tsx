'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';
import { Shield, Brain, Bell, FileText, Network, ShieldOff, ChartBar as BarChart3, ArrowRight, CircleCheck as CheckCircle, Activity, Lock, Users, Database, TriangleAlert as AlertTriangle, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

const riskTrendData = [
  { month: 'Aug', low: 3200, moderate: 980, high: 340, critical: 82 },
  { month: 'Sep', low: 3450, moderate: 1020, high: 390, critical: 94 },
  { month: 'Oct', low: 3180, moderate: 1100, high: 420, critical: 110 },
  { month: 'Nov', low: 3600, moderate: 1050, high: 370, critical: 98 },
  { month: 'Dec', low: 3800, moderate: 1200, high: 450, critical: 120 },
  { month: 'Jan', low: 4100, moderate: 1350, high: 480, critical: 130 },
];

const interventionData = [
  { month: 'Aug', sent: 310, resolved: 260 },
  { month: 'Sep', sent: 370, resolved: 310 },
  { month: 'Oct', sent: 420, resolved: 358 },
  { month: 'Nov', sent: 390, resolved: 342 },
  { month: 'Dec', sent: 460, resolved: 401 },
  { month: 'Jan', sent: 510, resolved: 448 },
];

const CAPABILITIES = [
  {
    icon: Brain,
    title: 'Real-Time Player Risk Monitoring',
    description:
      'Continuous behavioural scoring across every active session. Risk levels — Low, Moderate, High, Critical — updated in real time as play patterns evolve.',
  },
  {
    icon: Bell,
    title: 'Behavioural Intelligence',
    description:
      'Rule-based analysis of session duration, deposit frequency, loss escalation, and bet intensity. Detects harmful patterns before they escalate.',
  },
  {
    icon: FileText,
    title: 'Compliance Automation',
    description:
      'National Gambling Act compliance scores, downloadable audit-ready reports, and NRGP contribution tracking — generated automatically.',
  },
  {
    icon: Activity,
    title: 'Intervention Tracking',
    description:
      'Threshold-triggered interventions via WhatsApp, Twilio, and email. Every action is logged with full outcome tracking and response timelines.',
  },
];

const MODULES = [
  { icon: Brain, label: 'Risk Engine', desc: 'Behavioural scoring & thresholds' },
  { icon: Activity, label: 'Live Monitoring', desc: 'Real-time session analytics' },
  { icon: Bell, label: 'Intervention System', desc: 'Multi-channel alert delivery' },
  { icon: FileText, label: 'Compliance Reporting', desc: 'NGA-aligned audit reports' },
  { icon: Database, label: 'Audit Logs', desc: 'Full timestamped event trail' },
  { icon: Network, label: 'Cross-Operator Intel', desc: 'Network-wide risk signals' },
  { icon: ShieldOff, label: 'Self-Exclusion Network', desc: 'Cross-operator protection' },
  { icon: BarChart3, label: 'Regulator Dashboards', desc: 'National & provincial views' },
];

const COMPLIANCE_ITEMS = [
  {
    label: 'ISO 27001',
    description: 'Information security management system covering data protection and risk controls.',
    status: 'In Progress',
  },
  {
    label: 'ISO 9001',
    description: 'Quality management system ensuring consistent, auditable service delivery.',
    status: 'In Progress',
  },
  {
    label: 'POPIA',
    description: 'Protection of Personal Information Act — South African data privacy compliance.',
    status: 'Active',
  },
];

const INTEGRATIONS = [
  'SOFTSWISS', 'Altenar', 'Bet Software', 'Playtech', 'Evolution Gaming', 'Twilio', 'WhatsApp Business API',
];

const STATS = [
  { value: '50,000+', label: 'Players monitored' },
  { value: '< 200ms', label: 'Risk score latency' },
  { value: '9', label: 'Provincial regulators' },
  { value: '87%', label: 'Intervention resolution rate' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      <MainNavigation />

      {/* HERO */}
      <section className="pt-20 pb-24 px-6 bg-[#0a0a0a] border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <span className="inline-block mb-6 text-xs font-semibold tracking-widest text-brand-400 uppercase">
              Responsible Gambling Intelligence
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight text-white leading-[1.1] mb-6">
              Global Responsible Gambling
              <br />
              Intelligence Platform
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed mb-10 max-w-2xl">
              SafeBet IQ sits above casino software as a behavioural intelligence layer.
              Real-time risk scoring, automated interventions, and compliance reporting —
              built for operators and regulators.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-500 hover:bg-brand-400 text-white font-semibold px-8 h-12">
                  Request Demo
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-white/20 text-gray-200 hover:bg-white/5 hover:border-white/30 font-semibold px-8 h-12 bg-transparent">
                  View Platform
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
            {STATS.map((stat, i) => (
              <div key={i} className="bg-[#111111] px-8 py-7">
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST & POSITIONING */}
      <section className="py-20 px-6 bg-[#111111] border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block mb-4 text-xs font-semibold tracking-widest text-brand-400 uppercase">
                Built for the Industry
              </span>
              <h2 className="text-3xl font-bold text-white mb-5 leading-tight">
                Designed for operators and regulators — not built for both by accident
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                Casino operators need real-time visibility into player risk and automated intervention workflows.
                Regulators need national oversight, audit trails, and provincial-level intelligence.
                SafeBet IQ serves both with strict data isolation and role-based access.
              </p>
              <div className="space-y-3">
                {[
                  'Multi-tenant architecture — no operator can see another\'s data',
                  'National and 9 provincial regulator dashboards',
                  'Every action logged, timestamped, and exportable',
                  'Role-based access enforced at the database level',
                ].map((point, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{point}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Users, title: 'Casino Operators', desc: 'Full session monitoring, risk scoring, and intervention workflows for your player base.' },
                { icon: Shield, title: 'National Regulators', desc: 'Aggregate insights across all licensed operators with full audit capability.' },
                { icon: BarChart3, title: 'Provincial Regulators', desc: 'Casino-level data for casinos operating within your jurisdiction.' },
                { icon: Lock, title: 'Compliance Officers', desc: 'Intervention queues, compliance scores, and downloadable NGA reports.' },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="bg-[#1a1a1a] rounded-xl border border-white/10 p-5">
                    <div className="w-8 h-8 rounded-lg bg-brand-900/40 flex items-center justify-center mb-3 border border-brand-700/30">
                      <Icon className="h-4 w-4 text-brand-400" />
                    </div>
                    <h4 className="font-semibold text-sm text-white mb-1">{card.title}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">{card.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="py-20 px-6 bg-[#0a0a0a] border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <span className="inline-block mb-4 text-xs font-semibold tracking-widest text-brand-400 uppercase">
              Core Capabilities
            </span>
            <h2 className="text-3xl font-bold text-white leading-tight max-w-xl">
              What SafeBet IQ does
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div key={i} className="flex gap-5 p-6 rounded-xl border border-white/10 bg-[#111111] hover:border-white/20 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-brand-900/40 border border-brand-700/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">{cap.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLATFORM MODULES */}
      <section className="py-20 px-6 bg-[#111111] border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <span className="inline-block mb-4 text-xs font-semibold tracking-widest text-brand-400 uppercase">
              Platform Modules
            </span>
            <h2 className="text-3xl font-bold text-white leading-tight">
              One platform. Every capability.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <div key={i} className="bg-[#1a1a1a] rounded-xl border border-white/10 p-5 hover:border-brand-700/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-brand-900/40 border border-brand-700/30 flex items-center justify-center mb-4">
                    <Icon className="h-4 w-4 text-brand-400" />
                  </div>
                  <h4 className="font-semibold text-sm text-white mb-1">{mod.label}</h4>
                  <p className="text-xs text-gray-500">{mod.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* LIVE INTELLIGENCE */}
      <section className="py-20 px-6 bg-[#0a0a0a] border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <span className="inline-block mb-4 text-xs font-semibold tracking-widest text-brand-400 uppercase">
              Live Intelligence
            </span>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Risk and intervention data — in real time
            </h2>
            <p className="mt-3 text-gray-500 text-sm max-w-xl">
              Illustrative data showing the volume and trend of player risk activity and intervention outcomes across a monitored operator network.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#111111] rounded-xl border border-white/10 p-6">
              <div className="mb-5">
                <h3 className="font-semibold text-white text-sm">Player Risk Distribution</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly volume by risk level</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={riskTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1a1a1a', color: '#e5e7eb' }}
                  />
                  <Area type="monotone" dataKey="low" stackId="1" stroke="#6bc235" fill="#6bc23520" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="moderate" stackId="1" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="high" stackId="1" stroke="#f97316" fill="#f9731620" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#ef444420" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-4">
                {[
                  { color: 'bg-brand-500', label: 'Low' },
                  { color: 'bg-amber-500', label: 'Moderate' },
                  { color: 'bg-orange-500', label: 'High' },
                  { color: 'bg-red-500', label: 'Critical' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#111111] rounded-xl border border-white/10 p-6">
              <div className="mb-5">
                <h3 className="font-semibold text-white text-sm">Intervention Outcomes</h3>
                <p className="text-xs text-gray-500 mt-0.5">Sent vs. resolved per month</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={interventionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1a1a1a', color: '#e5e7eb' }}
                  />
                  <Bar dataKey="sent" fill="#2d6320" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="resolved" fill="#6bc235" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-4">
                {[
                  { color: 'bg-brand-800', label: 'Interventions sent' },
                  { color: 'bg-brand-500', label: 'Resolved' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, value: '12.4%', label: 'Risk reduction (90 days)' },
              { icon: Bell, value: '87%', label: 'Intervention resolution rate' },
              { icon: AlertTriangle, value: '2.1%', label: 'Critical risk prevalence' },
              { icon: Activity, value: '< 200ms', label: 'Real-time scoring latency' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-[#111111] rounded-xl border border-white/10 p-5">
                  <Icon className="h-4 w-4 text-gray-600 mb-3" />
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECURITY & COMPLIANCE */}
      <section className="py-20 px-6 bg-[#111111] border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <span className="inline-block mb-4 text-xs font-semibold tracking-widest text-brand-400 uppercase">
                Security & Compliance
              </span>
              <h2 className="text-3xl font-bold text-white mb-5 leading-tight">
                Built on a secure, privacy-first architecture
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                No personal identity data is stored on the platform. Player tokens are pseudonymised throughout.
                Data isolation is enforced at the database level — no shared schemas, no cross-tenant leakage.
              </p>
              <div className="space-y-3">
                {[
                  'Data encryption at rest and in transit (AES-256, TLS 1.3)',
                  'Row-level security — enforced per casino and per role',
                  'Comprehensive audit logging with exportable records',
                  'API rate limiting and circuit breaker protection',
                  'Pseudonymised player tokens — no PII stored',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {COMPLIANCE_ITEMS.map((item, i) => (
                <div key={i} className="bg-[#1a1a1a] rounded-xl border border-white/10 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-900/40 border border-brand-700/30 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-brand-400" />
                      </div>
                      <h4 className="font-semibold text-white text-sm">{item.label}</h4>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        item.status === 'Active'
                          ? 'bg-brand-900/40 text-brand-400 border border-brand-700/40'
                          : 'bg-amber-900/30 text-amber-400 border border-amber-700/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed pl-11">{item.description}</p>
                </div>
              ))}

              <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-5">
                <h4 className="font-semibold text-white text-sm mb-3">Platform Integrations</h4>
                <div className="flex flex-wrap gap-2">
                  {INTEGRATIONS.map((name, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 font-medium">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">
            Ready to see the platform in action?
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Book a demo with our team or speak directly to our enterprise sales team about your requirements.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/contact">
              <Button size="lg" className="bg-brand-500 hover:bg-brand-400 text-white font-semibold px-10 h-12">
                Request a Demo
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white/20 text-gray-200 hover:bg-white/5 hover:border-white/30 font-semibold px-10 h-12 bg-transparent">
                Speak to Our Team
              </Button>
            </Link>
          </div>
          <p className="mt-8 text-xs text-gray-600">
            No commitment required. We&apos;ll walk you through the platform with your own use case.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
