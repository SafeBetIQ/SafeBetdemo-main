'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MainNavigation from '@/components/MainNavigation';
import AINetworkBackground from '@/components/AINetworkBackground';
import TypewriterText from '@/components/TypewriterText';
import FloatingAIPulse from '@/components/FloatingAIPulse';
import CursorTrail from '@/components/CursorTrail';
import LiveAIDashboard from '@/components/LiveAIDashboard';
import AIMonitoringIndicator from '@/components/AIMonitoringIndicator';
import { Footer } from '@/components/Footer';
import {
  Shield,
  Brain,
  TrendingUp,
  Users,
  Activity,
  Zap,
  CheckCircle,
  ArrowRight,
  Lock,
  BarChart3,
  Globe,
  Target,
  Bell,
  Heart,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Crown,
} from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: Brain,
      title: 'AI Risk Detection',
      description: 'Advanced machine learning algorithms analyze player behavior in real-time to detect problem gambling patterns.',
      gradient: 'from-brand-400 to-teal-500'
    },
    {
      icon: Zap,
      title: 'Instant Interventions',
      description: 'Automated protective measures trigger within seconds when risk thresholds are exceeded.',
      gradient: 'from-teal-400 to-cyan-500'
    },
    {
      icon: Shield,
      title: 'Regulatory Compliance',
      description: 'Stay ahead of South African gaming regulations with comprehensive audit trails and reporting.',
      gradient: 'from-cyan-400 to-blue-500'
    },
    {
      icon: Activity,
      title: 'Real-Time Monitoring',
      description: 'Track player activity across all channels with live dashboards and instant alerts.',
      gradient: 'from-blue-400 to-purple-500'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Deep insights into player behavior, spending patterns, and risk factors.',
      gradient: 'from-purple-400 to-pink-500'
    },
    {
      icon: Globe,
      title: 'Multi-Casino Platform',
      description: 'Manage multiple casino properties from a single unified compliance dashboard.',
      gradient: 'from-pink-400 to-rose-500'
    }
  ];

  const stats = [
    { label: 'Players Protected', value: '50K+', icon: Users },
    { label: 'Risk Alerts Processed', value: '1.2M+', icon: Bell },
    { label: 'Compliance Score', value: '99.8%', icon: CheckCircle },
    { label: 'Response Time', value: '<100ms', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <CursorTrail />
      <AIMonitoringIndicator />
      <MainNavigation />

      {/* HERO SECTION WITH AI EFFECTS */}
      <section className="relative pt-20 md:pt-32 pb-12 md:pb-20 px-4 md:px-6 overflow-hidden min-h-screen flex items-center">
        <AINetworkBackground />
        <FloatingAIPulse />

        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-brand-400 mb-6 md:mb-8 text-base md:text-lg font-semibold px-4"
            >
              <TypewriterText
                text="Africa's First AI-Driven Responsible Gambling & Risk Compliance System"
                delay={30}
              />
            </motion.div>

            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-4 md:mb-6 leading-tight relative inline-block px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <span className="relative">
                Protect Your Players.
                <br />
                <span className="text-white relative">
                  Supercharge Compliance.
                  <motion.div
                    className="absolute -inset-4 rounded-2xl"
                    style={{ border: 'none' }}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(137, 216, 72, 0.3)',
                        '0 0 40px rgba(137, 216, 72, 0.6)',
                        '0 0 20px rgba(137, 216, 72, 0.3)',
                      ],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                </span>
                <motion.div
                  className="absolute -inset-8 bg-gradient-to-r from-brand-400/10 to-teal-500/10 blur-3xl -z-10"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </span>
            </motion.h1>

            <motion.p
              className="text-sm md:text-base lg:text-lg text-gray-400 mb-8 md:mb-10 max-w-4xl mx-auto leading-relaxed px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.8 }}
            >
              Our all-in-one AI platform combines advanced machine learning with real-time behavioral analysis to monitor player risk, deliver automated interventions, and ensure regulatory compliance across South Africa's gaming industry.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <Link href="/contact">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block relative"
                >
                  <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-6 md:px-8 py-4 md:py-6 text-base md:text-lg rounded-full relative z-10">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <motion.div
                    className="absolute inset-0 bg-brand-400 rounded-full blur-xl opacity-50"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>

          {/* STATS SECTION */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mt-12 md:mt-20"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 + index * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <Card className="bg-gray-950 border-gray-800 hover:border-brand-400/50 transition-all">
                  <CardContent className="p-3 md:p-6 text-center">
                    <stat.icon className="h-6 w-6 md:h-8 md:w-8 text-brand-400 mx-auto mb-2 md:mb-3" />
                    <div className="text-xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                    <div className="text-xs md:text-sm text-gray-400">{stat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* NEON DIVIDER */}
      <motion.div
        className="w-full h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5 }}
      />

      {/* LIVE AI DASHBOARD */}
      <LiveAIDashboard />

      {/* NEON DIVIDER */}
      <motion.div
        className="w-full h-px bg-gradient-to-r from-transparent via-teal-500 to-transparent"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5 }}
      />

      {/* FEATURES SECTION */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-black relative">
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            className="text-center mb-8 md:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              POWERFUL FEATURES
            </Badge>
            <motion.h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 md:mb-4 relative inline-block"
              whileHover={{ scale: 1.02 }}
            >
              <span className="relative">
                Built for Modern Casinos
                <motion.span
                  className="absolute inset-0 text-brand-400"
                  initial={{ opacity: 0 }}
                  whileHover={{
                    opacity: [0, 0.3, 0],
                    x: [0, 2, -2, 0],
                  }}
                  transition={{ duration: 0.3 }}
                >
                  Built for Modern Casinos
                </motion.span>
              </span>
            </motion.h2>
            <p className="text-gray-400 text-sm md:text-base lg:text-lg max-w-2xl mx-auto px-4">
              Enterprise-grade AI compliance tools designed for the African gaming market
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -10, scale: 1.02 }}
              >
                <Card className="bg-gray-950 border-gray-800 hover:border-brand-400/50 transition-all h-full group">
                  <CardContent className="p-5 md:p-8">
                    <motion.div
                      className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform`}
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      <feature.icon className="h-6 w-6 md:h-7 md:w-7 text-white" />
                    </motion.div>
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3 group-hover:text-brand-400 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NEON DIVIDER */}
      <motion.div
        className="w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5 }}
      />

      {/* REVENUE PROTECTION INTELLIGENCE SECTION */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-black relative overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/4 left-10 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 md:mb-16"
          >
            <Badge className="bg-lime-400/20 text-lime-400 border-lime-400/30 mb-4 px-4 py-1.5 text-sm">
              🛡 NEW FEATURE
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">
              Revenue Protection Intelligence
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              AI That Protects Casino Revenue — Not Just Monitors Risk
            </p>
          </motion.div>

          {/* Main Value Proposition */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <Card className="bg-gradient-to-br from-gray-950 to-gray-900 border-gray-800/40 overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <div className="flex items-center justify-center mb-6">
                  <motion.div
                    className="w-20 h-20 bg-gradient-to-br from-lime-400 to-lime-600 rounded-full flex items-center justify-center"
                    whileHover={{ scale: 1.1, rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <DollarSign className="h-10 w-10 text-white" />
                  </motion.div>
                </div>
                <h3 className="text-3xl font-bold text-white text-center mb-4">
                  Converts Player Insights Into Financial Protection
                </h3>
                <p className="text-gray-400 text-center max-w-2xl mx-auto text-lg leading-relaxed">
                  SafeBet IQ now shows the <span className="text-lime-400 font-semibold">exact financial value</span> of
                  every AI intervention — from fraud prevention to VIP retention.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Key Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              {
                icon: DollarSign,
                title: 'LTV Saved',
                description: 'Players retained beyond predicted dropout',
                color: 'lime'
              },
              {
                icon: Shield,
                title: 'Fraud Prevented',
                description: 'Suspicious activity stopped before loss',
                color: 'blue'
              },
              {
                icon: AlertTriangle,
                title: 'Chargebacks Avoided',
                description: 'Disputes prevented through early intervention',
                color: 'yellow'
              },
              {
                icon: Crown,
                title: 'VIP Retention',
                description: 'High-value player recovery revenue',
                color: 'purple'
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5, scale: 1.05 }}
              >
                <Card className={`bg-${benefit.color}-400/10 border-${benefit.color}-400/30 hover:border-${benefit.color}-400/50 transition-all h-full backdrop-blur-sm`}>
                  <CardContent className="p-6">
                    <benefit.icon className={`h-10 w-10 text-${benefit.color}-400 mb-4`} />
                    <h4 className="text-lg font-bold text-white mb-2">{benefit.title}</h4>
                    <p className="text-sm text-gray-400">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Visual Comparison: With vs Without */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Card className="bg-gray-950 border-gray-800 overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <h3 className="text-2xl font-bold text-white text-center mb-8">
                  Revenue Impact Visualization
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Without SafeBet IQ */}
                  <div>
                    <h4 className="text-lg font-semibold text-red-400 mb-4 text-center">
                      Without SafeBet IQ
                    </h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Revenue Leakage', value: '25%' },
                        { label: 'Fraud Losses', value: 'High' },
                        { label: 'Player Churn', value: 'Uncontrolled' },
                        { label: 'Compliance Risk', value: 'Elevated' }
                      ].map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
                          <span className="text-gray-400">{item.label}</span>
                          <span className="text-red-400 font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* With SafeBet IQ */}
                  <div>
                    <h4 className="text-lg font-semibold text-lime-400 mb-4 text-center">
                      With SafeBet IQ
                    </h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Revenue Protected', value: 'R 2.5M+' },
                        { label: 'Fraud Prevention', value: '99.2%' },
                        { label: 'Player Retention', value: '+45%' },
                        { label: 'ROI Multiple', value: '12.4x' }
                      ].map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-lime-900/20 border border-lime-800/30 rounded-lg">
                          <span className="text-gray-400">{item.label}</span>
                          <span className="text-lime-400 font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <motion.div
                  className="mt-8 text-center"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-sm text-gray-500 mb-4">Based on average casino performance metrics across 3 operators</p>
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-lime-400/10 border border-lime-400/30 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-lime-400" />
                    <span className="text-lime-400 font-bold text-lg">300% Revenue Improvement</span>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Feature List */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-12"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: 'Real-Time Financial Dashboards',
                  description: 'Live tracking of revenue protected with animated counters and trend analysis'
                },
                {
                  title: 'Fraud & Chargeback Prevention',
                  description: 'AI detects suspicious patterns before they result in financial loss'
                },
                {
                  title: 'Player Lifetime Value Optimization',
                  description: 'Interventions prevent high-value player dropout and maximize retention'
                },
                {
                  title: 'Compliance as Revenue Strategy',
                  description: 'Turn regulatory requirements into measurable business value'
                },
                {
                  title: 'Platform-Wide Analytics',
                  description: 'Super admins see aggregated ROI across all casino operators'
                },
                {
                  title: 'Explainable AI Calculations',
                  description: 'Full audit trail showing how each protection value was calculated'
                }
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <CheckCircle className="h-6 w-6 text-lime-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                    <p className="text-gray-400 text-sm">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mt-12"
          >
            <Link href="/login">
              <Button size="lg" className="bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-white font-bold px-8 py-6 text-lg">
                See Your Revenue Protection Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-gray-500 text-sm mt-4">
              Transform compliance monitoring into measurable revenue protection
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-black relative overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-400/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 px-4">
              Ready to Transform Your Casino Compliance?
            </h2>
            <p className="text-base md:text-lg lg:text-xl text-gray-400 mb-6 md:mb-10 px-4">
              Join leading casinos across South Africa in protecting players and exceeding regulatory standards
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-6 md:px-8 py-4 md:py-6 text-base md:text-lg rounded-full w-full sm:w-auto">
                    Request Demo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/safeplay-connect">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="lg" variant="outline" className="border-brand-400/50 text-brand-400 hover:bg-brand-400/10 px-6 md:px-8 py-4 md:py-6 text-base md:text-lg rounded-full w-full sm:w-auto">
                    View API Docs
                  </Button>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
