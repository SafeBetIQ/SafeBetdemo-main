'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChartBar as BarChart3, ArrowRight, CircleCheck as CheckCircle, Shield, Globe, Eye, TrendingUp, FileText, Database, Lock, Users, Building2, ChevronRight, Activity, Brain, TriangleAlert as AlertTriangle, Map, Target, Layers, Scale, Award } from 'lucide-react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const REGULATOR_TOOLS = [
  {
    icon: Globe,
    title: 'National Gambling Oversight',
    description: 'A live view of responsible gambling compliance across all licensed operators — risk scores, intervention rates, and self-exclusion volumes.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Map,
    title: 'Provincial Intelligence Dashboards',
    description: 'Provincial regulators see a filtered, jurisdiction-specific view — their casinos, their players, their compliance data.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: AlertTriangle,
    title: 'Operator Compliance Scoring',
    description: 'Each operator receives a live compliance score based on intervention rates, response times, self-exclusion adherence, and report quality.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Brain,
    title: 'AI-Assisted Pattern Recognition',
    description: 'National-level AI models detect systemic gambling harm patterns — identifying high-risk demographics, venues, and periods.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: FileText,
    title: 'Automated Regulatory Reports',
    description: 'Monthly and quarterly compliance reports generated automatically and delivered to regulators without operator involvement.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Scale,
    title: 'Policy Impact Analysis',
    description: 'Measure the real-world impact of regulatory interventions — see whether new policies are reducing harm at the population level.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
];

const ACCESS_LEVELS = [
  {
    role: 'National Regulator',
    icon: Globe,
    description: 'Full visibility across all provincial jurisdictions, all operators, and all network intelligence.',
    access: [
      'All casino compliance scores',
      'National gambling harm trends',
      'Cross-operator intelligence reports',
      'Self-exclusion network overview',
      'Policy impact analytics',
      'Regulator-to-operator enforcement tools',
    ],
    color: 'text-brand-400',
    border: 'border-brand-400/20',
    bg: 'bg-brand-400/5',
  },
  {
    role: 'Provincial Regulator',
    icon: Map,
    description: 'Jurisdiction-filtered view showing only the operators and players within their licensed province.',
    access: [
      'Provincial operator compliance',
      'Local gambling harm data',
      'Provincial self-exclusion register',
      'Jurisdiction-level reporting',
      'Operator performance benchmarking',
      'Direct casino compliance alerts',
    ],
    color: 'text-brand-400',
    border: 'border-brand-800',
    bg: 'bg-brand-900/40',
  },
];

const METRICS = [
  { value: '9', label: 'Provinces Covered', sub: 'Full South African jurisdiction' },
  { value: '50k+', label: 'Players Monitored', sub: 'Across all operators' },
  { value: 'Live', label: 'Data Refresh', sub: 'No manual report requests' },
  { value: '100%', label: 'Operator Accountability', sub: 'Every action is visible' },
];

const REPORTING_STANDARDS = [
  'National Gambling Board (NGB) format compliance',
  'Provincial licensing authority reporting',
  'POPIA data protection compliance',
  'NRGP programme tracking and KPIs',
  'POPIA data governance audit logs',
  'International gambling harm benchmarks',
];

const ENFORCEMENT_TOOLS = [
  {
    icon: AlertTriangle,
    title: 'Compliance Alerts',
    description: 'Automated alerts when operators fall below minimum intervention thresholds or miss reporting deadlines.',
  },
  {
    icon: FileText,
    title: 'Evidence Packages',
    description: 'One-click export of full compliance evidence for formal enforcement proceedings or licence reviews.',
  },
  {
    icon: Eye,
    title: 'Direct Portal Access',
    description: 'Regulators can access live casino dashboards with read-only visibility — no operator involvement required.',
  },
  {
    icon: Database,
    title: 'Historical Deep Dives',
    description: 'Query any operator\'s full compliance history — interventions, exclusions, reports — back to day one.',
  },
];

export default function RegulatorIntelligencePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-400/8 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20 px-4 py-2">
              <Scale className="h-4 w-4 mr-2" />
              Regulator Intelligence
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              National Oversight.{' '}
              <span className="text-brand-400">Real-Time Intelligence.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              SafeBet IQ gives regulators an unprecedented live view of operator compliance,
              gambling harm trends, and self-exclusion enforcement — at the national and provincial
              level, without waiting for operator-submitted reports.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-10 py-6 text-base">
                  Request Regulator Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/features/regulators">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-brand-400 hover:text-brand-400 px-10 py-6 text-base">
                  Regulator Overview
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {METRICS.map((m, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-brand-400 mb-1">{m.value}</div>
                <div className="text-white font-semibold text-sm mb-1">{m.label}</div>
                <div className="text-gray-500 text-xs">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Shift */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
                <TrendingUp className="h-4 w-4 mr-2" />
                From Reactive to Proactive
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6">
                Regulators Shouldn't Wait for Operators to Report
              </h2>
              <p className="text-gray-400 mb-6">
                Traditional regulatory oversight depends on operator-submitted reports — documents that arrive
                monthly, quarterly, or after an incident. By the time you read them, the harm has already happened.
              </p>
              <p className="text-gray-400 mb-8">
                SafeBet IQ changes the model. Regulators get live access to the same data operators see —
                risk scores, intervention rates, exclusion compliance, and trend analysis — updated in real time,
                without requesting anything from anyone.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <div className="text-red-400 font-bold text-sm mb-3">Old Model</div>
                  <ul className="text-gray-400 text-sm space-y-2">
                    <li className="flex gap-2"><span className="text-red-400 flex-shrink-0">x</span> Monthly operator reports</li>
                    <li className="flex gap-2"><span className="text-red-400 flex-shrink-0">x</span> Reactive enforcement only</li>
                    <li className="flex gap-2"><span className="text-red-400 flex-shrink-0">x</span> Limited cross-operator view</li>
                    <li className="flex gap-2"><span className="text-red-400 flex-shrink-0">x</span> No harm trend visibility</li>
                  </ul>
                </div>
                <div className="bg-brand-400/5 border border-brand-400/20 rounded-xl p-4">
                  <div className="text-brand-400 font-bold text-sm mb-3">SafeBet IQ Model</div>
                  <ul className="text-gray-400 text-sm space-y-2">
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> Live dashboard access</li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> Proactive risk alerts</li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> National network view</li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" /> AI harm trend analysis</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-brand-400 text-sm font-semibold">National Compliance Overview</span>
              </div>
              {[
                { operator: 'Apex Gaming Group', score: 94, interventions: '2,841', exclusions: 312, status: 'Compliant', color: 'text-green-400' },
                { operator: 'Highveld Gaming Group', score: 91, interventions: '1,654', exclusions: 198, status: 'Compliant', color: 'text-green-400' },
                { operator: 'Crown & Sceptre Group', score: 88, interventions: '987', exclusions: 134, status: 'Compliant', color: 'text-green-400' },
                { operator: 'Goldfields Gaming Group', score: 76, interventions: '445', exclusions: 87, status: 'Review', color: 'text-yellow-400' },
                { operator: 'Coastline Casino & Entertainment', score: 62, interventions: '198', exclusions: 41, status: 'Alert', color: 'text-orange-400' },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                  <div className="flex-1">
                    <div className="text-white text-xs font-semibold">{row.operator}</div>
                    <div className="text-gray-500 text-xs">{row.interventions} interventions · {row.exclusions} exclusions</div>
                  </div>
                  <div className="text-center w-12">
                    <div className="text-white text-sm font-bold">{row.score}</div>
                    <div className="text-gray-600 text-xs">score</div>
                  </div>
                  <span className={`text-xs font-bold w-16 text-right ${row.color}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence Tools */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <Layers className="h-4 w-4 mr-2" />
              Regulator Intelligence Suite
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Six Tools Built for Effective Oversight
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Every tool designed to give regulators the information they need to act confidently and proactively.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {REGULATOR_TOOLS.map((tool, i) => (
              <Card key={i} className="bg-gray-900/40 border-gray-800 hover:border-brand-400/30 transition-all duration-200 group">
                <CardContent className="p-6">
                  <div className={`w-11 h-11 ${tool.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <tool.icon className={`h-5 w-5 ${tool.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{tool.title}</h3>
                  <p className="text-gray-400 text-sm">{tool.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Access Levels */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              <Lock className="h-4 w-4 mr-2" />
              Role-Based Access
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              National and Provincial Regulator Roles
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Each regulator role receives precisely the access they need — no more, no less.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {ACCESS_LEVELS.map((level, i) => (
              <div key={i} className={`${level.bg} border ${level.border} rounded-2xl p-8`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 ${level.bg} border ${level.border} rounded-xl flex items-center justify-center`}>
                    <level.icon className={`h-6 w-6 ${level.color}`} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${level.color}`}>{level.role}</h3>
                    <p className="text-gray-400 text-sm">{level.description}</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {level.access.map((item, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <CheckCircle className={`h-4 w-4 ${level.color} mt-0.5 flex-shrink-0`} />
                      <span className="text-gray-300 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enforcement Tools */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/20">
              <Shield className="h-4 w-4 mr-2" />
              Enforcement Tools
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              From Intelligence to Action
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              When regulators identify a compliance issue, SafeBet IQ gives them the tools to act immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ENFORCEMENT_TOOLS.map((tool, i) => (
              <div key={i} className="bg-gray-900/40 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                <div className="w-11 h-11 bg-orange-500/10 rounded-xl flex items-center justify-center mb-4">
                  <tool.icon className="h-5 w-5 text-orange-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{tool.title}</h3>
                <p className="text-gray-400 text-sm">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting Standards */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
                <Award className="h-4 w-4 mr-2" />
                Reporting Standards
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6">
                Built to Every South African Regulatory Standard
              </h2>
              <p className="text-gray-400 mb-8">
                SafeBet IQ's regulator intelligence module is structured around the exact
                reporting requirements of South Africa's gambling regulatory framework —
                from the NGB to provincial authorities and responsible gambling mandates.
              </p>
              <ul className="space-y-4">
                {REPORTING_STANDARDS.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Operator Compliance Rate', value: 91, color: 'bg-brand-400' },
                { label: 'Self-Exclusion Enforcement', value: 99, color: 'bg-brand-400' },
                { label: 'Intervention Response Rate', value: 87, color: 'bg-brand-500' },
                { label: 'Report Timeliness Score', value: 96, color: 'bg-brand-400' },
                { label: 'NRGP Programme Alignment', value: 94, color: 'bg-brand-600' },
              ].map((metric, i) => (
                <div key={i} className="bg-gray-900/40 border border-gray-800 rounded-xl p-5">
                  <div className="flex justify-between mb-2">
                    <span className="text-white text-sm font-semibold">{metric.label}</span>
                    <span className="text-white text-sm font-bold">{metric.value}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`${metric.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
            <Scale className="h-4 w-4 mr-2" />
            For Regulators
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Regulate with Evidence, Not Guesswork
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            SafeBet IQ gives South African gambling regulators the real-time intelligence
            they need to enforce standards, identify harm patterns, and drive industry accountability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-10 py-6">
                Request Regulator Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features/regulators">
              <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-brand-400 hover:text-brand-400 px-10 py-6">
                Full Regulator Features
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
