'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';
import { Shield, Brain, Activity, Zap, Network, ShieldOff, Building2, Globe, Lock, ChartBar as BarChart3, Users, ArrowRight, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, TrendingUp, FileText, Server, Layers, Database, Bell } from 'lucide-react';
import TypewriterText from '@/components/TypewriterText';


const CORE_MODULES = [
  {
    icon: Brain,
    title: 'Behavioural Risk Intelligence',
    description: 'Rule-based analysis of session duration, deposit frequency, loss escalation, and bet intensity. Risk levels: Low · Moderate · High · Critical.',
    tags: ['Demonstrated'],
  },
  {
    icon: Bell,
    title: 'Responsible Gambling Interventions',
    description: 'Human-governed intervention workflow: risk signals are reviewed by staff, decisions are recorded, and each action is linked to tamper-evident compliance evidence.',
    tags: ['Partially Implemented'],
  },
  {
    icon: FileText,
    title: 'Compliance Reporting',
    description: 'National Gambling Act compliance views, downloadable CSV/PDF reports, audit trails, and NRGP contribution tracking.',
    tags: ['Demonstrated'],
  },
  {
    icon: Network,
    title: 'Cross-Operator Intelligence',
    description: 'Planned: pseudonymised detection of operator hopping and loss-chasing across operators, subject to lawful data-sharing arrangements and authorised participation.',
    tags: ['Planned'],
  },
  {
    icon: ShieldOff,
    title: 'Self-Exclusion Network',
    description: 'Planned: network-wide distribution of self-exclusion intelligence across participating operators, subject to regulatory authorisation and privacy safeguards.',
    tags: ['Planned'],
  },
  {
    icon: BarChart3,
    title: 'Regulator Intelligence',
    description: 'National and provincial regulator dashboards with risk analytics, intervention activity and behavioural insights over governed data.',
    tags: ['Demonstrated'],
  },
];

// Integration approach — operators configure their own credentials. Named platforms
// are integration targets, not active partnerships or prebuilt connectors.
const COMPLIANCE = [
  'POPIA-aligned', 'National Gambling Act (SA)', 'NRGP-aligned',
];

const USER_ROLES = [
  { role: 'Super Admin', desc: 'Full platform access — all operators, all data', href: '/login' },
  { role: 'National Regulator', desc: 'All casinos · National behaviour insights', href: '/login' },
  { role: 'Provincial Regulator', desc: 'Casinos in assigned province', href: '/login' },
  { role: 'Casino Operator Admin', desc: 'Own casino data only — strict isolation', href: '/login' },
  { role: 'Casino Compliance Officer', desc: 'Intervention queue and reporting', href: '/login' },
];


