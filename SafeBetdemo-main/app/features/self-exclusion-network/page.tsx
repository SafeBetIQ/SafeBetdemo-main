'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowRight, CircleCheck as CheckCircle, Lock, TriangleAlert as AlertTriangle, Users, Network, Zap, Eye, Clock, Globe, Database, FileText, ChevronRight, Ban, Bell, Activity, RefreshCw, Building2 } from 'lucide-react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const EXCLUSION_FEATURES = [
  {
    icon: Globe,
    title: 'National Network Coverage',
    description: 'When a player self-excludes at any operator on the network, that exclusion is immediately propagated to all participating casinos.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Clock,
    title: 'Real-Time Breach Detection',
    description: 'If a self-excluded player attempts to log in or enter any participating venue, an instant alert fires to the operator and compliance team.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: RefreshCw,
    title: 'Automatic Re-Enrolment Prevention',
    description: 'AI cross-references new registrations against the exclusion register — blocking re-enrolment under the same identity.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: FileText,
    title: 'Compliance Audit Trail',
    description: 'Every exclusion, breach attempt, and enforcement action is logged with full timestamps for regulator submission.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Database,
    title: 'Multi-Identity Matching',
    description: 'SafeBet IQ matches players across name variations, ID numbers, and email patterns to prevent workaround re-registrations.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Eye,
    title: 'Regulator Exclusion Dashboard',
    description: 'Provincial and national regulators have a live view of exclusion volumes, breach attempts, and operator compliance rates.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
];

const EXCLUSION_TYPES = [
  {
    title: 'Player-Initiated',
    description: 'The player voluntarily requests exclusion through the casino interface, mobile app, or via a customer service call. Immediate activation.',
    duration: '6 months to lifetime',
    icon: Users,
  },
  {
    title: 'Operator-Mandated',
    description: 'The casino compliance team mandates exclusion following an AI risk alert, failed intervention, or staff observation.',
    duration: 'Operator-defined period',
    icon: Building2,
  },
  {
    title: 'Regulator-Ordered',
    description: 'A provincial or national regulator issues a formal exclusion order, applied immediately across the entire network.',
    duration: 'Regulator-defined period',
    icon: Shield,
  },
  {
    title: 'Court-Ordered',
    description: 'Judicial exclusion orders are logged and enforced at the network level with additional compliance documentation.',
    duration: 'As per court order',
    icon: Lock,
  },
];

const STATS = [
  { value: '100%', label: 'Network Coverage', sub: 'Every participating operator enforces' },
  { value: '<1s', label: 'Propagation Speed', sub: 'Exclusion active across all venues' },
  { value: '99.8%', label: 'Breach Prevention Rate', sub: 'Detected before access granted' },
  { value: '3yr', label: 'Record Retention', sub: 'Full exclusion history stored' },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Exclusion Registered',
    description: 'Player self-excludes or is excluded by operator/regulator. Record is created with identity, duration, and reason.',
  },
  {
    step: '02',
    title: 'Network Broadcast',
    description: 'The exclusion record is immediately broadcast to all network participants — no manual steps required.',
  },
  {
    step: '03',
    title: 'All Venues Enforce',
    description: 'Every casino on the network automatically blocks the player at login, registration, and on-site verification.',
  },
  {
    step: '04',
    title: 'Breach Attempts Alerted',
    description: 'Any attempt to access a gambling service triggers an instant alert, a log entry, and escalation to compliance.',
  },
  {
    step: '05',
    title: 'Regulator Notified',
    description: 'Breach attempts and enforcement actions are automatically included in compliance reports for regulators.',
  },
  {
    step: '06',
    title: 'Reinstatement Process',
    description: 'When the exclusion period ends, controlled reinstatement requires operator sign-off and cooling-off confirmation.',
  },
];

