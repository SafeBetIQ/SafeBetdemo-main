'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MainNavigation from '@/components/MainNavigation';
import { Footer } from '@/components/Footer';
import { Shield, Brain, Cpu, Database, Lock, Zap, CheckCircle, ArrowRight, Activity, BarChart3, Globe, Eye } from 'lucide-react';

export default function TechnologyPage() {
  return (
    <div className="min-h-screen bg-black">
      <MainNavigation />

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <Brain className="h-4 w-4 mr-2" />
              Powered by Advanced AI
            </Badge>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              The Technology Behind
              <br />
              <span className="text-brand-400">SafeBet IQ</span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              Our explainable AI engine combines machine learning, Nova IQ behavioral assessments, and real-time casino data to identify gambling harm with 86.9% accuracy and continuously improving.
            </p>
            <div className="flex justify-center gap-8 mb-10">
              <div className="text-center">
                <div className="text-4xl font-bold text-brand-400 mb-1">86.9%</div>
                <div className="text-sm text-gray-500">AI Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400 mb-1">+19.4%</div>
                <div className="text-sm text-gray-500">90-Day Improvement</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400 mb-1">+12.5%</div>
                <div className="text-sm text-gray-500">Nova IQ Lift</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">
                SafeBet IQ Risk Engine
              </h2>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Our machine learning model analyzes 8 critical behavioral dimensions in real-time, scoring every player from 0-100 to identify potential gambling harm before it escalates.
              </p>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Activity className="h-6 w-6 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Real-Time Behavioral Analysis</h3>
                    <p className="text-gray-400">Continuous monitoring of player sessions, bet patterns, frequency, and duration with instant risk calculations.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-6 w-6 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Multi-Dimensional Scoring</h3>
                    <p className="text-gray-400">Weighted analysis across visits, bet sizes, session duration, loss ratios, and behavioral flags.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="h-6 w-6 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Predictive ML Models</h3>
                    <p className="text-gray-400">Trained on 250+ player profiles to identify harmful patterns with 99.9% accuracy.</p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800">
              <CardContent className="p-8">
                <div className="text-sm text-gray-400 mb-6 font-semibold">Risk Calculation Formula</div>
                <div className="space-y-4 mb-8">
                  {[
                    { factor: 'Visit Frequency Score', weight: '20%', max: 20 },
                    { factor: 'Bet Size Risk Score', weight: '25%', max: 25 },
                    { factor: 'Session Duration Score', weight: '20%', max: 20 },
                    { factor: 'Loss Ratio Score', weight: '25%', max: 25 },
                    { factor: 'Behavioral Flags Score', weight: '10%', max: 10 }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gray-950 border border-gray-800 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-300 font-medium">{item.factor}</span>
                        <Badge className="bg-brand-400/10 text-brand-400 border-0">{item.weight}</Badge>
                      </div>
                      <div className="text-xs text-gray-500">Max Score: {item.max} points</div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-brand-400/5 border border-brand-400/20 rounded-lg text-center">
                  <div className="text-sm text-gray-400 mb-2">Total Risk Score</div>
                  <div className="text-5xl font-bold text-brand-400 mb-2">0-100</div>
                  <div className="text-xs text-gray-500">Calculated in real-time for every player</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-purple-400/10 text-purple-400 border-purple-400/20">
              <Eye className="h-4 w-4 mr-2" />
              Explainable AI You Can Trust
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              AI That Recommends, Not Just Alerts
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Every AI decision is fully explainable, auditable, and regulator-approved.
              Nova IQ behavioral assessments work together with live casino data to power transparent, trustworthy harm prevention.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <Card className="bg-gradient-to-br from-purple-900/30 to-black border-purple-500/30">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Shield className="h-7 w-7 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Reason Stacks</h3>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Every AI intervention trigger displays the top 3-5 contributing factors with percentage weights, so staff understand exactly why the AI flagged a player.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Live gambling behavior analysis</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Nova IQ behavioral assessment data</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>24h / 7d / 30d behavioral triggers</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>AI confidence scores for full transparency</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-brand-900/30 to-black border-brand-500/30">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-brand-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Brain className="h-7 w-7 text-brand-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">AI Guidance</h3>
                <p className="text-gray-300 leading-relaxed mb-4">
                  AI recommends intervention type, timing, and provides success probability estimates. Staff can accept, override, or defer with full decision logging.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Soft message, cooling-off, limits, or escalation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Recommended timing (immediate, delayed, monitor)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Success probability based on behavioral profile</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Full audit trail for regulatory compliance</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-900/30 to-black border-green-500/30">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart3 className="h-7 w-7 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Outcome Learning</h3>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Track post-intervention outcomes to improve AI accuracy over time. The system learns which interventions work best for each behavioral profile.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Risk reduced, stabilized, or escalated tracking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Time-to-impact and effectiveness scoring</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>AI accuracy improvements up to +19% in 90 days</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Privacy-safe shared intelligence across operators</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="p-8 bg-gradient-to-r from-purple-900/20 to-brand-900/20 border border-purple-500/30 rounded-2xl">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Brain className="h-8 w-8 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-3">Nova IQ: Behavioral Intelligence, Not Just a Game</h3>
                <p className="text-lg text-gray-300 leading-relaxed mb-4">
                  Nova IQ is an interactive behavioral assessment tool that works together with SafeBet IQ's intervention engine.
                  It provides decision-pattern analysis that enhances AI accuracy without exposing personal data or replacing human judgment.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-white mb-1">Supporting Evidence, Not Final Judgment</div>
                      <p className="text-sm text-gray-400">Nova IQ factors appear alongside live casino data in Reason Stacks</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-white mb-1">POPIA-Aligned Privacy Protection</div>
                      <p className="text-sm text-gray-400">No personal data exposure, full regulatory compliance</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Enterprise-Grade Infrastructure
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Built on secure, scalable technology designed for the gaming industry
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Database,
                title: 'Supabase PostgreSQL',
                description: 'Enterprise-grade database with real-time capabilities, automatic backups, and row-level security for complete data protection.'
              },
              {
                icon: Cpu,
                title: 'Edge Computing',
                description: 'Low-latency processing with edge functions deployed globally for instant risk calculations and interventions.'
              },
              {
                icon: Lock,
                title: 'Bank-Grade Security',
                description: 'End-to-end encryption, POPIA compliance, and role-based access controls protect all sensitive player data.'
              },
              {
                icon: Zap,
                title: 'Real-Time Sync',
                description: 'Live data synchronization across all dashboards ensures regulators and operators see the same data instantly.'
              },
              {
                icon: Globe,
                title: 'Cloud Infrastructure',
                description: '99.99% uptime SLA with automatic scaling to handle thousands of concurrent players without performance degradation.'
              },
              {
                icon: Eye,
                title: 'Audit Logging',
                description: 'Complete audit trails of all actions, interventions, and data access for full regulatory transparency.'
              }
            ].map((tech, i) => (
              <Card key={i} className="bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all">
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-brand-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6">
                    <tech.icon className="h-7 w-7 text-black" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{tech.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{tech.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Data Collection',
                description: 'Player activity is captured in real-time from casino systems including bets, deposits, session times, and behavioral patterns.'
              },
              {
                step: '02',
                title: 'AI Analysis',
                description: 'Our ML engine processes data across 8 dimensions, calculating weighted risk scores and comparing against trained models.'
              },
              {
                step: '03',
                title: 'Risk Classification',
                description: 'Players are automatically categorized as Low, Medium, High, or Critical risk based on their calculated score (0-100).'
              },
              {
                step: '04',
                title: 'Automated Action',
                description: 'When thresholds are exceeded, interventions are triggered automatically via WhatsApp, SMS, or email with responsible gambling resources.'
              }
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-bold text-brand-400/10 mb-4">{step.step}</div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.description}</p>
                {i < 3 && (
                  <div className="hidden md:block absolute top-12 -right-4 w-8 h-0.5 bg-brand-400/20"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Experience the Power of SafeBet IQ
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            See how our technology can transform your casino compliance and player protection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-12 py-6 text-lg rounded-full">
                Schedule Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/casino/dashboard">
              <Button size="lg" variant="outline" className="border-brand-400 text-brand-400 hover:bg-brand-400 hover:text-black px-12 py-6 text-lg rounded-full">
                View Live Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
