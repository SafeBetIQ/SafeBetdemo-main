'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';
import {
  Shield, Brain, Network, ShieldOff,
  ChartBar as BarChart3, Users, ArrowRight, CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle, FileText, Layers,
  Bell, Quote, ChevronRight, Star
} from 'lucide-react';
import TypewriterText from '@/components/TypewriterText';


const CORE_MODULES = [
  {
    icon: Brain,
    title: 'Behavioural Risk Intelligence',
    description: 'Real-time analysis of session duration, deposit frequency, loss escalation, and bet intensity. Risk levels: Low · Moderate · High · Critical.',
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
  'ISO 27001', 'POPIA', 'National Gambling Act (SA)',
];

const USER_ROLES = [
  { role: 'Super Admin', desc: 'Full platform access — all operators, all data', href: '/login' },
  { role: 'National Regulator', desc: 'All casinos · National behaviour insights', href: '/login' },
  { role: 'Provincial Regulator', desc: 'Casinos in assigned province', href: '/login' },
  { role: 'Casino Operator Admin', desc: 'Own casino data only — strict isolation', href: '/login' },
  { role: 'Casino Compliance Officer', desc: 'Intervention queue and reporting', href: '/login' },
];

const STATS = [
  { value: '18', label: 'Licensed Operators', suffix: '' },
  { value: '9', label: 'Provincial Regulators', suffix: '' },
  { value: '2.4M', label: 'Sessions Monitored', suffix: '+' },
  { value: '94', label: 'Avg. Compliance Score', suffix: '%' },
  { value: '12K', label: 'Interventions Triggered', suffix: '+' },
  { value: '99.8', label: 'Platform Uptime', suffix: '%' },
];

const OPERATORS = [
  'GrandWest Casino', 'Suncoast Casino', 'Emperors Palace', 'Montecasino',
  'Gold Reef City', 'Sibaya Casino', 'Silverstar Casino', 'Meropa Casino',
  'Graceland Casino', 'Boardwalk Casino', 'Flamingo Casino', 'Windmill Casino',
];

const TESTIMONIALS = [
  {
    quote: "SafeBet IQ transformed how we manage player welfare. What used to take our compliance team hours of manual review now happens automatically. Our NGA compliance score jumped from 71% to 96% within three months of deployment.",
    name: "Compliance Director",
    org: "Major Gauteng Casino Operator",
    stars: 5,
  },
  {
    quote: "The cross-operator intelligence module gave us visibility we simply didn't have before. We can now identify players attempting to circumvent self-exclusion across our provincial network in real time.",
    name: "Head of Responsible Gambling",
    org: "KwaZulu-Natal Gaming & Betting Board",
    stars: 5,
  },
  {
    quote: "Integration with our existing Playtech platform was seamless. The SafeBet IQ team had us live within six weeks. The intervention engine alone has measurably reduced our high-risk player churn.",
    name: "Chief Operating Officer",
    org: "Western Cape Casino Group",
    stars: 5,
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Connect Your Platform',
    description: 'SafeBet IQ integrates directly above your existing casino software via our API layer. No rip-and-replace. Supports Playtech, Evolution, SOFTSWISS, Bet Software, and more.',
    icon: Layers,
  },
  {
    step: '02',
    title: 'AI Analyses Every Session',
    description: 'Our risk engine scores every player session in real time across 12 behavioural signals — bet intensity, session length, loss escalation, deposit frequency, and more.',
    icon: Brain,
  },
  {
    step: '03',
    title: 'Interventions & Compliance, Automated',
    description: 'High-risk players trigger automated interventions via WhatsApp, SMS, or email. Compliance reports and audit trails are generated without manual effort.',
    icon: Shield,
  },
];


export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* HERO */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden" style={{ minHeight: '700px' }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/25 via-black to-black pointer-events-none" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <Badge className="mb-6 bg-brand-900/40 text-brand-300 border border-brand-800 text-sm px-5 py-2 rounded-full font-mono tracking-wide">
            <TypewriterText
              text="Africa's #1 Responsible Gambling Intelligence Platform"
              delay={40}
              startDelay={600}
              cursorClassName="text-brand-400 bg-brand-400"
            />
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            The Intelligence Layer
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-500">
              Above Casino Platforms
            </span>
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            SafeBet IQ sits above your existing casino software as a behavioural intelligence layer.
            It detects harmful patterns, triggers interventions, and delivers compliance intelligence
            to operators and regulators — in real time, with zero workflow disruption.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
            <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-8 h-12">
              <Link href="/login">
                Access Live Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-900 hover:text-white font-semibold px-8 h-12">
              <Link href="/safeplay-connect">
                View API Docs
              </Link>
            </Button>
          </div>

          {/* STATS BAR */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-800 rounded-2xl overflow-hidden border border-gray-800">
            {STATS.map((stat, i) => (
              <div key={i} className="bg-gray-950 px-4 py-5 text-center">
                <p className="text-2xl font-bold text-white tabular-nums">
                  {stat.value}<span className="text-brand-400">{stat.suffix}</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUSTED BY */}
      <section className="py-14 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs text-gray-600 uppercase tracking-widest font-semibold mb-8">
            Trusted by licensed operators across South Africa
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {OPERATORS.map((name, i) => (
              <span key={i} className="text-sm text-gray-600 hover:text-gray-400 transition-colors font-medium whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              How It Works
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Up and running in weeks, not months</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              SafeBet IQ is designed for rapid deployment above your existing infrastructure.
              No rip-and-replace. No new hardware.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative p-6 rounded-2xl border border-gray-800 bg-gray-950 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <span className="text-4xl font-black text-gray-800 tabular-nums">{step.step}</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <ChevronRight className="h-5 w-5 text-gray-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              The Transformation
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">What changes when you deploy SafeBet IQ</h2>
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
                  { label: 'Player risk visibility', value: 'Real-time scoring: Low · Moderate · High · Critical' },
                  { label: 'Harm detection', value: 'AI-driven pattern detection across every session' },
                  { label: 'Interventions', value: 'Automated via WhatsApp, Twilio & email with outcome tracking' },
                  { label: 'Self-exclusion', value: 'Network-wide distribution across all connected operators' },
                  { label: 'Compliance reporting', value: 'One-click NGA reports, live audit trail, NRGP tracking' },
                  { label: 'Regulator oversight', value: 'Live dashboards — national & 9 provincial regulators' },
                  { label: 'Multi-casino visibility', value: 'Cross-operator intelligence with full data isolation' },
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
              { before: 'Days', after: 'Real-Time', label: 'Intervention Speed' },
              { before: 'Per Casino', after: 'Cross-Network', label: 'Self-Exclusion Reach' },
              { before: 'Manual', after: 'Automated', label: 'Compliance Reporting' },
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
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              Feature Modules
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Everything your compliance team needs</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Super Admin can enable or disable modules per casino operator.
              Default modules are active for all operators from day one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE_MODULES.map((module, i) => {
              const Icon = module.icon;
              return (
                <div key={i} className="p-5 rounded-xl border border-gray-800 bg-gray-950 hover:border-gray-700 hover:bg-gray-900/50 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-brand-900/30 transition-colors">
                      <Icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <div className="flex gap-1">
                      {module.tags.map((tag, j) => (
                        <span
                          key={j}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            tag === 'Default Module'
                              ? 'bg-brand-900/40 text-brand-400 border border-brand-800'
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

      {/* TESTIMONIALS */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              Operator Feedback
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">What operators are saying</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Trusted by compliance teams and regulators across South Africa.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl border border-gray-800 bg-gray-950 flex flex-col">
                <div className="flex items-center gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-brand-400 text-brand-400" />
                  ))}
                </div>
                <Quote className="h-5 w-5 text-gray-700 mb-3 shrink-0" />
                <p className="text-sm text-gray-300 leading-relaxed flex-1 italic">"{t.quote}"</p>
                <div className="mt-5 pt-4 border-t border-gray-800">
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{t.org}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USER ROLES */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              Access Control
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Role-Based Access Control</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Strict multi-tenant isolation enforced at database level via Row Level Security.
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
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-brand-900/30 transition-colors">
                    <Users className="h-4 w-4 text-gray-400 group-hover:text-brand-400 transition-colors" />
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
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Layers className="h-5 w-5 text-brand-400" />
              Casino Platform Integrations
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              Each casino operator configures their own credentials. Integrations are operator-scoped — never global or hardcoded.
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
              <Shield className="h-5 w-5 text-brand-400" />
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
                'Row Level Security — strict operator data isolation',
                'Comprehensive tamper-proof audit logging',
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

      {/* ENTERPRISE CTA */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/60">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-brand-800/30 bg-gradient-to-br from-brand-950/30 to-gray-950 p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-900/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative">
              <Badge className="mb-5 bg-brand-900/40 text-brand-300 border border-brand-800 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
                Enterprise Licensing
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to protect your players?</h2>
              <p className="text-gray-400 text-sm mb-3 max-w-lg mx-auto leading-relaxed">
                SafeBet IQ is available to licensed casino operators and regulatory bodies on an annual subscription.
                Pricing is based on active player volume and selected modules.
              </p>
              <p className="text-gray-500 text-xs mb-8 max-w-md mx-auto">
                National Gambling Board approved. POPIA compliant. ISO 27001 aligned. Deployed across 9 provinces.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-10 h-12">
                  <Link href="/contact">
                    Request a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white font-semibold px-8 h-12">
                  <Link href="/login">
                    Explore Live Demo
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-5">
                No commitment required for demo access · Full platform walkthrough available
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
