'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowRight, CircleCheck as CheckCircle, Download, Calendar, Filter, Shield, ChartBar as BarChart3, Clock, Lock, Eye, Database, RefreshCw, ChevronRight, Layers, Award, TriangleAlert as AlertTriangle, TrendingUp, Search, BookOpen, Zap, Users, Activity } from 'lucide-react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const REPORT_TYPES = [
  {
    icon: Activity,
    title: 'Player Risk Summary Report',
    description: 'Complete risk score distribution across all active players for any date range, with cohort breakdowns and trend analysis.',
    tags: ['Regulator Ready', 'PDF + CSV'],
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Shield,
    title: 'Intervention Compliance Report',
    description: 'Full audit of every intervention triggered — who was contacted, when, why, via which channel, and what the outcome was.',
    tags: ['Audit Trail', 'Tamper-Evident'],
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: FileText,
    title: 'Self-Exclusion Register',
    description: 'Active and historical self-exclusion records, network alerts, and cross-operator exclusion compliance status.',
    tags: ['Network Synced', 'Legal Grade'],
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: BarChart3,
    title: 'Session Behaviour Report',
    description: 'Aggregate and per-player session analytics: duration, frequency, loss velocity, and deviation from baseline.',
    tags: ['AI-Powered', 'Behavioral Data'],
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Database,
    title: 'Data Integrity Audit Report',
    description: 'System health, data completeness, integration status, and any anomalies detected in player data feeds.',
    tags: ['Technical Audit', 'Integration Health'],
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
];

const COMPLIANCE_STANDARDS = [
  { name: 'NRGP', label: 'National Responsible Gambling Programme', color: 'text-brand-400', bg: 'bg-brand-400/10' },
  { name: 'POPIA', label: 'Protection of Personal Information Act', color: 'text-brand-400', bg: 'bg-brand-400/10' },
  { name: 'NGB', label: 'National Gambling Board Standards', color: 'text-brand-400', bg: 'bg-brand-400/10' },
  { name: 'ISO 27001', label: 'Information Security Management', color: 'text-brand-400', bg: 'bg-brand-400/10' },
  { name: 'NGA', label: 'National Gambling Act (South Africa)', color: 'text-brand-400', bg: 'bg-brand-400/10' },
];

const FEATURES = [
  {
    icon: Download,
    title: 'One-Click PDF Generation',
    description: 'Generate any report as a professional, regulator-formatted PDF in seconds.',
  },
  {
    icon: Calendar,
    title: 'Custom Date Range Filtering',
    description: 'Select any historical period — daily, weekly, monthly, or fully custom.',
  },
  {
    icon: Filter,
    title: 'Casino & Player Filtering',
    description: 'Drill down to individual casinos, player segments, or risk cohorts.',
  },
  {
    icon: RefreshCw,
    title: 'Scheduled Auto-Delivery',
    description: 'Configure reports to auto-generate and email to regulators on a set schedule.',
  },
  {
    icon: Lock,
    title: 'Tamper-Evident Logs',
    description: 'Every report is timestamped and cryptographically signed for integrity.',
  },
  {
    icon: Eye,
    title: 'Regulator Read Access',
    description: 'Grant regulators direct read-only access to live dashboards and reports.',
  },
];

const STATS = [
  { value: '6', label: 'Report Types', sub: 'All regulator-ready formats' },
  { value: '<5s', label: 'Generation Time', sub: 'Any date range, any scope' },
  { value: '100%', label: 'Audit Coverage', sub: 'Every event captured' },
  { value: '3yr', label: 'Data Retention', sub: 'Secure historical archive' },
];

export default function ComplianceReportingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-500/8 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-brand-500/10 text-brand-400 border-brand-500/20 px-4 py-2">
              <FileText className="h-4 w-4 mr-2" />
              Compliance Reporting
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              Regulator-Ready Reports{' '}
              <span className="text-brand-400">Generated in Seconds</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              SafeBet IQ gives operators and regulators a complete, auditable picture of responsible gambling
              compliance — one click, any date range, every intervention logged.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-500 hover:bg-brand-600 text-black font-semibold px-10 py-6 text-base">
                  Request a Report Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-brand-500 hover:text-brand-400 px-10 py-6 text-base">
                  View Live Dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-brand-400 mb-1">{s.value}</div>
                <div className="text-white font-semibold text-sm mb-1">{s.label}</div>
                <div className="text-gray-500 text-xs">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report Types */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <Layers className="h-4 w-4 mr-2" />
              Report Library
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Six Report Types, Every Compliance Need Covered
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              From player risk summaries to full compliance reports — all formatted for regulatory submission.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {REPORT_TYPES.map((report, i) => (
              <Card key={i} className="bg-gray-900/40 border-gray-800 hover:border-brand-500/30 transition-all duration-200 group">
                <CardContent className="p-6">
                  <div className={`w-11 h-11 ${report.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <report.icon className={`h-5 w-5 ${report.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{report.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{report.description}</p>
                  <div className="flex gap-2 flex-wrap">
                    {report.tags.map((tag, j) => (
                      <span key={j} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{tag}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Report Features */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-500/10 text-brand-400 border-brand-500/20">
              <Zap className="h-4 w-4 mr-2" />
              Reporting Engine
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Powerful Filtering. Instant Output.
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Every report is configurable, filterable, and schedulable — built for the pace of modern compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex gap-4 p-6 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <f.icon className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                  <p className="text-gray-400 text-sm">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Standards */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-500/10 text-brand-400 border-brand-500/20">
              <Award className="h-4 w-4 mr-2" />
              Standards Alignment
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Reports Aligned to Every Major Standard
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              SafeBet IQ reports are structured to meet the exact requirements of South African compliance frameworks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMPLIANCE_STANDARDS.map((std, i) => (
              <div key={i} className="flex items-center gap-4 p-6 bg-gray-900/40 border border-gray-800 rounded-xl">
                <div className={`w-14 h-14 ${std.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-sm font-bold ${std.color}`}>{std.name}</span>
                </div>
                <div>
                  <div className={`text-sm font-bold ${std.color} mb-1`}>{std.name}</div>
                  <div className="text-gray-400 text-sm">{std.label}</div>
                </div>
                <CheckCircle className="h-5 w-5 text-brand-400 ml-auto flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audit Trail Visual */}
      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-brand-500/10 text-brand-400 border-brand-500/20">
                <Lock className="h-4 w-4 mr-2" />
                Audit Trail
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-6">
                Tamper-Evident. Regulator-Trusted.
              </h2>
              <p className="text-gray-400 mb-8">
                Every report generated, every intervention logged, every data change recorded —
                SafeBet IQ's audit system is immutable and timestamped to the millisecond.
                Regulators can request records at any time and trust they represent ground truth.
              </p>
              <ul className="space-y-4">
                {[
                  'Immutable audit log — no retroactive edits',
                  'Cryptographic hash verification per record',
                  'Regulator-portal read access (no download required)',
                  'Automated monthly compliance emails',
                  'Scheduled delivery to the NGB and provincial boards',
                  '3-year secure retention with full search',
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
                <span className="text-brand-400 text-sm font-semibold">Report Generation Log</span>
              </div>
              {[
                { time: '09:00:00', type: 'Monthly Compliance', casino: 'Apex Gaming Group', pages: '28pg', hash: 'a3f92e...' },
                { time: '08:45:12', type: 'Intervention Audit', casino: 'Highveld Gaming Group', pages: '14pg', hash: 'b7d41c...' },
                { time: '08:30:01', type: 'Risk Summary', casino: 'Crown & Sceptre Group', pages: '9pg', hash: 'e2c815...' },
                { time: '08:15:44', type: 'Session Behaviour', casino: 'Goldfields Gaming Group', pages: '22pg', hash: 'd9f307...' },
                { time: '08:00:00', type: 'Self-Exclusion Register', casino: 'NGB Portal', pages: '6pg', hash: 'f1a948...' },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                  <span className="text-gray-600 text-xs font-mono w-16 flex-shrink-0">{row.time}</span>
                  <span className="text-white text-xs flex-1">{row.type}</span>
                  <span className="text-gray-400 text-xs w-28 flex-shrink-0">{row.casino}</span>
                  <span className="text-brand-400 text-xs w-10 flex-shrink-0">{row.pages}</span>
                  <span className="text-gray-600 text-xs font-mono">{row.hash}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-950 border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-brand-500/10 text-brand-400 border-brand-500/20">
            <BookOpen className="h-4 w-4 mr-2" />
            Start Reporting
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Compliance Reporting That Takes Minutes, Not Days
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Eliminate manual report preparation. Generate audit-ready compliance documents instantly
            and deliver them directly to your regulator.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-brand-500 hover:bg-brand-600 text-black font-semibold px-10 py-6">
                Book a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features/regulators">
              <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:border-brand-500 hover:text-brand-400 px-10 py-6">
                Regulator Features
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
