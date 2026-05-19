'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, ArrowRight, CircleCheck as CheckCircle, Network, Shield, TriangleAlert as AlertTriangle, Users, Zap, Database, Eye, Lock, TrendingUp, Building2, ChevronRight, Activity, Share2, Brain, ChartBar as BarChart3, Radio, Target } from 'lucide-react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const CAPABILITIES = [
  {
    icon: Network,
    title: 'Cross-Casino Risk Correlation',
    description: 'When a player shows high-risk behaviour at Casino A, SafeBet IQ immediately surfaces that intelligence to Casino B — before harm escalates.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: AlertTriangle,
    title: 'Multi-Operator Alert Propagation',
    description: 'Risk alerts, self-exclusion breaches, and intervention outcomes are shared across the operator network in real time.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Brain,
    title: 'Aggregated Behavioural Profiles',
    description: 'Player risk profiles are enriched with behaviour data from all consenting operators, giving each casino a fuller picture than they could build alone.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Database,
    title: 'National Pattern Recognition',
    description: 'Identify gambling harm trends at a national and provincial level — patterns no single operator could detect in isolation.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Shield,
    title: 'POPIA-Compliant Data Sharing',
    description: 'All intelligence sharing is governed by strict consent frameworks, anonymisation protocols, and POPIA-compliant data handling.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Target,
    title: 'Regulator Oversight Layer',
    description: 'Regulators receive aggregated intelligence without operator-specific identifiers — enabling oversight without compromising operator confidentiality.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Player Identified at Risk',
    description: 'A player crosses a risk threshold at any operator on the SafeBet IQ network. Their anonymised risk profile is updated.',
    icon: Activity,
  },
  {
    step: '02',
    title: 'Network Signal Broadcast',
    description: 'The risk signal is broadcast across the cross-operator intelligence layer — reaching all consenting network participants.',
    icon: Radio,
  },
  {
    step: '03',
    title: 'Other Operators Receive Alert',
    description: 'Casinos where the same player holds an account receive a contextual alert with the risk level, signal type, and recommended action.',
    icon: AlertTriangle,
  },
  {
    step: '04',
    title: 'Coordinated Response',
    description: 'Each operator can independently intervene, restrict, or escalate — with all actions logged and shared back to the network for outcome tracking.',
    icon: Shield,
  },
];

const NETWORK_STATS = [
  { value: '15+', label: 'Network Operators', sub: 'And growing across South Africa' },
  { value: '50k+', label: 'Players Monitored', sub: 'Across the shared network' },
  { value: '<500ms', label: 'Alert Propagation', sub: 'From trigger to all operators' },
  { value: '100%', label: 'POPIA Compliant', sub: 'Every data share governed' },
];

const BENEFITS = [
  {
    title: 'For Casino Operators',
    items: [
      'Catch problem gamblers who spread risk across multiple venues',
      'Enrich your player risk profiles with network-wide behaviour',
      'Reduce liability by acting on intelligence you\'d otherwise never have',
      'Demonstrate collaborative responsible gambling to regulators',
    ],
    color: 'text-brand-400',
    borderColor: 'border-brand-400/20',
    bgColor: 'bg-brand-400/5',
  },
  {
    title: 'For Regulators',
    items: [
      'National-level visibility of gambling harm patterns',
      'Evidence of cross-operator cooperation and compliance',
      'Aggregated data for policy decision-making',
      'Automated reports on network-wide intervention rates',
    ],
    color: 'text-brand-400',
    borderColor: 'border-brand-800',
    bgColor: 'bg-brand-900/40',
  },
];

export default function CrossOperatorIntelligencePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/20 via-black to-black" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-brand-900/40 text-brand-300 border border-brand-800 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              <Globe className="h-4 w-4 mr-2" />
              Cross-Operator Intelligence
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              One Network.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-500">Shared Intelligence.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              Problem gamblers don't stay at one casino. SafeBet IQ's cross-operator intelligence
              layer connects the dots across operators — sharing risk signals, alerts, and behavioural
              profiles in real time, while staying fully POPIA compliant.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-10 py-6 text-base">
                  Join the Network
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-10 py-6 text-base">
                  View Live Intelligence
                </Button>
              </Link>
            </div>
          </div>

          {/* Network Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {NETWORK_STATS.map((s, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-brand-400 mb-1">{s.value}</div>
                <div className="text-white font-semibold text-sm mb-1">{s.label}</div>
                <div className="text-gray-500 text-xs">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Network Diagram Visual */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
                <Share2 className="h-4 w-4 mr-2" />
                The Intelligence Network
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6">
                No Operator Can See the Full Picture Alone
              </h2>
              <p className="text-gray-400 mb-6">
                A player might appear low-risk at your casino but be chasing losses simultaneously at two others.
                Without cross-operator intelligence, you're making decisions with incomplete information.
              </p>
              <p className="text-gray-400 mb-8">
                SafeBet IQ solves this by creating a secure, anonymised intelligence layer that
                aggregates risk signals across operators — giving every participant a complete,
                network-enriched view of each player's true risk profile.
              </p>
              <ul className="space-y-3">
                {[
                  'See risk signals from other operators before acting',
                  'Share your intervention outcomes to help the network',
                  'Receive instant alerts when a self-excluded player is seen',
                  'Contribute to national gambling harm reduction data',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-brand-400 text-sm font-semibold">Live Network Alerts</span>
              </div>
              {[
                { casino: 'Atlantic Crest Casino', alert: 'Risk Score 87 — Player seen at 2 other operators', type: 'HIGH RISK', color: 'text-red-400' },
                { casino: 'Apex Gaming Resort', alert: 'Self-exclusion breach — same player at Goldfields Gaming', type: 'BREACH', color: 'text-orange-400' },
                { casino: 'Crown & Sceptre Casino', alert: 'Shared intervention: loss velocity confirmed cross-site', type: 'SHARED', color: 'text-brand-400' },
                { casino: 'Eastern Sands Casino', alert: 'Network alert: player active at 3 venues simultaneously', type: 'MULTI-SITE', color: 'text-yellow-400' },
                { casino: 'Coastline Casino & Entertainment', alert: 'Pattern match: identical bet sequences across 2 operators', type: 'PATTERN', color: 'text-brand-400' },
              ].map((row, i) => (
                <div key={i} className="py-3 border-b border-gray-800 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs font-semibold">{row.casino}</span>
                    <span className={`text-xs font-bold ${row.color}`}>{row.type}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{row.alert}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <Zap className="h-4 w-4 mr-2" />
              Intelligence Capabilities
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              What the Network Enables
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Six core capabilities that transform isolated operator data into a national responsible gambling intelligence network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((cap, i) => (
              <Card key={i} className="bg-gray-900/40 border-gray-800 hover:border-brand-500/30 transition-all duration-200 group">
                <CardContent className="p-6">
                  <div className={`w-11 h-11 ${cap.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <cap.icon className={`h-5 w-5 ${cap.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{cap.title}</h3>
                  <p className="text-gray-400 text-sm">{cap.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              <Network className="h-4 w-4 mr-2" />
              How It Works
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              From Single Operator to Network Intelligence
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              A four-step process that turns isolated risk signals into coordinated, network-wide protection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="bg-gray-900/40 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-brand-400/10 border border-brand-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    <step.icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <span className="text-brand-400 font-bold text-2xl">{step.step}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Split */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              <Building2 className="h-4 w-4 mr-2" />
              Who Benefits
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Better Outcomes for Operators and Regulators
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className={`${benefit.bgColor} border ${benefit.borderColor} rounded-2xl p-8`}>
                <h3 className={`text-2xl font-bold ${benefit.color} mb-6`}>{benefit.title}</h3>
                <ul className="space-y-4">
                  {benefit.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <CheckCircle className={`h-5 w-5 ${benefit.color} mt-0.5 flex-shrink-0`} />
                      <span className="text-gray-300 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
            <Globe className="h-4 w-4 mr-2" />
            Join the Network
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Protect Players Across the Entire Industry
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Every operator who joins the SafeBet IQ network strengthens protection for all.
            Become part of South Africa's leading responsible gambling intelligence network.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-10 py-6">
                Request Network Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features/self-exclusion-network">
              <Button size="lg" className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-10 py-6">
                Self-Exclusion Network
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
