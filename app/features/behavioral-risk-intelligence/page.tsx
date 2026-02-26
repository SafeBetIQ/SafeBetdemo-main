'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  Activity,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Eye,
  Zap,
  Shield,
  BarChart3,
  Clock,
  Target,
  Users,
  Fingerprint,
  Gauge,
  ScanLine,
  Network,
  CheckCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const capabilities = [
  {
    icon: Brain,
    title: 'Persona Shift Detection',
    description: 'AI identifies when a player\'s behavior diverges from their established patterns, flagging sudden changes in betting amounts, session duration, or game type preferences.',
    stat: '94%',
    statLabel: 'Detection Accuracy',
  },
  {
    icon: Gauge,
    title: 'Cognitive Fatigue Index',
    description: 'Proprietary algorithm measures decision-making degradation over time, detecting when players are no longer making rational choices due to fatigue or emotional distress.',
    stat: 'Real-time',
    statLabel: 'Monitoring',
  },
  {
    icon: Zap,
    title: 'Impulse vs Intention Analysis',
    description: 'Distinguishes between planned gambling activity and impulsive behavior by analyzing deposit patterns, bet timing, and session frequency against historical baselines.',
    stat: '87%',
    statLabel: 'Impulse Identification',
  },
  {
    icon: ScanLine,
    title: 'Session Pattern Profiling',
    description: 'Builds comprehensive behavioral profiles for each player by tracking session lengths, break patterns, deposit-to-loss ratios, and time-of-day activity clusters.',
    stat: '150+',
    statLabel: 'Behavioral Signals',
  },
  {
    icon: Network,
    title: 'Multi-Signal Risk Scoring',
    description: 'Combines financial, behavioral, temporal, and contextual signals into a unified risk score that adapts dynamically as new data becomes available.',
    stat: '12',
    statLabel: 'Risk Dimensions',
  },
  {
    icon: Target,
    title: 'Predictive Harm Prevention',
    description: 'Machine learning models predict potential harm up to 48 hours before critical events, enabling casinos to intervene before damage occurs rather than after.',
    stat: '48hrs',
    statLabel: 'Early Warning',
  },
];

const riskTimeline = [
  { time: '09:00', score: 22, label: 'Low Risk', color: 'text-green-400' },
  { time: '11:30', score: 35, label: 'Normal', color: 'text-green-400' },
  { time: '14:00', score: 48, label: 'Elevated', color: 'text-yellow-400' },
  { time: '16:45', score: 67, label: 'High', color: 'text-orange-400' },
  { time: '18:30', score: 82, label: 'Critical', color: 'text-red-400' },
  { time: '19:00', score: 45, label: 'Intervention', color: 'text-brand-400' },
];

const complianceFeatures = [
  'National Gambling Act (NGA) aligned risk thresholds',
  'NRGP contribution tracking and reporting',
  'Automated regulatory audit trail generation',
  'King IV ESG governance score integration',
  'Provincial licensing board compliance dashboards',
  'Self-exclusion registry cross-referencing',
];

