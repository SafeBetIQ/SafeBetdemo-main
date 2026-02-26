'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Users,
  MessageSquare,
  Activity,
  CheckCircle,
  ArrowRight,
  Menu,
  X,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  BarChart3,
  Bell,
  Target,
  Zap,
  Lock,
  Eye,
  FileText,
  Heart
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

export default function CasinosPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [riskScore, setRiskScore] = useState(73);
  const [animatedStats, setAnimatedStats] = useState({
    players: 0,
    interventions: 0,
    compliance: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRiskScore(prev => {
        const change = Math.floor(Math.random() * 10) - 5;
        const newScore = Math.max(50, Math.min(90, prev + change));
        return newScore;
      });
    }, 3000);

    const statsInterval = setInterval(() => {
      setAnimatedStats({
        players: Math.floor(Math.random() * 500) + 1200,
        interventions: Math.floor(Math.random() * 100) + 150,
        compliance: 99.9
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(statsInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <MainNavigation />

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 8, repeat: Infinity }}
          ></motion.div>
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5]
            }}
            transition={{ duration: 8, repeat: Infinity }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Users className="h-4 w-4 mr-2" />
                For Casino Operators
              </Badge>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Protect Your Players.
              <br />
              <span className="text-brand-400">Secure Your License.</span>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              SafePlay provides casino operators with advanced AI-powered tools to monitor player behavior in real-time, intervene proactively, and maintain full regulatory compliance with South African gaming authorities.
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
              <Link href="/casino/dashboard">
                <Button size="lg" variant="outline" className="border-brand-400 bg-transparent text-brand-400 hover:bg-brand-400 hover:text-black px-8 py-6 text-lg rounded-full transform hover:scale-105 transition-transform">
                  View Dashboard
                </Button>
              </Link>
            </motion.div>

            <motion.div
              className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <div className="text-center">
                <motion.div
                  className="text-4xl font-bold text-brand-400 mb-2"
                  key={animatedStats.players}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {animatedStats.players}+
                </motion.div>
                <div className="text-sm text-gray-400">Players Monitored</div>
              </div>
              <div className="text-center">
                <motion.div
                  className="text-4xl font-bold text-brand-400 mb-2"
                  key={animatedStats.interventions}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {animatedStats.interventions}+
                </motion.div>
                <div className="text-sm text-gray-400">Interventions</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-brand-400 mb-2">{animatedStats.compliance}%</div>
                <div className="text-sm text-gray-400">Compliance Rate</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Complete Casino Compliance Suite
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Everything you need to protect players and maintain your gaming license
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Activity,
                title: 'Real-Time Risk Monitoring',
                description: 'Our AI engine analyzes 8 behavioral indicators in real-time, scoring every player from 0-100 based on visits, bet sizes, session duration, loss ratios, and more.',
                features: ['Live player tracking', 'Automatic risk scoring', 'Behavior pattern detection', 'Session time monitoring']
              },
              {
                icon: MessageSquare,
                title: 'Automated Interventions',
                description: 'Instantly reach at-risk players through WhatsApp, SMS, or email with personalized responsible gaming messages when risk thresholds are exceeded.',
                features: ['Multi-channel messaging', 'Template library', 'Automated triggers', 'Response tracking']
              },
              {
                icon: AlertTriangle,
                title: 'Risk Alert System',
                description: 'Get instant notifications when players enter medium, high, or critical risk categories. Set custom thresholds and escalation protocols.',
                features: ['Custom alert rules', 'Priority notifications', 'Escalation workflows', 'Team assignments']
              },
              {
                icon: BarChart3,
                title: 'Player Analytics Dashboard',
                description: 'Comprehensive analytics showing player distribution across risk levels, session patterns, wagering trends, and intervention effectiveness.',
                features: ['Risk distribution charts', 'Trend analysis', 'Cohort tracking', 'Revenue insights']
              },
              {
                icon: FileText,
                title: 'Compliance Reporting',
                description: 'Generate detailed compliance reports for regulators with complete audit trails, intervention logs, and risk assessment data.',
                features: ['PDF report generation', 'Audit trail logs', 'Exportable data', 'Custom date ranges']
              },
              {
                icon: Clock,
                title: 'Session Controls',
                description: 'Set time limits, deposit limits, and cooling-off periods. Automatically enforce self-exclusion and loss limits per player.',
                features: ['Time limit enforcement', 'Deposit controls', 'Self-exclusion management', 'Cooling-off periods']
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                onHoverStart={() => setActiveFeature(index)}
                onHoverEnd={() => setActiveFeature(-1)}
              >
                <Card className={`bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all h-full cursor-pointer ${activeFeature === index ? 'shadow-xl shadow-brand-400/20' : ''}`}>
                  <CardContent className="p-8">
                    <motion.div
                      className="w-14 h-14 bg-gradient-to-br from-brand-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6"
                      animate={{
                        rotate: activeFeature === index ? [0, -10, 10, -10, 0] : 0
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      <feature.icon className="h-7 w-7 text-black" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-400 mb-6 leading-relaxed">{feature.description}</p>
                    <div className="space-y-2">
                      {feature.features.map((item, i) => (
                        <motion.div
                          key={i}
                          className="flex items-center space-x-2 text-sm"
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay: 0.5 + (i * 0.1) }}
                        >
                          <CheckCircle className="h-4 w-4 text-brand-400 flex-shrink-0" />
                          <span className="text-gray-300">{item}</span>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-6 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                <Zap className="h-4 w-4 mr-2" />
                AI-Powered Intelligence
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6">
                Machine Learning That Predicts Risk Before It Escalates
              </h2>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Our SafeBet IQ Risk Engine has been trained on 250+ player profiles and analyzes multiple behavioral dimensions to predict gambling harm with 99.9% accuracy.
              </p>
              <div className="space-y-4">
                {[
                  { label: 'Visit Frequency Analysis', value: '20% weight' },
                  { label: 'Bet Size Monitoring', value: '25% weight' },
                  { label: 'Session Duration Tracking', value: '20% weight' },
                  { label: 'Loss Ratio Calculation', value: '25% weight' },
                  { label: 'Behavioral Flags', value: '15% weight' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
                    <span className="text-gray-300">{item.label}</span>
                    <Badge className="bg-brand-400/10 text-brand-400 border-0">{item.value}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-brand-400/50 transition-all">
                <CardContent className="p-8">
                  <div className="text-sm text-gray-400 mb-6">Risk Prediction Model Output</div>
                  <div className="space-y-6">
                    <motion.div
                      className="text-center p-8 bg-gray-950 rounded-xl border border-gray-800"
                      animate={{
                        borderColor: riskScore > 80 ? 'rgba(239, 68, 68, 0.3)' : riskScore > 60 ? 'rgba(251, 146, 60, 0.3)' : 'rgba(234, 179, 8, 0.3)'
                      }}
                    >
                      <motion.div
                        className="text-6xl font-bold text-white mb-2"
                        key={riskScore}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {riskScore}
                      </motion.div>
                      <Badge className={`${
                        riskScore > 80 ? 'bg-red-500/10 text-red-400' :
                        riskScore > 60 ? 'bg-orange-500/10 text-orange-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      } border-0 text-lg px-4 py-1`}>
                        {riskScore > 80 ? 'CRITICAL RISK' : riskScore > 60 ? 'HIGH RISK' : 'MEDIUM RISK'}
                      </Badge>
                      <motion.div
                        className="text-sm text-gray-500 mt-2"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        Live updating...
                      </motion.div>
                    </motion.div>

                    <div>
                      <div className="text-sm text-gray-400 mb-3">Risk Factors Breakdown</div>
                      <div className="space-y-2">
                        {[
                          { label: 'Visits Risk', value: 15, max: 20, color: 'bg-yellow-500' },
                          { label: 'Bet Size Risk', value: 18, max: 25, color: 'bg-orange-500' },
                          { label: 'Session Risk', value: 15, max: 20, color: 'bg-orange-500' },
                          { label: 'Loss Risk', value: 15, max: 20, color: 'bg-red-500' },
                          { label: 'Behavior Risk', value: 10, max: 15, color: 'bg-red-500' }
                        ].map((factor, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: i * 0.1 }}
                          >
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">{factor.label}</span>
                              <span className="text-gray-300">{factor.value}/{factor.max}</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                              <motion.div
                                className={`${factor.color} h-2 rounded-full`}
                                initial={{ width: 0 }}
                                whileInView={{ width: `${(factor.value / factor.max) * 100}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: i * 0.1 }}
                              ></motion.div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <motion.div
                      className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg"
                      animate={{ opacity: [1, 0.8, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <div className="flex items-start space-x-3">
                        <motion.div
                          animate={{ rotate: [0, 15, 0, -15, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Bell className="h-5 w-5 text-orange-400 mt-0.5" />
                        </motion.div>
                        <div>
                          <div className="font-semibold text-orange-400 mb-1">Recommended Actions</div>
                          <ul className="text-sm text-gray-300 space-y-1">
                            <li>• Send WhatsApp intervention message</li>
                            <li>• Set session time limit warning</li>
                            <li>• Monitor for further escalation</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              Why Leading SA Casinos Choose SafePlay
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: 'Regulatory Compliance Made Easy',
                description: 'Automatically meet all requirements from the National Gambling Board and provincial authorities. Generate audit-ready reports at any time.',
                icon: Shield
              },
              {
                title: 'Protect Your Players & Revenue',
                description: 'Early intervention reduces player harm while maintaining engagement. Happy, healthy players generate sustainable revenue.',
                icon: Heart
              },
              {
                title: 'Reduce Operational Costs',
                description: 'Automate compliance monitoring and intervention workflows. Save thousands of hours in manual oversight and reporting.',
                icon: TrendingUp
              },
              {
                title: 'Enterprise-Grade Security',
                description: 'Bank-level encryption, POPIA compliance, and 99.99% uptime SLA. Your player data is always protected.',
                icon: Lock
              }
            ].map((benefit, i) => (
              <Card key={i} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-8">
                  <benefit.icon className="h-12 w-12 text-brand-400 mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-3">{benefit.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Elevate Your Casino Compliance?
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            Join 50+ casino operators across South Africa using SafePlay to protect players and maintain their licenses.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-12 py-6 text-lg rounded-full">
                Schedule Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/technology">
              <Button size="lg" variant="outline" className="border-brand-400 text-brand-400 hover:bg-brand-400 hover:text-black px-12 py-6 text-lg rounded-full">
                Learn About Our AI
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
