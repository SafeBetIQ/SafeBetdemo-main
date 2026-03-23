'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, MessageSquare, Activity, CircleCheck as CheckCircle, ArrowRight, TrendingUp, TriangleAlert as AlertTriangle, Clock, ChartBar as BarChart3, Bell, Zap, Lock, Eye, FileText, Heart, Brain, Globe, Database, Layers, ChevronRight, Star, Building2, Award, Target, Cpu, ChartLine as LineChart, PlugZap, ShieldCheck, UserCheck, Gauge } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const FEATURES = [
  {
    icon: Activity,
    title: 'Real-Time Risk Monitoring',
    description:
      'Our AI engine analyzes 8+ behavioral indicators live, scoring every player from 0–100 across sessions, bet sizing, loss ratios, and visit frequency.',
    features: [
      'Live player risk scoring',
      'Automatic behavioral flagging',
      'Multi-signal correlation engine',
      'Session time pattern detection',
    ],
    color: 'from-brand-400 to-teal-500',
    accent: 'brand',
  },
  {
    icon: Brain,
    title: 'Nova IQ — Explainable AI',
    description:
      'Every risk decision is fully auditable. Nova IQ surfaces exactly which signals drove a score — providing transparent, regulator-ready explainability.',
    features: [
      'Signal-level attribution',
      'Decision audit trail',
      'Regulator-ready XAI reports',
      'Confidence scoring per signal',
    ],
    color: 'from-cyan-500 to-teal-400',
    accent: 'cyan',
  },
  {
    icon: MessageSquare,
    title: 'Automated Interventions',
    description:
      'Reach at-risk players instantly via WhatsApp, SMS, or email. Personalised responsible gaming messages fire automatically when thresholds are crossed.',
    features: [
      'Multi-channel delivery',
      'Template & tone library',
      'Automated trigger rules',
      'Response & outcome tracking',
    ],
    color: 'from-brand-400 to-brand-600',
    accent: 'brand',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Track player risk distribution, session trends, wagering patterns, and intervention effectiveness through a single, unified operator view.',
    features: [
      'Risk cohort distribution',
      'Trend & velocity analysis',
      'Intervention ROI tracking',
      'Revenue sustainability insights',
    ],
    color: 'from-teal-500 to-cyan-400',
    accent: 'teal',
  },
  {
    icon: FileText,
    title: 'Compliance Reporting',
    description:
      'Generate regulator-ready PDF reports on demand, with complete audit trails, intervention logs, and risk assessment data for any date range.',
    features: [
      'One-click PDF generation',
      'Full intervention audit log',
      'Exportable compliance data',
      'Custom date range filtering',
    ],
    color: 'from-brand-500 to-teal-500',
    accent: 'brand',
  },
  {
    icon: Clock,
    title: 'Session & Spend Controls',
    description:
      'Configure and enforce time limits, deposit caps, and cooling-off periods. Self-exclusion management is automated and fully audited.',
    features: [
      'Time & deposit limit enforcement',
      'Self-exclusion automation',
      'Cooling-off period workflows',
      'Player-initiated controls',
    ],
    color: 'from-cyan-500 to-brand-400',
    accent: 'cyan',
  },
];

const MODULES = [
  {
    icon: Globe,
    title: 'SafePlay Connect',
    description: 'REST API + webhooks for direct integration with your platform — Playtech, BetSoftware, Evolution, and more.',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    hoverBorder: 'hover:border-teal-500/40',
    features: ['REST API & webhooks', 'Native platform plugins', 'Real-time data sync', 'Sandbox test environment'],
  },
  {
    icon: UserCheck,
    title: 'Staff Management',
    description: 'Role-based access control, staff assignment workflows, and training mandate management for all employees.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
    border: 'border-brand-400/20',
    hoverBorder: 'hover:border-brand-400/40',
    features: ['Role-based access control', 'Staff assignment workflows', 'Training mandate tracking', 'Audit-ready activity logs'],
  },
  {
    icon: ShieldCheck,
    title: 'Self-Exclusion Network',
    description: 'Cross-operator self-exclusion sharing network, ensuring players excluded at one venue cannot access others.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    hoverBorder: 'hover:border-cyan-500/40',
    features: ['Cross-operator exclusion sync', 'Instant ban propagation', 'Regulator-linked registry', 'Re-entry attempt alerts'],
  },
  {
    icon: Cpu,
    title: 'GuardianLayer',
    description: 'Minor protection module detecting under-age gambling patterns and triggering immediate escalation protocols.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    hoverBorder: 'hover:border-orange-500/40',
    features: ['Age pattern detection', 'Behavioural anomaly flags', 'Instant escalation workflows', 'Supervisor alert system'],
  },
];

