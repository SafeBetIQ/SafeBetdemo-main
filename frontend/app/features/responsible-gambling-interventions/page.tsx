'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ArrowRight, CircleCheck as CheckCircle, Bell, Zap, Clock, Target, Shield, ChartBar as BarChart3, Users, TriangleAlert as AlertTriangle, Phone, Mail, Activity, TrendingDown, RefreshCw, Eye, FileText, ChevronRight, Heart, Settings, Lock, Globe } from 'lucide-react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const CHANNELS = [
  {
    icon: Phone,
    name: 'WhatsApp',
    description: 'Instant, personalised messages delivered directly to the player\'s phone with read receipts and response tracking.',
    badge: 'Highest Open Rate',
    badgeColor: 'bg-green-500/10 text-green-400 border-green-500/20',
    stat: '98%',
    statLabel: 'Open Rate',
  },
  {
    icon: Mail,
    name: 'Email',
    description: 'Rich-format emails with embedded resources, self-exclusion links, and full audit trail for compliance.',
    badge: 'Full Audit Trail',
    badgeColor: 'bg-brand-400/10 text-brand-400 border-brand-400/20',
    stat: '100%',
    statLabel: 'Logged',
  },
  {
    icon: MessageSquare,
    name: 'SMS',
    description: 'Short, direct messages for time-sensitive interventions when players are mid-session on mobile.',
    badge: 'Instant Delivery',
    badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    stat: '<3s',
    statLabel: 'Delivery Time',
  },
  {
    icon: Globe,
    name: 'In-Platform',
    description: 'Pop-up notifications and banners displayed directly within the gaming interface at the moment of risk.',
    badge: 'Zero Latency',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    stat: '0ms',
    statLabel: 'Delay',
  },
];

const TRIGGER_TYPES = [
  {
    icon: Activity,
    title: 'Risk Score Threshold',
    description: 'Automatically trigger when a player\'s AI risk score crosses configurable thresholds (e.g., 65+, 80+).',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Clock,
    title: 'Session Duration',
    description: 'Flag players who exceed healthy session lengths — 2 hours, 4 hours, or custom casino-defined limits.',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
  },
  {
    icon: TrendingDown,
    title: 'Loss Velocity',
    description: 'Detect rapid loss accumulation within a session and intervene before the spiral deepens.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: RefreshCw,
    title: 'Deposit Frequency',
    description: 'Alert when players make multiple deposits in short windows — a key chasing-losses signal.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    icon: AlertTriangle,
    title: 'Behavioral Pattern Shift',
    description: 'AI detects sudden changes in bet sizing, game type, or visit frequency that signal problem behaviour.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  {
    icon: Users,
    title: 'Manual Staff Trigger',
    description: 'Compliance staff can manually trigger interventions after reviewing player profiles or customer interactions.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
];

const OUTCOMES = [
  { label: 'Intervention Success Rate', value: '73%', sub: 'Players who reduce risk after contact' },
  { label: 'Avg. Response Time', value: '<2min', sub: 'From trigger to message delivery' },
  { label: 'Audit Compliance', value: '100%', sub: 'Every intervention fully logged' },
  { label: 'Self-Exclusions Prevented', value: '41%', sub: 'Cases resolved before exclusion needed' },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'AI Detects Risk Signal',
    description: 'The SafeBet IQ engine continuously monitors all active player sessions, scoring behavioural signals in real time.',
  },
  {
    step: '02',
    title: 'Threshold Crossed',
    description: 'When a player\'s composite risk score or specific trigger condition is met, the intervention engine activates.',
  },
  {
    step: '03',
    title: 'Message Personalised & Sent',
    description: 'A tailored, empathetic message is generated from your template library and delivered across the configured channel.',
  },
  {
    step: '04',
    title: 'Response Tracked & Logged',
    description: 'Player response, read status, and follow-up actions are captured and stored in the compliance audit trail.',
  },
];

export default function ResponsibleGamblingInterventionsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-400/8 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20 px-4 py-2">
              <MessageSquare className="h-4 w-4 mr-2" />
              Responsible Gambling Interventions
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              Reach At-Risk Players{' '}
              <span className="text-brand-400">Before Harm Occurs</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              SafeBet IQ fires personalised, multi-channel interventions the moment AI detects a risk signal —
              WhatsApp, SMS, email, or in-platform. Every message logged. Every outcome tracked.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-10 py-6 text-base">
                  See a Live Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-brand-400 hover:text-brand-400 px-10 py-6 text-base">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Outcome Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {OUTCOMES.map((item, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-brand-400 mb-1">{item.value}</div>
                <div className="text-white font-semibold text-sm mb-1">{item.label}</div>
                <div className="text-gray-500 text-xs">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery Channels */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-teal-500/10 text-teal-400 border-teal-500/20">
              <Zap className="h-4 w-4 mr-2" />
              Multi-Channel Delivery
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Reach Players Where They Are
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Configure one or multiple delivery channels per intervention type.
              Each message is personalised, compliant, and fully audited.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CHANNELS.map((channel, i) => (
              <Card key={i} className="bg-gray-900/40 border-gray-800 hover:border-brand-400/30 transition-all duration-200 group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-brand-400/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-400/20 transition-colors">
                    <channel.icon className="h-6 w-6 text-brand-400" />
                  </div>
                  <Badge className={`mb-3 text-xs px-2 py-1 ${channel.badgeColor}`}>
                    {channel.badge}
                  </Badge>
                  <h3 className="text-xl font-bold text-white mb-2">{channel.name}</h3>
                  <p className="text-gray-400 text-sm mb-5">{channel.description}</p>
                  <div className="border-t border-gray-800 pt-4">
                    <div className="text-2xl font-bold text-white">{channel.stat}</div>
                    <div className="text-xs text-gray-500">{channel.statLabel}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trigger Conditions */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/20">
              <Bell className="h-4 w-4 mr-2" />
              Intelligent Trigger Engine
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              The Right Intervention at the Right Moment
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Six distinct trigger types ensure interventions fire on the signals that matter —
              not noise, not guesswork.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRIGGER_TYPES.map((trigger, i) => (
              <Card key={i} className="bg-gray-900/40 border-gray-800 hover:border-gray-700 transition-all duration-200">
                <CardContent className="p-6">
                  <div className={`w-11 h-11 ${trigger.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <trigger.icon className={`h-5 w-5 ${trigger.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{trigger.title}</h3>
                  <p className="text-gray-400 text-sm">{trigger.description}</p>
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
            <Badge className="mb-4 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
              <Settings className="h-4 w-4 mr-2" />
              How It Works
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              From Signal to Outcome in Under 2 Minutes
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              A fully automated pipeline from AI detection to player contact — with compliance built in at every step.
            </p>
          </div>

          <div className="space-y-6">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-14 h-14 bg-brand-400/10 border border-brand-400/20 rounded-xl flex items-center justify-center">
                  <span className="text-brand-400 font-bold text-lg">{step.step}</span>
                </div>
                <div className="flex-1 bg-gray-900/40 border border-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="absolute ml-7 mt-14 w-px h-6 bg-brand-400/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance & Audit */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Shield className="h-4 w-4 mr-2" />
                Compliance Ready
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6">
                Every Intervention Logged for Regulators
              </h2>
              <p className="text-gray-400 mb-8">
                SafeBet IQ captures the complete lifecycle of every intervention — trigger reason,
                message content, delivery timestamp, player response, and follow-up outcome.
                Regulators get a transparent, tamper-evident audit trail on demand.
              </p>
              <ul className="space-y-4">
                {[
                  'Trigger reason with AI signal breakdown',
                  'Message content and channel used',
                  'Delivery timestamp and read receipt',
                  'Player response and follow-up action',
                  'Outcome classification (resolved, escalated, exclusion)',
                  'Staff override notes and manual triggers',
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
                <span className="text-brand-400 text-sm font-semibold">Live Intervention Log</span>
              </div>
              {[
                { time: '14:32:07', player: 'PL-00491', channel: 'WhatsApp', trigger: 'Risk Score 84', status: 'Delivered', statusColor: 'text-green-400' },
                { time: '14:29:51', player: 'PL-01882', channel: 'Email', trigger: 'Session 4.2hrs', status: 'Opened', statusColor: 'text-teal-400' },
                { time: '14:25:18', player: 'PL-00234', channel: 'SMS', trigger: 'Loss Velocity', status: 'Responded', statusColor: 'text-brand-400' },
                { time: '14:22:04', player: 'PL-03341', channel: 'WhatsApp', trigger: 'Deposit x3', status: 'Delivered', statusColor: 'text-green-400' },
                { time: '14:18:33', player: 'PL-00718', channel: 'In-Platform', trigger: 'Risk Score 71', status: 'Shown', statusColor: 'text-cyan-400' },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                  <span className="text-gray-600 text-xs font-mono w-16 flex-shrink-0">{row.time}</span>
                  <span className="text-gray-400 text-xs w-20 flex-shrink-0">{row.player}</span>
                  <span className="text-white text-xs w-24 flex-shrink-0">{row.channel}</span>
                  <span className="text-gray-400 text-xs flex-1">{row.trigger}</span>
                  <span className={`text-xs font-semibold ${row.statusColor}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
            <Heart className="h-4 w-4 mr-2" />
            Protect Your Players
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Automate Responsible Gambling?
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Join operators across South Africa who trust SafeBet IQ to intervene at the right moment,
            protect their players, and stay ahead of regulatory requirements.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-10 py-6">
                Book a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features/casinos">
              <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-brand-400 hover:text-brand-400 px-10 py-6">
                All Casino Features
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
