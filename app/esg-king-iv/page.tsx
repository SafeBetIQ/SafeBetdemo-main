'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MainNavigation from '@/components/MainNavigation';
import { Footer } from '@/components/Footer';
import {
  Shield,
  Award,
  TrendingUp,
  FileCheck,
  Download,
  CheckCircle,
  Eye,
  Lock,
  BarChart3,
  Users,
  Building2,
  Scale,
  Heart,
  Leaf,
  BookOpen,
  Target,
  Zap,
  AlertTriangle,
  Globe,
  ArrowRight
} from 'lucide-react';

export default function ESGKingIVPage() {
  const kingIVOutcomes = [
    {
      number: 1,
      title: 'Ethical Culture',
      description: 'Responsible corporate citizenship and ethical decision-making at every level',
      icon: Award,
      color: 'from-purple-500 to-indigo-500',
      safebet: 'AI-driven player protection demonstrates ethical commitment beyond compliance minimums'
    },
    {
      number: 2,
      title: 'Good Performance',
      description: 'Sustainable value creation through integrated risk and opportunity management',
      icon: TrendingUp,
      color: 'from-green-500 to-teal-500',
      safebet: 'Real-time risk detection enables proactive interventions before harm occurs'
    },
    {
      number: 3,
      title: 'Effective Control',
      description: 'Adequate oversight, assurance, and control environment across operations',
      icon: Shield,
      color: 'from-blue-500 to-cyan-500',
      safebet: 'Read-only independent monitoring provides unbiased third-party oversight'
    },
    {
      number: 4,
      title: 'Legitimacy',
      description: 'Stakeholder trust through transparency and accountable governance',
      icon: CheckCircle,
      color: 'from-brand-400 to-teal-500',
      safebet: 'Complete audit trails and explainable AI provide regulator-ready evidence'
    }
  ];

  const esgBreakdown = [
    {
      category: 'Environmental',
      weight: '15%',
      icon: Leaf,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Indirect ESG Impact',
      metrics: [
        'Operational energy efficiency monitoring',
        'Carbon footprint awareness',
        'Resource optimization practices',
        'Sustainable operations tracking'
      ]
    },
    {
      category: 'Social',
      weight: '55%',
      icon: Heart,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      description: 'Player Protection & Staff Competency',
      metrics: [
        'Player protection intervention rate (AI-driven)',
        'Employee responsible gambling training completion',
        'Self-exclusion program effectiveness',
        'NRGP financial contribution compliance',
        'Problem gambling referrals and support',
        'Community impact and awareness campaigns'
      ]
    },
    {
      category: 'Governance',
      weight: '30%',
      icon: Scale,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Audit, Oversight & Accountability',
      metrics: [
        'Regulatory compliance rate',
        'Risk identification timeliness',
        'Audit trail completeness',
        'Transparency in ESG reporting',
        'Board oversight documentation',
        'Combined assurance effectiveness'
      ]
    }
  ];

  const kingIVPrinciples = [
    { num: '1-3', title: 'Leadership, Ethics & Corporate Citizenship', esg: 'Governance + Social' },
    { num: '4-5', title: 'Strategy, Performance & Reporting', esg: 'Governance' },
    { num: '6-7', title: 'Governing Structures & Delegation', esg: 'Governance' },
    { num: '8-11', title: 'Governance Functional Areas', esg: 'Governance' },
    { num: '12-17', title: 'Stakeholder Relationships', esg: 'Governance + Social' },
  ];

  const readOnlyBenefits = [
    {
      title: 'No System Control',
      description: 'SafeBet IQ never controls casino operations, wagering systems, or player accounts',
      icon: Lock
    },
    {
      title: 'Independent Oversight',
      description: 'Read-only API access ensures unbiased, third-party monitoring for regulators',
      icon: Eye
    },
    {
      title: 'Non-Disruptive',
      description: 'Overlay compliance layer that works alongside existing casino software',
      icon: Shield
    },
    {
      title: 'Evidence-Based',
      description: 'Behavioral data and time-stamped logs provide objective ESG evidence',
      icon: FileCheck
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <MainNavigation />

      {/* HERO SECTION */}
      <section className="pt-20 md:pt-32 pb-16 px-4 md:px-6 relative overflow-hidden">
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
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20 text-sm px-4 py-2">
              KING IV GOVERNANCE FRAMEWORK
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              King IV–Aligned ESG
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-teal-400 to-cyan-400">
                for Responsible Gambling
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Measured. Auditable. Regulator-ready.
              <br />
              <strong className="text-gray-900">Africa's first King IV–mapped ESG compliance platform for casinos</strong>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button
                  size="lg"
                  className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8 py-6 text-lg rounded-full"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download ESG Overview
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-brand-400/50 text-brand-400 hover:bg-brand-400/10 px-8 py-6 text-lg rounded-full"
                >
                  Request Regulator Briefing Pack
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* WHY KING IV MATTERS */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-teal-400/10 text-teal-400 border-teal-400/20">
              WHY KING IV
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Principles-Based Governance
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              King IV is South Africa's corporate governance code, emphasizing
              <strong className="text-gray-900"> outcomes over tick-box compliance</strong>
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card className="h-full border-2 border-gray-200">
                <CardContent className="p-8">
                  <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                  <h3 className="text-2xl font-bold mb-4 text-red-600">Tick-Box ESG (Old Model)</h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">×</span>
                      <span>Self-reported metrics with no independent verification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">×</span>
                      <span>Compliance-only mindset (minimum legal requirements)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">×</span>
                      <span>Lacks stakeholder trust and board confidence</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">×</span>
                      <span>No evidence trail for regulatory audits</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card className="h-full border-2 border-brand-400">
                <CardContent className="p-8">
                  <Award className="h-12 w-12 text-brand-400 mb-4" />
                  <h3 className="text-2xl font-bold mb-4 text-brand-400">King IV ESG (SafeBet IQ)</h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-400 mt-1 flex-shrink-0" />
                      <span>Independent read-only monitoring (no self-reporting bias)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-400 mt-1 flex-shrink-0" />
                      <span>Principles-based: ethical culture + stakeholder trust</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-400 mt-1 flex-shrink-0" />
                      <span>Complete audit trail with time-stamped evidence</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-400 mt-1 flex-shrink-0" />
                      <span>Board-ready reports aligned to King IV outcomes</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-brand-900/10 via-teal-900/10 to-cyan-900/10 border border-brand-400/30 rounded-2xl p-8"
          >
            <div className="flex items-start gap-4">
              <BookOpen className="h-12 w-12 text-brand-400 flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold mb-3">The King IV Difference</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  King IV's "apply or explain" philosophy moves beyond checklist compliance to meaningful governance outcomes.
                  It focuses on <strong>ethical culture, good performance, effective control, and legitimacy</strong>—exactly
                  what responsible gambling requires.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  SafeBet IQ maps every ESG metric to specific King IV principles, providing boards and regulators with the
                  transparency and accountability needed for integrated reporting and stakeholder confidence.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* THE 4 KING IV OUTCOMES */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-cyan-400/10 text-cyan-400 border-cyan-400/20">
              4 KING IV OUTCOMES
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Good Governance Outcomes
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              SafeBet IQ delivers measurable progress against all four King IV outcomes
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {kingIVOutcomes.map((outcome, index) => (
              <motion.div
                key={outcome.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-16 h-16 bg-gradient-to-br ${outcome.color} rounded-2xl flex items-center justify-center text-white text-2xl font-bold`}>
                        {outcome.number}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{outcome.title}</h3>
                        <Badge variant="outline" className="mt-1">Outcome {outcome.number}</Badge>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-6">{outcome.description}</p>
                    <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-brand-900 mb-1">SafeBet IQ Alignment:</p>
                          <p className="text-sm text-brand-800">{outcome.safebet}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ESG BREAKDOWN */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-purple-400/10 text-purple-600 border-purple-400/20">
              ESG SCORING MODEL
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Environmental, Social, Governance
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Weighted scoring designed for read-only responsible gambling compliance
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {esgBreakdown.map((category, index) => (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full border-2">
                  <CardContent className="p-8">
                    <div className={`w-16 h-16 ${category.bgColor} rounded-2xl flex items-center justify-center mb-6`}>
                      <category.icon className={`h-8 w-8 ${category.color}`} />
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <h3 className="text-2xl font-bold">{category.category}</h3>
                      <Badge className="bg-gray-900 text-white">{category.weight}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-6">{category.description}</p>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm mb-3">Key Metrics:</h4>
                      {category.metrics.map((metric, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${category.color.replace('text', 'bg')} mt-2 flex-shrink-0`} />
                          <p className="text-sm text-gray-700">{metric}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-12 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-8"
          >
            <div className="flex items-start gap-4">
              <BarChart3 className="h-12 w-12 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold mb-3">Weighted Composite Score (0-100)</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  SafeBet IQ calculates a <strong>King IV ESG Composite Score</strong> using the weightings above.
                  This single metric provides boards, investors, and regulators with an at-a-glance view of governance maturity.
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <Leaf className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-green-600">15%</div>
                    <div className="text-sm text-gray-600">Environmental</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <Heart className="h-8 w-8 text-pink-600 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-pink-600">55%</div>
                    <div className="text-sm text-gray-600">Social</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <Scale className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-blue-600">30%</div>
                    <div className="text-sm text-gray-600">Governance</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* READ-ONLY INDEPENDENT OVERLAY */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-green-400/10 text-green-600 border-green-400/20">
              INDEPENDENT OVERSIGHT
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Read-Only, Independent Overlay
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              SafeBet IQ provides ESG measurement without controlling casino systems
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {readOnlyBenefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <benefit.icon className="h-10 w-10 text-brand-400 mb-4" />
                    <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
                    <p className="text-sm text-gray-600">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-2 border-green-400 bg-gradient-to-br from-green-50 to-teal-50">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <Eye className="h-12 w-12 text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-2xl font-bold mb-4">Why Regulators Prefer Read-Only Oversight</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Unbiased Evidence</h4>
                        <p className="text-sm text-gray-700">
                          Read-only access ensures SafeBet IQ cannot manipulate casino operations or gaming outcomes.
                          Evidence is objective and tamper-proof.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Third-Party Assurance</h4>
                        <p className="text-sm text-gray-700">
                          Independent monitoring provides regulators with confidence that ESG metrics are accurate,
                          complete, and not self-reported.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Separation of Control</h4>
                        <p className="text-sm text-gray-700">
                          Casino retains full control of operations while SafeBet IQ provides compliance measurement,
                          evidence generation, and reporting.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Audit-Ready</h4>
                        <p className="text-sm text-gray-700">
                          Complete audit trails with time-stamped evidence make regulatory reviews straightforward
                          and transparent.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* WHAT BOARDS & REGULATORS SEE */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-blue-400/10 text-blue-600 border-blue-400/20">
              STAKEHOLDER DASHBOARDS
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What Boards & Regulators See
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Transparent, evidence-backed reporting for informed decision-making
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Card className="border-2 border-brand-400">
              <CardContent className="p-8">
                <BarChart3 className="h-12 w-12 text-brand-400 mb-4" />
                <h3 className="text-xl font-bold mb-4">ESG Dashboards</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span>King IV composite score (0-100)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span>E/S/G breakdown with weightings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span>Trend analysis over time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span>17 King IV principles compliance status</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span>4 outcome scores (ethical culture, performance, control, legitimacy)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-teal-400">
              <CardContent className="p-8">
                <FileCheck className="h-12 w-12 text-teal-600 mb-4" />
                <h3 className="text-xl font-bold mb-4">Evidence Packs</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>Time-stamped intervention logs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>Risk identification records</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>Training completion certificates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>Self-exclusion program data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>NRGP contribution receipts</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-cyan-400">
              <CardContent className="p-8">
                <Download className="h-12 w-12 text-cyan-600 mb-4" />
                <h3 className="text-xl font-bold mb-4">Audit Trails</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                    <span>Complete action logs with timestamps</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                    <span>Compliance response documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                    <span>Regulatory submission history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                    <span>Board oversight records</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                    <span>Exportable PDF/CSV formats</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-br from-brand-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-400/10 rounded-full blur-3xl"
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

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Position Your Casino as an ESG Leader
            </h2>
            <p className="text-lg text-gray-200 mb-10 max-w-2xl mx-auto">
              Demonstrate King IV governance maturity to boards, regulators, and investors
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button
                  size="lg"
                  className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-6 text-lg rounded-full"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download King IV ESG Overview
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg rounded-full"
                >
                  Request Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
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