const BENEFITS = [
  {
    title: 'Full Regulatory Compliance',
    description:
      'Automatically satisfy all National Gambling Board and provincial authority requirements. Generate audit-ready reports at any time with zero manual effort.',
    icon: Shield,
    stat: '99.9%',
    statLabel: 'Compliance Rate',
  },
  {
    title: 'Protect Players & Sustain Revenue',
    description:
      'Early AI-driven intervention reduces harm while preserving engagement. Healthy players generate sustainable, long-term revenue for your operation.',
    icon: Heart,
    stat: '68%',
    statLabel: 'Harm Reduction',
  },
  {
    title: 'Operational Cost Savings',
    description:
      'Automate compliance monitoring, intervention workflows, and reporting. Eliminate thousands of hours of manual oversight each year.',
    icon: TrendingUp,
    stat: '40%',
    statLabel: 'Ops Cost Saved',
  },
  {
    title: 'Enterprise-Grade Security',
    description:
      'Bank-level AES-256 encryption, full POPIA compliance, and a 99.99% uptime SLA. Your player data is always protected and always available.',
    icon: Lock,
    stat: '99.99%',
    statLabel: 'Uptime SLA',
  },
];

const INTEGRATIONS = [
  'Playtech', 'BetSoftware', 'Evolution Gaming', 'SoftSwiss', 'Altenar', 'WhatsApp Business', 'Twilio SMS', 'NRGP', 'SafePlay Connect'
];

const RISK_FACTORS = [
  { label: 'Visit Frequency', value: 20, max: 20, color: 'bg-brand-400' },
  { label: 'Bet Size Escalation', value: 22, max: 25, color: 'bg-teal-400' },
  { label: 'Session Duration', value: 18, max: 20, color: 'bg-cyan-400' },
  { label: 'Loss Ratio', value: 20, max: 25, color: 'bg-brand-500' },
  { label: 'Behavioral Flags', value: 13, max: 15, color: 'bg-teal-500' },
];

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = target / 50;
          const timer = setInterval(() => {
            start += step;
            if (start >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 30);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-4xl font-bold text-brand-400 mb-1">
      {count}{suffix}
    </div>
  );
}