export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* HERO */}
      <section className="relative pt-28 pb-24 px-6 overflow-hidden" style={{ minHeight: '680px' }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/20 via-black to-black pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          <Badge className="mb-6 bg-brand-900/40 text-brand-300 border border-brand-800 text-sm px-5 py-2 rounded-full font-mono tracking-wide">
            <TypewriterText
              text="Global Responsible Gambling Intelligence Platform"
              delay={45}
              startDelay={600}
              cursorClassName="text-brand-400 bg-brand-400"
            />
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Intelligent Responsible Gambling.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-500">
              Stronger Regulatory Oversight.
            </span>
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            SafeBet IQ brings together behavioural risk monitoring, player protection intelligence,
            regulatory dashboards and verifiable compliance evidence in one integrated platform.
          </p>

          {/* Three core value propositions */}
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
            {[
              { icon: Brain, title: 'Behavioural Risk Intelligence' },
              { icon: Shield, title: 'Responsible Gambling Oversight' },
              { icon: FileText, title: 'Verifiable Compliance Evidence' },
            ].map((v, i) => {
              const Icon = v.icon;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-left">
                  <div className="w-9 h-9 rounded-lg bg-brand-900/40 border border-brand-800 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-brand-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-200">{v.title}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-8">
              <Link href="/contact">Request a Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8">
              <Link href="/login">Explore the Platform</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-gray-500 font-mono tracking-wide">
            Demonstration available. Controlled pilot preparation underway.
          </p>

        </div>
      </section>


      {/* BEFORE / AFTER */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              The Transformation
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">What changes when you use SafeBet IQ</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              A clear picture of the operational difference — before and after deploying the platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* BEFORE */}
            <div className="rounded-2xl border border-red-900/40 bg-red-950/10 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-7 h-7 rounded-full bg-red-900/40 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                </div>
                <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">Before SafeBet IQ</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Player risk visibility', value: 'None — no behavioural data collected' },
                  { label: 'Harm detection', value: 'Manual, reactive, or non-existent' },
                  { label: 'Interventions', value: 'Ad-hoc phone calls, if any' },
                  { label: 'Self-exclusion', value: 'Siloed per operator — no cross-network check' },
                  { label: 'Compliance reporting', value: 'Spreadsheets, manual consolidation' },
                  { label: 'Regulator oversight', value: 'Delayed, incomplete, paper-based' },
                  { label: 'Multi-casino visibility', value: 'Zero — no operator-level aggregation' },
                  { label: 'Audit trail', value: 'Fragmented or absent' },
                ].map((row, i) => (
                  <div key={i} className="flex flex-col gap-0.5 pb-4 border-b border-red-900/20 last:border-0 last:pb-0">
                    <span className="text-xs font-medium text-gray-400">{row.label}</span>
                    <span className="text-sm text-red-300/80">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AFTER */}
            <div className="rounded-2xl border border-brand-800/40 bg-brand-950/10 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-7 h-7 rounded-full bg-brand-900/40 flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 text-brand-400" />
                </div>
                <span className="text-sm font-semibold text-brand-400 uppercase tracking-wider">After SafeBet IQ</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Player risk visibility', value: 'Rule-based scoring: Low · Moderate · High · Critical' },
                  { label: 'Harm detection', value: 'Rule-based pattern detection across every session' },
                  { label: 'Interventions', value: 'Human-reviewed, recorded, and linked to compliance evidence' },
                  { label: 'Self-exclusion', value: 'Per-operator today; network distribution on the roadmap' },
                  { label: 'Compliance reporting', value: 'NGA compliance views, audit trail, NRGP tracking' },
                  { label: 'Regulator oversight', value: 'Dashboards for national & provincial regulator roles' },
                  { label: 'Multi-casino visibility', value: 'Operator-level aggregation with strict data isolation' },
                  { label: 'Audit trail', value: 'Every action logged, timestamped, and exportable' },
                ].map((row, i) => (
                  <div key={i} className="flex flex-col gap-0.5 pb-4 border-b border-brand-800/20 last:border-0 last:pb-0">
                    <span className="text-xs font-medium text-gray-400">{row.label}</span>
                    <span className="text-sm text-brand-300/90">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom summary strip */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { before: 'Blind', after: 'Full Visibility', label: 'Player Behaviour' },
              { before: 'Ad-hoc', after: 'Governed', label: 'Intervention Process' },
              { before: 'Per Casino', after: 'Roadmap', label: 'Self-Exclusion Reach' },
              { before: 'Manual', after: 'Structured', label: 'Compliance Reporting' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-center">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{item.label}</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-red-400 font-medium line-through">{item.before}</span>
                  <ArrowRight className="h-3 w-3 text-gray-600 flex-shrink-0" />
                  <span className="text-xs text-brand-400 font-semibold">{item.after}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE MODULES */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Platform Capabilities</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Each capability is labelled by its current status — Demonstrated, Partially Implemented,
              In Development or Planned — so you always know what is available today versus on the roadmap.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE_MODULES.map((module, i) => {
              const Icon = module.icon;
              return (
                <div key={i} className="p-5 rounded-xl border border-gray-800 bg-gray-950 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <div className="flex gap-1">
                      {module.tags.map((tag, j) => (
                        <span
                          key={j}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            tag === 'Demonstrated'
                              ? 'bg-brand-900/40 text-brand-400 border border-brand-800'
                              : tag === 'Partially Implemented'
                              ? 'bg-amber-900/30 text-amber-400 border border-amber-800'
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
              <Layers className="h-5 w-5 text-brand-400" />
              Integration Approach
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              SafeBet IQ is designed to ingest player and session signals from casino platforms via a
              documented API. Each operator configures their own credentials — integrations are never
              global or hardcoded. Platform and communication connectors are integration targets on the
              roadmap, not prebuilt partnerships.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Documented REST API', 'Per-operator credentials', 'Sandbox environment'].map((name, i) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-brand-400" />
              Security & Compliance
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              Designed with privacy, role-based access controls and auditability as core architectural
              considerations. Player identifiers are pseudonymised, and the listed frameworks are design
              and alignment targets — not certifications.
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
                  <CheckCircle className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
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
