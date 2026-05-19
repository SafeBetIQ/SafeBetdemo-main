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
  { name: 'NRGP', label: 'National Responsible Gambling Programme' },
  { name: 'POPIA', label: 'Protection of Personal Information Act' },
  { name: 'NGB', label: 'National Gambling Board Standards' },
  { name: 'ISO 27001', label: 'Information Security Management' },
  { name: 'NGA', label: 'National Gambling Act (South Africa)' },
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/20 via-black to-black pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-brand-900/40 text-brand-300 border border-brand-800 text-sm px-5 py-2 rounded-full font-mono tracking-wide">
              <FileText className="h-4 w-4 mr-2" />
              Compliance Reporting
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Regulator-Ready Reports{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-500">
                Generated in Seconds
              </span>
            </h1>
            <p className="text-lg text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              SafeBet IQ gives operators and regulators a complete, auditable picture of responsible gambling
              compliance — one click, any date range, every intervention logged.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-8">
                <Link href="/contact">
                  Request a Report Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8">
                <Link href="/login">View Live Dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((s, i) => (
              <div key={i} className="bg-gray-950 border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-brand-400 mb-1">{s.value}</div>
                <div className="text-white font-semibold text-sm mb-1">{s.label}</div>
                <div className="text-gray-500 text-xs">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report Types */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Report Library
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Six Report Types, Every Compliance Need Covered
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              From player risk summaries to full compliance reports — all formatted for regulatory submission.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPORT_TYPES.map((report, i) => (
              <div key={i} className="p-5 rounded-xl border border-gray-800 bg-gray-950 hover:border-gray-700 transition-colors">
                <div className={`w-10 h-10 ${report.bg} rounded-lg flex items-center justify-center mb-3`}>
                  <report.icon className={`h-5 w-5 ${report.color}`} />
                </div>
                <h3 className="font-semibold text-sm text-white mb-2">{report.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">{report.description}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {report.tags.map((tag, j) => (
                    <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report Features */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Reporting Engine
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Powerful Filtering. Instant Output.
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Every report is configurable, filterable, and schedulable — built for the pace of modern compliance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex gap-4 p-5 bg-gray-950 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <f.icon className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Standards */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-950/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gray-900 text-gray-400 border border-gray-700 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
              <Award className="h-3.5 w-3.5 mr-1.5" />
              Standards Alignment
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Reports Aligned to Every Major Standard
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              SafeBet IQ reports are structured to meet the exact requirements of South African compliance frameworks.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMPLIANCE_STANDARDS.map((std, i) => (
              <div key={i} className="flex items-center gap-4 p-5 bg-gray-950 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-400">{std.name}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white mb-0.5">{std.name}</div>
                  <div className="text-gray-400 text-xs leading-snug">{std.label}</div>
                </div>
                <CheckCircle className="h-4 w-4 text-brand-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audit Trail */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-brand-900/40 text-brand-300 border border-brand-800 text-xs px-4 py-1.5 rounded-full font-mono tracking-wide uppercase">
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Audit Trail
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
                Tamper-Evident. Regulator-Trusted.
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">
                Every report generated, every intervention logged, every data change recorded —
                SafeBet IQ's audit system is immutable and timestamped to the millisecond.
                Regulators can request records at any time and trust they represent ground truth.
              </p>
              <ul className="space-y-3">
                {[
                  'Immutable audit log — no retroactive edits',
                  'Cryptographic hash verification per record',
                  'Regulator-portal read access (no download required)',
                  'Automated monthly compliance emails',
                  'Scheduled delivery to the NGB and provincial boards',
                  '3-year secure retention with full search',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse" />
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
                  <span className="text-gray-400 text-xs w-28 flex-shrink-0 truncate">{row.casino}</span>
                  <span className="text-brand-400 text-xs w-10 flex-shrink-0">{row.pages}</span>
                  <span className="text-gray-600 text-xs font-mono">{row.hash}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Compliance Reporting That Takes Minutes, Not Days
          </h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Eliminate manual report preparation. Generate audit-ready compliance documents instantly
            and deliver them directly to your regulator.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold px-8">
              <Link href="/contact">
                Book a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8">
              <Link href="/features/regulators">
                Regulator Features
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