export default function CasinosPage() {
  const [activeFeature, setActiveFeature] = useState(-1);
  const [riskScore, setRiskScore] = useState(73);
  const [liveStats, setLiveStats] = useState({ players: 1347, interventions: 218 });

  useEffect(() => {
    const riskTimer = setInterval(() => {
      setRiskScore(prev => Math.max(55, Math.min(92, prev + Math.floor(Math.random() * 10) - 5)));
    }, 3000);
    const statsTimer = setInterval(() => {
      setLiveStats({
        players: Math.floor(Math.random() * 500) + 1200,
        interventions: Math.floor(Math.random() * 100) + 180,
      });
    }, 2500);
    return () => { clearInterval(riskTimer); clearInterval(statsTimer); };
  }, []);

  const riskColor =
    riskScore > 80 ? { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'CRITICAL RISK' } :
    riskScore > 65 ? { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'HIGH RISK' } :
    { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'MEDIUM RISK' };

  return (
    <div className="min-h-screen bg-black">
      <MainNavigation />

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-400/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(137,216,72,0.04)_0%,transparent_60%)]" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20 px-4 py-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 mr-2" />
                  For Casino Operators
                </Badge>
              </motion.div>

              <motion.h1
                className="text-5xl md:text-6xl font-bold text-white mb-6 leading-[1.08]"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                Protect Players.
                <br />
                <span className="text-brand-400">Secure Your License.</span>
                <br />
                <span className="text-gray-300 text-4xl md:text-5xl">Grow Responsibly.</span>
              </motion.h1>

              <motion.p
                className="text-lg text-gray-400 mb-10 leading-relaxed max-w-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                SafePlay gives casino operators a complete AI-powered responsible gambling platform — real-time behavioral risk scoring, automated interventions, explainable AI, and full regulatory compliance for South African gaming authorities.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
              >
                <Link href="/contact">
                  <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8 py-6 text-base rounded-full transition-all hover:scale-105">
                    Request a Demo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/casino/dashboard">
                  <Button size="lg" variant="outline" className="border-gray-700 bg-transparent text-gray-300 hover:border-brand-400 hover:text-brand-400 px-8 py-6 text-base rounded-full transition-all">
                    View Live Dashboard
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                className="flex items-center gap-6 mt-10 pt-10 border-t border-gray-800"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                {[
                  { label: 'Active Players', value: liveStats.players, suffix: '+', animate: true },
                  { label: 'Interventions Today', value: liveStats.interventions, suffix: '+', animate: true },
                  { label: 'Compliance Rate', value: '99.9%', animate: false },
                ].map((stat, i) => (
                  <div key={i} className="text-center flex-1">
                    {stat.animate ? (
                      <motion.div
                        key={stat.value}
                        className="text-2xl font-bold text-brand-400"
                        initial={{ scale: 1.15, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        {stat.value}{stat.suffix}
                      </motion.div>
                    ) : (
                      <div className="text-2xl font-bold text-brand-400">{stat.value}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Live Risk Panel */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <Card className="bg-gray-950/80 border-gray-800 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm font-medium text-gray-400">SafeBet IQ — Live Risk Engine</span>
                    <motion.div
                      className="flex items-center gap-2 text-xs text-brand-400"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-400 inline-block" />
                      LIVE
                    </motion.div>
                  </div>

                  <motion.div
                    className={`text-center p-6 rounded-xl border mb-6 transition-colors duration-500 ${riskColor.bg} ${riskColor.border}`}
                  >
                    <motion.div
                      className="text-7xl font-bold text-white mb-2"
                      key={riskScore}
                      initial={{ scale: 1.15, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {riskScore}
                    </motion.div>
                    <div className="text-xs text-gray-400 mb-2">Risk Score / 100</div>
                    <Badge className={`${riskColor.bg} ${riskColor.text} border-0 font-semibold tracking-wider text-xs px-3 py-1`}>
                      {riskColor.label}
                    </Badge>
                  </motion.div>

                  <div className="space-y-3 mb-6">
                    {RISK_FACTORS.map((factor, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">{factor.label}</span>
                          <span className="text-gray-300 font-medium">{factor.value}/{factor.max}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className={`${factor.color} h-1.5 rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(factor.value / factor.max) * 100}%` }}
                            transition={{ duration: 0.9, delay: i * 0.08, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <motion.div
                    className="p-4 bg-orange-500/8 border border-orange-500/20 rounded-lg"
                    animate={{ opacity: [1, 0.85, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    <div className="flex items-start gap-3">
                      <Bell className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-orange-400 mb-1">AI Recommends</div>
                        <ul className="text-xs text-gray-400 space-y-1">
                          <li>• Send WhatsApp responsible gaming message</li>
                          <li>• Apply 60-min session warning</li>
                          <li>• Flag for supervisor review</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── INTEGRATION STRIP ── */}
      <section className="py-6 px-6 border-y border-gray-800/60 bg-gray-950/40">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <span className="text-xs text-gray-600 font-medium uppercase tracking-widest mr-4">Integrates with</span>
            {INTEGRATIONS.map((name, i) => (
              <span key={i} className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-default font-medium">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Layers className="h-3.5 w-3.5 mr-2" />
                Core Platform
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
                Complete Casino Compliance Suite
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Every tool you need to protect players, automate compliance, and maintain your gaming license — in one integrated platform.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                whileHover={{ y: -6 }}
                onHoverStart={() => setActiveFeature(index)}
                onHoverEnd={() => setActiveFeature(-1)}
              >
                <Card className={`bg-gray-900/40 border-gray-800 hover:border-brand-400/40 transition-all h-full ${activeFeature === index ? 'shadow-lg shadow-brand-400/10' : ''}`}>
                  <CardContent className="p-7">
                    <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-5`}>
                      <feature.icon className="h-6 w-6 text-black" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-5">{feature.description}</p>
                    <div className="space-y-2">
                      {feature.features.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-brand-400 flex-shrink-0" />
                          <span className="text-gray-300">{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI EXPLAINABILITY DEEP DIVE ── */}
      <section className="py-24 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-6 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                <Zap className="h-4 w-4 mr-2" />
                SafeBet IQ Risk Engine
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
                Machine Learning That Explains Every Decision
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Our risk engine analyzes multiple behavioral dimensions simultaneously and surfaces not just a score — but a complete, auditable explanation of why that score was assigned. Every intervention is backed by explainable AI that regulators and operators can trust.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { label: 'Visit Frequency Analysis', value: '20% weight', icon: Activity },
                  { label: 'Bet Size Monitoring', value: '25% weight', icon: TrendingUp },
                  { label: 'Session Duration Tracking', value: '20% weight', icon: Clock },
                  { label: 'Loss Ratio Calculation', value: '25% weight', icon: LineChart },
                  { label: 'Behavioral Signal Flags', value: '10% weight', icon: AlertTriangle },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between p-4 bg-gray-900/60 border border-gray-800 rounded-xl hover:border-brand-400/30 transition-colors"
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.07 }}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 text-brand-400" />
                      <span className="text-gray-300 text-sm">{item.label}</span>
                    </div>
                    <Badge className="bg-brand-400/10 text-brand-400 border-0 text-xs">{item.value}</Badge>
                  </motion.div>
                ))}
              </div>

              <div className="flex items-center gap-4 p-4 bg-brand-400/5 border border-brand-400/20 rounded-xl">
                <Gauge className="h-8 w-8 text-brand-400 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold text-sm">Trained on 250,000+ player profiles</div>
                  <div className="text-gray-500 text-xs mt-0.5">Continuously improving via federated cross-operator learning</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              {/* XAI Card */}
              <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-white">Nova IQ — Explanation Layer</div>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border-0 text-xs">XAI Active</Badge>
                  </div>
                  <div className="space-y-3">
                    {[
                      { signal: 'Bet increase detected', weight: 'High', severity: 'text-red-400', bar: 'bg-red-500', pct: 88 },
                      { signal: 'Session > 4 hours', weight: 'High', severity: 'text-orange-400', bar: 'bg-orange-500', pct: 75 },
                      { signal: '3 consecutive losses', weight: 'Medium', severity: 'text-yellow-400', bar: 'bg-yellow-500', pct: 60 },
                      { signal: 'Late-night visit pattern', weight: 'Medium', severity: 'text-yellow-400', bar: 'bg-yellow-400', pct: 50 },
                    ].map((row, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-300 text-xs">{row.signal}</span>
                          <span className={`text-xs font-medium ${row.severity}`}>{row.weight}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className={`${row.bar} h-1.5 rounded-full`}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${row.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
                    Combined confidence score: <span className="text-brand-400 font-semibold">94.2%</span> — intervention recommended
                  </div>
                </CardContent>
              </Card>

              {/* Persona Shift Card */}
              <Card className="bg-gray-900/40 border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="h-5 w-5 text-cyan-400" />
                    <div className="text-sm font-semibold text-white">Behavioral Persona Detection</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Recreational', pct: 62, color: 'text-brand-400', bg: 'bg-brand-400' },
                      { label: 'At-Risk', pct: 24, color: 'text-orange-400', bg: 'bg-orange-500' },
                      { label: 'Problem', pct: 14, color: 'text-red-400', bg: 'bg-red-500' },
                    ].map((p, i) => (
                      <div key={i} className="text-center p-3 bg-gray-950/60 rounded-xl border border-gray-800">
                        <div className={`text-2xl font-bold ${p.color} mb-1`}>{p.pct}%</div>
                        <div className="text-xs text-gray-500">{p.label}</div>
                        <div className="w-full bg-gray-800 rounded-full h-1 mt-2 overflow-hidden">
                          <motion.div
                            className={`${p.bg} h-1 rounded-full`}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${p.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: i * 0.15 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── OPTIONAL MODULES ── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="mb-4 bg-teal-500/10 text-teal-400 border-teal-500/20">
                <PlugZap className="h-3.5 w-3.5 mr-2" />
                Add-On Modules
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-5">
                Extend Your Platform
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Layer on additional capabilities as your compliance requirements grow. Each module integrates seamlessly with the core platform.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {MODULES.map((mod, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
              >
                <Card className={`bg-gray-900/40 border-gray-800 ${mod.hoverBorder} hover:bg-gray-900/60 transition-all group h-full`}>
                  <CardContent className="p-7">
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-12 h-12 ${mod.bg} border ${mod.border} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <mod.icon className={`h-6 w-6 ${mod.color}`} />
                      </div>
                      <Badge className={`${mod.bg} ${mod.color} border-0 text-xs font-semibold`}>
                        Add-On
                      </Badge>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{mod.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-5">{mod.description}</p>
                    <div className="space-y-2 pt-4 border-t border-gray-800">
                      {mod.features.map((feat, fi) => (
                        <div key={fi} className="flex items-center gap-2 text-sm">
                          <CheckCircle className={`h-3.5 w-3.5 ${mod.color} flex-shrink-0`} />
                          <span className="text-gray-300">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS / WHY SAFEPLAY ── */}
      <section className="py-24 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-4xl font-bold text-white mb-5">
                Why Leading SA Casinos Choose SafePlay
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Proven results across South Africa's gaming industry
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BENEFITS.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="bg-gray-900/40 border-gray-800 hover:border-brand-400/30 transition-all h-full">
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 bg-brand-400/10 border border-brand-400/20 rounded-xl flex items-center justify-center">
                        <benefit.icon className="h-6 w-6 text-brand-400" />
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-brand-400">{benefit.stat}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{benefit.statLabel}</div>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{benefit.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STAT COUNTER STRIP ── */}
      <section className="py-20 px-6 border-y border-gray-800/60">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: 'Casino Operators', target: 50, suffix: '+' },
              { label: 'Players Protected', target: 250000, suffix: '+' },
              { label: 'Interventions Delivered', target: 45000, suffix: '+' },
              { label: 'Compliance Score', target: 99, suffix: '.9%' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                <div className="text-sm text-gray-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Target className="h-3.5 w-3.5 mr-2" />
                How It Works
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-5">
                From Integration to Protection in Days
              </h2>
            </motion.div>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-800 -translate-x-1/2" />
            <div className="space-y-12">
              {[
                {
                  step: '01',
                  title: 'Connect via SafePlay Connect API',
                  description: 'Integrate your gaming platform in as little as 3 days using our REST API, webhooks, or native plugins for leading platforms.',
                  icon: PlugZap,
                  side: 'left',
                },
                {
                  step: '02',
                  title: 'AI Begins Learning Your Player Base',
                  description: 'The risk engine ingests historical session data to establish behavioral baselines for every player before going live.',
                  icon: Brain,
                  side: 'right',
                },
                {
                  step: '03',
                  title: 'Real-Time Monitoring Activates',
                  description: 'Every session is scored in real-time. Alerts fire automatically when risk thresholds are crossed — no manual monitoring required.',
                  icon: Activity,
                  side: 'left',
                },
                {
                  step: '04',
                  title: 'Automated Interventions & Reporting',
                  description: 'WhatsApp, SMS, and email interventions deploy automatically. Compliance reports are always ready for regulators.',
                  icon: FileText,
                  side: 'right',
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className={`flex items-center gap-8 ${item.side === 'right' ? 'md:flex-row-reverse' : ''}`}
                  initial={{ opacity: 0, x: item.side === 'left' ? -24 : 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div className="flex-1">
                    <Card className="bg-gray-900/40 border-gray-800 hover:border-brand-400/30 transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-bold text-brand-400/60 tracking-widest">{item.step}</span>
                          <item.icon className="h-4 w-4 text-brand-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="hidden md:flex w-10 h-10 rounded-full bg-brand-400/10 border border-brand-400/30 items-center justify-center flex-shrink-0 z-10">
                    <span className="text-brand-400 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 hidden md:block" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(137,216,72,0.06)_0%,transparent_70%)]" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <Star className="h-3.5 w-3.5 mr-2" />
              Trusted by 50+ SA Operators
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Ready to Elevate Your
              <br />
              <span className="text-brand-400">Casino Compliance?</span>
            </h2>
            <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
              Join the operators across South Africa using SafePlay to protect players, satisfy regulators, and build a sustainable responsible gambling programme.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-10 py-6 text-base rounded-full transition-all hover:scale-105">
                  Schedule a Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/technology">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-brand-400 hover:text-brand-400 px-10 py-6 text-base rounded-full transition-all">
                  Explore Our AI Technology
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