export default function SelfExclusionNetworkPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/6 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-brand-500/10 text-brand-400 border-brand-500/20 px-4 py-2">
              <Ban className="h-4 w-4 mr-2" />
              Self-Exclusion Network
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              One Exclusion.{' '}
              <span className="text-brand-400">Every Casino Enforces It.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              SafeBet IQ's self-exclusion network ensures that when a player requests exclusion —
              or when one is mandated — that exclusion is enforced in real time across every
              participating operator, with zero gaps.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-10 py-6 text-base">
                  Join the Network
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-orange-500 hover:text-brand-400 px-10 py-6 text-base">
                  View Exclusion Dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-brand-400 mb-1">{s.value}</div>
                <div className="text-white font-semibold text-sm mb-1">{s.label}</div>
                <div className="text-gray-500 text-xs">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-red-500/10 text-red-400 border-red-500/20">
                <AlertTriangle className="h-4 w-4 mr-2" />
                The Problem with Siloed Exclusions
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6">
                Exclusion at One Casino Means Nothing If Others Don't Know
              </h2>
              <p className="text-gray-400 mb-6">
                Traditionally, self-exclusion is managed per-operator — a player excluded from Casino A can walk
                straight into Casino B the same day. This is not responsible gambling. It's a compliance gap
                that costs lives and creates enormous regulatory liability.
              </p>
              <p className="text-gray-400 mb-8">
                SafeBet IQ closes this gap permanently with a shared, real-time exclusion network that
                treats exclusion as a network-wide state, not an individual operator record.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <div className="text-red-400 font-bold mb-2">Without SafeBet IQ</div>
                  <ul className="text-gray-400 text-sm space-y-2">
                    <li className="flex gap-2"><span className="text-red-400">x</span> Exclusions are per-casino only</li>
                    <li className="flex gap-2"><span className="text-red-400">x</span> No cross-venue enforcement</li>
                    <li className="flex gap-2"><span className="text-red-400">x</span> Manual breach detection</li>
                    <li className="flex gap-2"><span className="text-red-400">x</span> Paper records and delays</li>
                  </ul>
                </div>
                <div className="bg-brand-400/5 border border-brand-400/20 rounded-xl p-4">
                  <div className="text-brand-400 font-bold mb-2">With SafeBet IQ</div>
                  <ul className="text-gray-400 text-sm space-y-2">
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> Network-wide enforcement</li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> Real-time breach detection</li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> Automated alerts</li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> Full compliance audit trail</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 text-sm font-semibold">Breach Attempt Monitor</span>
              </div>
              {[
                { time: '15:44:22', player: 'PL-00219', venue: 'Highveld Entertainment Complex', status: 'BLOCKED', excluded: '18 Jan 2026', color: 'text-red-400' },
                { time: '15:38:11', player: 'PL-01043', venue: 'Crown & Sceptre Casino', status: 'BLOCKED', excluded: '2 Feb 2026', color: 'text-red-400' },
                { time: '15:22:50', player: 'PL-00688', venue: 'Harbour Lights Casino', status: 'BLOCKED', excluded: '15 Dec 2025', color: 'text-red-400' },
                { time: '15:09:34', player: 'PL-02271', venue: 'Apex Gaming Resort', status: 'BLOCKED', excluded: '5 Mar 2026', color: 'text-red-400' },
                { time: '14:55:18', player: 'PL-00441', venue: 'Coastline Casino & Entertainment', status: 'ALERTED', excluded: '11 Jan 2026', color: 'text-brand-400' },
              ].map((row, i) => (
                <div key={i} className="py-3 border-b border-gray-800 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs font-mono">{row.time}</span>
                      <span className="text-gray-400 text-xs">{row.player}</span>
                    </div>
                    <span className={`text-xs font-bold ${row.color}`}>{row.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs">{row.venue}</span>
                    <span className="text-gray-600 text-xs">Excluded: {row.excluded}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <Shield className="h-4 w-4 mr-2" />
              Network Capabilities
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Complete Exclusion Lifecycle Management
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              From the moment of exclusion registration to breach prevention and reinstatement — every step covered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXCLUSION_FEATURES.map((feature, i) => (
              <Card key={i} className="bg-gray-900/40 border-gray-800 hover:border-orange-500/30 transition-all duration-200 group">
                <CardContent className="p-6">
                  <div className={`w-11 h-11 ${feature.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <feature.icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Exclusion Types */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-500/10 text-brand-400 border-brand-500/20">
              <Ban className="h-4 w-4 mr-2" />
              Exclusion Types
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Four Pathways, One Unified Network
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              SafeBet IQ supports all forms of exclusion — player-initiated, operator-mandated, regulator-ordered, and court-ordered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {EXCLUSION_TYPES.map((type, i) => (
              <Card key={i} className="bg-gray-900/40 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="p-6">
                  <div className="w-11 h-11 bg-brand-500/10 rounded-xl flex items-center justify-center mb-4">
                    <type.icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{type.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{type.description}</p>
                  <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-500">Duration: </span>
                    <span className="text-xs text-brand-400 font-semibold">{type.duration}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-500/10 text-brand-400 border-brand-500/20">
              <Activity className="h-4 w-4 mr-2" />
              The Process
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Exclusion to Enforcement in Six Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROCESS_STEPS.map((step, i) => (
              <div key={i} className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
                <div className="text-4xl font-bold text-brand-400/20 mb-3">{step.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-brand-500/10 text-brand-400 border-brand-500/20">
            <Lock className="h-4 w-4 mr-2" />
            Close the Gap
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Make Self-Exclusion Actually Work
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Join South Africa's cross-operator self-exclusion network and ensure that when a player
            asks for help, every casino in the network honours that request.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-10 py-6">
                Join the Network
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features/cross-operator-intelligence">
              <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-orange-500 hover:text-brand-400 px-10 py-6">
                Cross-Operator Intelligence
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