export default function BehavioralRiskIntelligencePage() {
  const [activeRiskIndex, setActiveRiskIndex] = useState(0);
  const [liveScore, setLiveScore] = useState(34);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRiskIndex(prev => (prev + 1) % riskTimeline.length);
    }, 2500);

    const scoreInterval = setInterval(() => {
      setLiveScore(prev => {
        const change = Math.floor(Math.random() * 8) - 3;
        return Math.max(15, Math.min(95, prev + change));
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(scoreInterval);
    };
  }, []);

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-green-400';
    if (score < 50) return 'text-yellow-400';
    if (score < 70) return 'text-orange-400';
    return 'text-red-400';
  };

  const getRiskBg = (score: number) => {
    if (score < 30) return 'bg-green-400/20 border-green-400/30';
    if (score < 50) return 'bg-yellow-400/20 border-yellow-400/30';
    if (score < 70) return 'bg-orange-400/20 border-orange-400/30';
    return 'bg-red-400/20 border-red-400/30';
  };

  return (
    <div className="min-h-screen bg-black">
      <MainNavigation />

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.15, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Brain className="h-4 w-4 mr-2" />
                AI-Powered Behavioral Analysis
              </Badge>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Behavioral Risk
              <br />
              <span className="text-brand-400">Intelligence</span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Real-time AI that reads player behavior the way experienced floor managers do --
              but across thousands of players simultaneously, 24/7, with zero blind spots.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Link href="/contact">
                <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8 py-6 text-lg rounded-full transform hover:scale-105 transition-transform">
                  Request Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/technology">
                <Button size="lg" variant="outline" className="border-brand-400 bg-transparent text-brand-400 hover:bg-brand-400 hover:text-black px-8 py-6 text-lg rounded-full transform hover:scale-105 transition-transform">
                  View Technology
                </Button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <Card className="bg-gray-950 border-gray-800 overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-400 font-medium">Live Risk Monitor</span>
                  </div>
                  <Badge className={`${getRiskBg(liveScore)} text-sm`}>
                    <span className={getRiskColor(liveScore)}>Score: {liveScore}</span>
                  </Badge>
                </div>

                <div className="grid grid-cols-6 gap-2 md:gap-3">
                  {riskTimeline.map((point, i) => (
                    <motion.div
                      key={point.time}
                      className={`relative rounded-lg p-3 md:p-4 border transition-all ${
                        i === activeRiskIndex
                          ? 'bg-gray-900 border-brand-400/50 scale-105'
                          : 'bg-gray-900/50 border-gray-800'
                      }`}
                      animate={i === activeRiskIndex ? { scale: 1.05 } : { scale: 1 }}
                    >
                      <div className="text-[10px] md:text-xs text-gray-500 mb-1">{point.time}</div>
                      <div className={`text-lg md:text-2xl font-bold ${point.color}`}>{point.score}</div>
                      <div className="text-[10px] md:text-xs text-gray-500 mt-1">{point.label}</div>
                      {i === activeRiskIndex && (
                        <motion.div
                          className="absolute -top-1 -right-1 w-3 h-3 bg-brand-400 rounded-full"
                          animate={{ scale: [1, 1.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <Activity className="h-4 w-4 text-brand-400" />
                  <span>Simulated player risk journey over a single session</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Six Dimensions of <span className="text-brand-400">Behavioral Intelligence</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Our AI analyzes player behavior across multiple dimensions to build a comprehensive risk picture
              that no single metric could provide.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap, index) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="bg-gray-950 border-gray-800 hover:border-brand-400/40 transition-all h-full group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-400/10 flex items-center justify-center group-hover:bg-brand-400/20 transition-colors">
                        <cap.icon className="h-6 w-6 text-brand-400" />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{cap.stat}</div>
                        <div className="text-xs text-gray-500">{cap.statLabel}</div>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{cap.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{cap.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Eye className="h-4 w-4 mr-2" />
                How It Works
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                From Raw Data to <span className="text-brand-400">Actionable Insight</span>
              </h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                Our Behavioral Risk Intelligence engine processes hundreds of data points per player
                per session, transforming raw gambling activity into clear, prioritized risk assessments
                that your team can act on immediately.
              </p>

              <div className="space-y-6">
                {[
                  { step: '01', title: 'Ingest', desc: 'Session data, deposits, bets, and timing signals flow in real-time' },
                  { step: '02', title: 'Profile', desc: 'AI builds and continuously updates each player\'s behavioral baseline' },
                  { step: '03', title: 'Detect', desc: 'Anomalies and pattern shifts are identified against the baseline' },
                  { step: '04', title: 'Score', desc: 'Multi-dimensional risk score is calculated and prioritized' },
                  { step: '05', title: 'Alert', desc: 'Staff receive context-rich notifications with recommended actions' },
                ].map((item, i) => (
                  <motion.div
                    key={item.step}
                    className="flex items-start space-x-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-400/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-400 text-sm font-bold">{item.step}</span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-400">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="bg-gray-950 border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-6">
                    <Fingerprint className="h-5 w-5 text-brand-400" />
                    <span className="text-white font-semibold">Player Behavioral Profile</span>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: 'Session Consistency', value: 78, color: 'bg-green-400' },
                      { label: 'Deposit Regularity', value: 45, color: 'bg-yellow-400' },
                      { label: 'Loss Chasing Index', value: 82, color: 'bg-red-400' },
                      { label: 'Break Compliance', value: 34, color: 'bg-orange-400' },
                      { label: 'Self-Awareness Score', value: 61, color: 'bg-cyan-400' },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-400">{metric.label}</span>
                          <span className="text-sm text-white font-medium">{metric.value}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${metric.color} rounded-full`}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${metric.value}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.3 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Overall Risk Assessment</span>
                      <Badge className="bg-orange-400/20 text-orange-400 border-orange-400/30">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Elevated
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Recommended: Trigger cooling-off prompt at next natural session break
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-gray-950 border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Shield className="h-5 w-5 text-brand-400" />
                    <span className="text-white font-semibold">SA Regulatory Compliance</span>
                  </div>
                  <div className="space-y-3">
                    {complianceFeatures.map((feature, i) => (
                      <motion.div
                        key={i}
                        className="flex items-center space-x-3"
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <CheckCircle className="h-4 w-4 text-brand-400 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Shield className="h-4 w-4 mr-2" />
                Built for South Africa
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Compliance <span className="text-brand-400">by Design</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                Every aspect of our Behavioral Risk Intelligence is designed around South African
                gambling regulations. From National Gambling Act thresholds to NRGP contribution
                tracking, compliance isn't an add-on -- it's the foundation.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Our platform automatically generates audit-ready documentation and maintains
                comprehensive logs that satisfy both provincial licensing boards and the
                National Gambling Board's oversight requirements.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              The Numbers <span className="text-brand-400">Speak</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '150+', label: 'Behavioral Signals Tracked', icon: Activity },
              { value: '94%', label: 'Risk Detection Accuracy', icon: Target },
              { value: '<2s', label: 'Average Alert Latency', icon: Clock },
              { value: '48hr', label: 'Predictive Warning Window', icon: TrendingUp },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="bg-gray-950 border-gray-800 hover:border-brand-400/40 transition-all">
                  <CardContent className="p-6 text-center">
                    <stat.icon className="h-8 w-8 text-brand-400 mx-auto mb-3" />
                    <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
                    <div className="text-sm text-gray-400">{stat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your <span className="text-brand-400">Player Protection?</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              See how Behavioral Risk Intelligence can help your casino protect players,
              maintain compliance, and build trust -- all powered by AI that never sleeps.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8 py-6 text-lg rounded-full">
                  Schedule a Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/features/casinos">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-900 px-8 py-6 text-lg rounded-full">
                  Explore All Casino Features
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
