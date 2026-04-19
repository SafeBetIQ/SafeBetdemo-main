'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import InteractiveCardGame from '@/components/wellbeing-games/InteractiveCardGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import MainNavigation from '@/components/MainNavigation';
import { Footer } from '@/components/Footer';
import {
  Shield,
  Heart,
  Mail,
  MessageSquare,
  Play,
  TrendingUp,
  FileCheck,
  Lock,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Users,
  BarChart3,
  Clock,
  Target,
  Download,
  Globe,
  Bell,
} from 'lucide-react';

export default function NovaIQPage() {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <MainNavigation />

      {/* HERO SECTION */}
      <section className="relative pt-20 md:pt-32 pb-12 md:pb-20 px-4 md:px-6 overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"
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
            className="absolute bottom-20 right-10 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl"
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
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20 text-sm px-4 py-2">
              AI-POWERED BEHAVIORAL INTELLIGENCE
            </Badge>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <span className="bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-transparent">
                Nova IQ
              </span>
              <br />
              <span className="text-white text-3xl md:text-4xl lg:text-5xl">
                Explainable AI System
              </span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              Interactive behavioral assessment that enhances AI accuracy by +12.5%.
              Make real decisions in realistic scenarios while our XAI engine combines your behavioral patterns with live casino data for transparent, trustworthy harm prevention.
            </motion.p>

            {/* Stats Bar */}
            <motion.div
              className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-brand-400">86.9%</div>
                <div className="text-xs text-gray-400 mt-1">AI Accuracy</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-green-400">+12.5%</div>
                <div className="text-xs text-gray-400 mt-1">Nova IQ Lift</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-purple-400">83.4%</div>
                <div className="text-xs text-gray-400 mt-1">Success Rate</div>
              </div>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <Button
                size="lg"
                onClick={() => {
                  document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8"
              >
                <Play className="mr-2 h-5 w-5" />
                Experience Demo
              </Button>
              <Button
                size="lg"
                asChild
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8"
              >
                <Link href="/contact">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Book a Demo
                </Link>
              </Button>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="py-16 px-4 md:px-6 bg-gradient-to-b from-transparent to-slate-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card className="bg-slate-900/50 border-slate-800 hover:border-brand-400/50 transition-all">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-brand-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Privacy First</h3>
                  <p className="text-gray-400">
                    Players engage with realistic scenarios. Casinos see behavioral balance scores only. Anonymous assessment.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="bg-slate-900/50 border-slate-800 hover:border-brand-400/50 transition-all">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-brand-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Non-Invasive</h3>
                  <p className="text-gray-400">
                    Quick 5-8 minute assessment. Delivered via email or messaging. Zero disruption to operations.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="bg-slate-900/50 border-slate-800 hover:border-brand-400/50 transition-all">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center mb-4">
                    <FileCheck className="h-6 w-6 text-brand-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">XAI Intelligence</h3>
                  <p className="text-gray-400">
                    Full explainability with AI Reason Stacks, intervention recommendations, and outcome tracking. Every decision fully auditable.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 md:px-6 bg-slate-950/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Three-step process delivering behavioral risk insights through realistic financial scenarios
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 h-full">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-5xl font-bold text-brand-400/20">01</span>
                  <Mail className="h-8 w-8 text-brand-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">
                  Casino Sends Invitation
                </h3>
                <p className="text-gray-400 mb-6">
                  Email or WhatsApp link triggered by:
                </p>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>New player registration</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Periodic Nova IQ check-ins</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>After extended play sessions</span>
                  </li>
                </ul>

                <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-gray-300 italic">
                    &quot;Take a 5-minute Nova IQ assessment to support your balanced gaming experience.&quot;
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 h-full">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-5xl font-bold text-brand-400/20">02</span>
                  <Play className="h-8 w-8 text-brand-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">
                  Player Engages with Scenarios
                </h3>
                <p className="text-gray-400 mb-6">
                  8 realistic gaming scenarios (5 minutes):
                </p>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Winning streak decisions</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Loss recovery choices</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Budget limit awareness</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Emotional state scenarios</span>
                  </li>
                </ul>

                <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-gray-400 mb-2 font-semibold">Captures:</p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Decision speed patterns</li>
                    <li>• Risk tolerance levels</li>
                    <li>• Impulse control indicators</li>
                    <li>• Choice consistency</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 h-full">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-5xl font-bold text-brand-400/20">03</span>
                  <BarChart3 className="h-8 w-8 text-brand-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">
                  AI Generates Behavioral Risk Profile
                </h3>
                <p className="text-gray-400 mb-6">
                  Automated risk assessment delivered:
                </p>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Behavioral Risk Index (0–100)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Risk categorization applied</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Time-stamped audit trail</span>
                  </li>
                </ul>

                <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-gray-400 mb-2 font-semibold">Example Output:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Risk Score:</span>
                      <span className="text-brand-400">42.5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Impulsivity:</span>
                      <span className="text-brand-400">38.2</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Risk Tolerance:</span>
                      <span className="text-brand-400">65.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
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

      {/* WHAT CASINOS SEE */}
      <section className="py-20 px-4 md:px-6 bg-slate-950/50 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              FOR CASINO OPERATORS
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              What Casinos See
            </h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              You see compliance signals, engagement metrics, and audit trails.
              <br />
              <strong className="text-white">No raw gameplay data. No personal wellbeing profiling.</strong>
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: TrendingUp,
                title: 'Engagement Rate',
                value: '68%',
                description: 'Players completing Nova IQ assessments',
                color: 'text-brand-400',
              },
              {
                icon: BarChart3,
                title: 'Risk Trend Analysis',
                value: '↓ 12%',
                description: 'Average risk index over 30 days',
                color: 'text-brand-400',
              },
              {
                icon: Bell,
                title: 'Intervention Log',
                value: '247',
                description: 'Proactive outreach actions logged',
                color: 'text-brand-400',
              },
              {
                icon: FileCheck,
                title: 'Audit Trail',
                value: '100%',
                description: 'Time-stamped compliance evidence',
                color: 'text-brand-400',
              },
              {
                icon: Download,
                title: 'Exportable Reports',
                value: 'PDF/CSV',
                description: 'Regulator-ready documentation',
                color: 'text-brand-400',
              },
              {
                icon: Lock,
                title: 'Data Privacy',
                value: 'POPIA',
                description: 'Anonymized aggregated indicators',
                color: 'text-brand-400',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="bg-slate-900/50 border-slate-800 hover:border-brand-400/50 transition-all h-full">
                  <CardContent className="p-6">
                    <item.icon className={`h-10 w-10 ${item.color} mb-4`} />
                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                    <div className={`text-3xl font-bold ${item.color} mb-2`}>{item.value}</div>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-slate-900/50 border border-brand-400/30 rounded-2xl p-8"
          >
            <div className="flex items-start gap-4">
              <EyeOff className="h-12 w-12 text-brand-400 flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Privacy Protection</h3>
                <p className="text-gray-300 leading-relaxed">
                  Operators never see individual game sessions or player choices.
                  You only receive derived behavioral indicators (risk scores) and proof of outreach.
                  This protects player dignity while demonstrating duty of care.
                </p>
              </div>
            </div>
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

      {/* WHAT REGULATORS SEE */}
      <section className="py-20 px-4 md:px-6 bg-slate-950/50 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              FOR REGULATORS
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              What Regulators See
            </h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              Anonymized aggregated indicators that prove proactive responsible gambling efforts
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="bg-slate-900/50 border-slate-800 hover:border-brand-400/50 transition-all h-full">
                <CardContent className="p-8">
                  <Users className="h-12 w-12 text-brand-400 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-3">
                    Aggregated Anonymized Indicators
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Industry-wide trends and casino-level compliance metrics without personal data
                  </p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Total outreach campaigns deployed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Engagement rate by operator</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Average behavioral risk trends</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="bg-slate-900/50 border-slate-800 hover:border-brand-400/50 transition-all h-full">
                <CardContent className="p-8">
                  <Shield className="h-12 w-12 text-brand-400 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-3">
                    Proof of Proactive Outreach
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Evidence that operators are reaching players outside the casino environment
                  </p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Time-stamped invitation logs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Intervention action records</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Player engagement confirmation</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="bg-slate-900/50 border-slate-800 hover:border-brand-400/50 transition-all h-full">
                <CardContent className="p-8">
                  <Download className="h-12 w-12 text-brand-400 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-3">
                    Exportable Audit Pack
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Comprehensive PDF and CSV reports ready for regulatory review
                  </p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Compliance period summaries</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Operator comparison benchmarks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>Explainable AI methodology</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* XAI FEATURES SECTION */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-slate-950/50 to-black">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-6 bg-purple-400/10 text-purple-400 border-purple-400/20">
              EXPLAINABLE AI SYSTEM
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Nova IQ Enhances AI Intelligence
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Nova IQ behavioral assessments combine with live casino data to power transparent, trustworthy AI decisions
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* AI Reason Stacks */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card className="bg-gradient-to-br from-purple-900/30 to-black border-purple-500/30 h-full">
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6">
                    <Shield className="h-7 w-7 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">AI Reason Stacks</h3>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    Every AI decision shows top contributing factors with percentage weights. Nova IQ behavioral data appears alongside live casino patterns.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Live gambling behavior (65-85% weight)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Nova IQ assessment data (15-35% weight)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>24h / 7d / 30d behavioral triggers</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* AI Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="bg-gradient-to-br from-brand-900/30 to-black border-brand-500/30 h-full">
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-brand-500/20 rounded-2xl flex items-center justify-center mb-6">
                    <Target className="h-7 w-7 text-brand-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">AI Guidance</h3>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    AI recommends intervention type, timing, and success probability. Staff can accept, override, or defer with full decision logging.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Soft message, cooling-off, limits</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Success probability estimation</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-brand-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Full audit trail for compliance</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Outcome Tracking */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="bg-gradient-to-br from-green-900/30 to-black border-green-500/30 h-full">
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6">
                    <TrendingUp className="h-7 w-7 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Outcome Learning</h3>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    Track post-intervention outcomes to improve AI accuracy. System learns which interventions work best for each behavioral profile.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>7d, 14d, 30d risk tracking</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Effectiveness scoring</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>AI accuracy improvement +19%</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>

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

      {/* DEMO SECTION */}
      <section id="demo-section" className="py-20 px-4 md:px-6 bg-gradient-to-b from-slate-950/50 to-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20 text-sm px-4 py-2">
              PLAYABLE DEMONSTRATION
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Experience Nova IQ
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Make real gaming decisions through interactive cards. No data collected in demo mode.
            </p>
          </motion.div>

          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <InteractiveCardGame demoMode={true} />
          </motion.div>
        </div>
      </section>

      {/* WHAT STAKEHOLDERS SEE */}
      <section className="py-20 px-4 md:px-6 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What Each Stakeholder Sees
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-slate-900/50 border-slate-800 h-full">
                <CardContent className="pt-8">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center mr-4">
                      <Eye className="h-6 w-6 text-brand-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">What Casinos See</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start">
                      <TrendingUp className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Engagement Rate</p>
                        <p className="text-gray-400 text-sm">68% completion rate</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <BarChart3 className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Behavioral Balance Trends</p>
                        <p className="text-gray-400 text-sm">Population indices over time</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Bell className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Intervention Log</p>
                        <p className="text-gray-400 text-sm">247 proactive outreach actions</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <FileCheck className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Audit Trail</p>
                        <p className="text-gray-400 text-sm">100% time-stamped evidence</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Download className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Exportable Reports</p>
                        <p className="text-gray-400 text-sm">PDF/CSV for compliance submissions</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Lock className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Data Privacy</p>
                        <p className="text-gray-400 text-sm">POPIA compliant, anonymized aggregates</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-slate-900/50 border-slate-800 h-full">
                <CardContent className="pt-8">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center mr-4">
                      <Shield className="h-6 w-6 text-brand-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">What Regulators See</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start">
                      <Users className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Aggregated Anonymized Indicators</p>
                        <p className="text-gray-400 text-sm">Population-level behavioral bands only</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Proof of Proactive Outreach</p>
                        <p className="text-gray-400 text-sm">Time-stamped invitation logs</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <FileCheck className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Exportable Audit Pack</p>
                        <p className="text-gray-400 text-sm">Casino-level compliance metrics</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <TrendingUp className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Industry-Wide Trends</p>
                        <p className="text-gray-400 text-sm">Cross-operator insights for policy</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Clock className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Compliance Timeline</p>
                        <p className="text-gray-400 text-sm">Historical outreach activity</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <EyeOff className="h-5 w-5 text-brand-400 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold mb-1">Privacy Protected</p>
                        <p className="text-gray-400 text-sm">Zero personal identifiable information</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-20 px-4 md:px-6 bg-slate-950/50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-slate-900/50 border-slate-800 rounded-lg px-6">
                <AccordionTrigger className="text-white hover:text-brand-400">
                  Is this a questionnaire?
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  No. Nova IQ is a decision-based experience, not a survey.
                  It measures behavioral patterns through realistic gaming scenarios,
                  providing objective insights without personal judgments or labels.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="bg-slate-900/50 border-slate-800 rounded-lg px-6">
                <AccordionTrigger className="text-white hover:text-brand-400">
                  Does the casino see gameplay details?
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  No. Casinos only see the Behavioral Balance Index (0-100 scale) and aggregate
                  engagement metrics. Individual decision patterns and telemetry remain private.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="bg-slate-900/50 border-slate-800 rounded-lg px-6">
                <AccordionTrigger className="text-white hover:text-brand-400">
                  Is it linked to wagering?
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  No. The experience is completely independent from casino systems. It&apos;s an off-platform
                  compliance tool that never touches wagering, balances, or gameplay data.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="bg-slate-900/50 border-slate-800 rounded-lg px-6">
                <AccordionTrigger className="text-white hover:text-brand-400">
                  How is it triggered?
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  Invitations are sent via WhatsApp or email based on: periodic compliance cycles,
                  post-session follow-ups, mild behavioral signals detected by SafeBet IQ&apos;s AI,
                  or regulator-mandated check-ins.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="bg-slate-900/50 border-slate-800 rounded-lg px-6">
                <AccordionTrigger className="text-white hover:text-brand-400">
                  Is it POPIA compliant?
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  Yes. Privacy-by-design architecture. No personal health data collected. All behavioral
                  indicators are anonymized. Players can pause or exit at any time. Clear purpose
                  communicated upfront.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="bg-slate-900/50 border-slate-800 rounded-lg px-6">
                <AccordionTrigger className="text-white hover:text-brand-400">
                  What if a player doesn&apos;t complete it?
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  Still counts as proactive outreach for compliance purposes. Non-completion is logged
                  with timestamp. No penalties for players. The invitation itself demonstrates duty of care.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="bg-slate-900/50 border-slate-800 rounded-lg px-6">
                <AccordionTrigger className="text-white hover:text-brand-400">
                  Does this replace existing RG tools?
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  No. Nova IQ is a compliance overlay that works alongside deposit limits,
                  self-exclusion, reality checks, and other responsible gaming tools. It adds behavioral
                  depth without disruption.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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

      {/* CTA SECTION */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-slate-900/50 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to enhance player wellbeing?
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              Join forward-thinking casinos using engaging behavioral assessment tools.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                asChild
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8"
              >
                <Link href="/contact">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Book a Demo
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 hover:border-cyan-400 font-semibold px-8"
              >
                <Link href="/safeplay-connect/overview">
                  <Globe className="mr-2 h-5 w-5" />
                  View Integration Pack
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 hover:border-cyan-400 font-semibold px-8"
              >
                <Link href="/features/regulators">
                  <FileCheck className="mr-2 h-5 w-5" />
                  Regulator Brief
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
