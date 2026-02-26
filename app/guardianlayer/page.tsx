'use client';

import { useState } from 'react';
import { Shield, Brain, Monitor, Clock, AlertTriangle, CheckCircle, ArrowRight, Lock, Eye, Activity, MapPin, Users, Zap, BarChart3, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import MainNavigation from '@/components/MainNavigation';
import { Footer } from '@/components/Footer';

const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
        <span className="text-gray-200 font-medium">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 text-brand-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-5 bg-gray-900/30 border-t border-gray-700/50">
          <p className="text-gray-400 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
};

export default function GuardianLayerPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MainNavigation />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-black via-brand-900/10 to-black pt-24 pb-20 px-6 border-b border-brand-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(137,216,72,0.07),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(107,194,53,0.04),transparent_60%)]" />

        <div className="max-w-6xl mx-auto relative">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-brand-500/30" />
            <span className="text-xs font-medium text-brand-400 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-full">
              Africa's First Independent AI Underage Gambling Risk Intelligence System
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-brand-500/30" />
          </div>

          <div className="text-center max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <Shield className="w-8 h-8 text-brand-400" />
              </div>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
              <span className="text-white">Guardian</span>
              <span className="text-brand-400">Layer</span>
            </h1>
            <p className="text-xl md:text-2xl font-light text-gray-300 mb-3">
              Independent AI Minor Risk Intelligence
            </p>
            <p className="text-lg text-gray-400 mb-8">
              Independent. Intelligent. Regulator-Aligned.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/contact" className="inline-flex items-center gap-2 bg-brand-400 hover:bg-brand-300 text-black font-semibold px-6 py-3 rounded-xl transition-colors">
                Request Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/technology" className="inline-flex items-center gap-2 border border-gray-600 hover:border-gray-400 text-gray-300 px-6 py-3 rounded-xl transition-colors">
                Technical Architecture
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What is GuardianLayer */}
      <section className="py-20 px-6 border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-medium text-brand-400 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-full">OVERVIEW</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-4">What is GuardianLayer?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">An independent compliance layer that generates AI risk intelligence — without touching gaming infrastructure.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Shield,
                title: 'AI-Powered Underage Gambling Protection Layer',
                body: 'GuardianLayer analyzes event data feeds from casino platforms to detect behavioral patterns consistent with underage gambling activity. It operates independently — consuming data, generating intelligence, and never controlling game logic.',
                color: 'text-brand-400',
                bg: 'bg-brand-500/5 border-brand-500/20',
              },
              {
                icon: Lock,
                title: 'Compliance Intelligence Infrastructure',
                body: 'Built for licensed African gaming operators under NRGP and provincial licensing frameworks. GuardianLayer generates signals for casino compliance officers and regulatory bodies — not enforcement commands.',
                color: 'text-brand-300',
                bg: 'bg-brand-500/5 border-brand-500/15',
              },
              {
                icon: Activity,
                title: 'Independent Oversight Architecture',
                body: 'Runs as a parallel intelligence layer. No shared session state with gaming engines. No direct database access. Consumes event feeds via API — fully isolated from casino core systems by design.',
                color: 'text-brand-400',
                bg: 'bg-brand-500/5 border-brand-500/20',
              },
            ].map(({ icon: Icon, title, body, color, bg }) => (
              <div key={title} className={`border rounded-2xl p-6 ${bg}`}>
                <Icon className={`w-8 h-8 ${color} mb-4`} />
                <h3 className="text-white font-semibold text-lg mb-3">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          {/* Not/Is table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-red-950/10 border border-red-500/20 rounded-2xl p-6">
              <h3 className="text-red-400 font-semibold mb-4 text-lg">GuardianLayer Is NOT</h3>
              <div className="space-y-2">
                {[
                  'A gambling platform or game engine',
                  'A payment processor or wallet controller',
                  'A KYC provider or identity verifier',
                  'A player blocking or account control system',
                  'A bet modification or game logic layer',
                  'A replacement for existing compliance tools',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-red-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-brand-950/10 border border-brand-500/20 rounded-2xl p-6">
              <h3 className="text-brand-400 font-semibold mb-4 text-lg">GuardianLayer IS</h3>
              <div className="space-y-2">
                {[
                  'An independent AI risk intelligence engine',
                  'A behavioral pattern analysis layer',
                  'A compliance signal generation system',
                  'A regulator-aligned oversight tool',
                  'An underage gambling risk detector',
                  'A minor protection infrastructure component',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-brand-300">
                    <CheckCircle className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core AI Engines */}
      <section className="py-20 px-6 bg-gray-900/20 border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-medium text-brand-400 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-full">AI ENGINES</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-4">How Minor Risk Scoring Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Five independent AI engines process behavioral data streams to calculate the Minor Risk Score (0.000 – 100.000)</p>
          </div>

          <div className="space-y-4">
            {[
              {
                number: '01',
                icon: AlertTriangle,
                title: 'Minor Risk Score Engine',
                color: 'text-red-400',
                bg: 'bg-red-500/5 border-red-500/20',
                numBg: 'bg-red-500/10 text-red-400',
                description: 'Calculates a composite minor risk score (0.000 – 100.000) from 8 weighted behavioral signals.',
                signals: ['Betting velocity', 'Reaction time anomalies', 'Micro-bet frequency', 'Session duration anomalies', 'School-hour activity flag (08:00–15:00 weekdays)', 'Game-switch impulsivity', 'Loss-chasing behavior patterns', 'Device behavior mismatch score'],
                output: 'Risk Score + Category (Low/Medium/High/Critical) + Trend + Delta %',
              },
              {
                number: '02',
                icon: Monitor,
                title: 'Device Intelligence Engine',
                color: 'text-orange-400',
                bg: 'bg-orange-500/5 border-orange-500/20',
                numBg: 'bg-orange-500/10 text-orange-400',
                description: 'Tracks and analyzes device-level behavioral signatures to detect shared devices and identity clusters.',
                signals: ['Device ID tracking', 'IP consistency scoring', 'Login pattern clustering', 'Session overlap detection', 'Behavioral fingerprint shift analysis', 'Shared device probability calculation'],
                output: 'Device Identity Shift Score (0.000 – 1.000) + Linked account count + High-risk device flags',
              },
              {
                number: '03',
                icon: Brain,
                title: 'Identity Drift AI',
                color: 'text-brand-400',
                bg: 'bg-brand-500/5 border-brand-500/20',
                numBg: 'bg-brand-500/10 text-brand-400',
                description: 'Detects behavioral signature changes on the same device — the primary signal for potential account sharing between age-divergent users.',
                signals: ['Same-device different-signature detection', 'Time-of-day usage shift analysis', 'Stake size change pattern detection', 'Gameplay style deviation scoring', 'Cross-account behavioral similarity'],
                output: 'Drift Score + Spike Detection + Intervention Recommendation Signal when threshold exceeded',
              },
              {
                number: '04',
                icon: Clock,
                title: 'School-Hour Monitoring Engine',
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/5 border-yellow-500/20',
                numBg: 'bg-yellow-500/10 text-yellow-400',
                description: 'Flags player sessions occurring during standard South African school hours on weekdays, applying risk multipliers and geo-radius analysis.',
                signals: ['08:00–15:00 weekday session flagging', 'School-zone geo-radius detection', 'Province-level activity ratio calculation', 'School holiday vs term-time comparison', 'Risk multiplier application to composite score'],
                output: 'School-Hour Activity Ratio + Risk Multiplier + Province Risk Ranking',
              },
              {
                number: '05',
                icon: Zap,
                title: 'Intervention Signal System',
                color: 'text-brand-400',
                bg: 'bg-brand-500/5 border-brand-500/20',
                numBg: 'bg-brand-500/10 text-brand-400',
                description: 'Generates compliance signals for casino operators and regulators. GuardianLayer does NOT enforce blocking — it generates intelligence recommendations only.',
                signals: ['Re-verification recommended', 'Biometric re-check suggested', 'Session review required', 'Compliance escalation triggered', 'Temporary freeze suggested'],
                output: 'Signal + Timestamp + Casino Response Status + Response Time + Escalation Stage + Resolution Outcome',
              },
            ].map(({ number, icon: Icon, title, color, bg, numBg, description, signals, output }) => (
              <div key={number} className={`border rounded-2xl p-6 ${bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`text-xl font-bold font-mono px-3 py-1 rounded-lg flex-shrink-0 ${numBg}`}>{number}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`w-5 h-5 ${color}`} />
                      <h3 className="text-white font-semibold text-lg">{title}</h3>
                    </div>
                    <p className="text-gray-400 text-sm mb-4">{description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Input Signals</div>
                        <div className="space-y-1">
                          {signals.map(s => (
                            <div key={s} className="flex items-center gap-2 text-xs text-gray-300">
                              <span className={`w-1 h-1 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">AI Output</div>
                        <div className={`text-xs ${color} bg-gray-900/50 border border-current/20 rounded-lg p-3 leading-relaxed`}>{output}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulator Oversight */}
      <section className="py-20 px-6 border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-medium text-brand-400 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-full">REGULATORY LAYER</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-4">Regulator Oversight Capabilities</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Full national oversight across all licensed operators, provinces, and compliance metrics — in real time.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: 'Underage Suspicion Rate per Operator', desc: 'Track each licensed operator\'s AI-calculated suspicion rate as a percentage. Ranked by national risk index.', color: 'text-orange-400' },
              { icon: Monitor, title: 'Device Risk Index', desc: 'Monitor the device-level identity shift scores across all operators. Flag high-risk device clusters.', color: 'text-yellow-400' },
              { icon: Clock, title: 'Average Response Time', desc: 'Track how quickly each operator acknowledges and acts on GuardianLayer intervention signals.', color: 'text-brand-400' },
              { icon: CheckCircle, title: 'Escalation Compliance %', desc: 'Measure the percentage of escalated signals that received a compliant response within the required timeframe.', color: 'text-brand-400' },
              { icon: MapPin, title: 'Province Risk Ranking', desc: 'Geographic risk heatmap ranking all three provinces by school-hour activity, risk index, and compliance rate.', color: 'text-brand-300' },
              { icon: Activity, title: 'National Minor Risk Index', desc: 'Composite national score aggregating all operator risk data into a single regulatory benchmark metric.', color: 'text-red-400' },
              { icon: TrendingUp, title: 'Historical Trend Analysis', desc: '12-month rolling trend data for all metrics. Compare school-term vs holiday period activity patterns.', color: 'text-brand-400' },
              { icon: Users, title: 'Cross-Operator Intelligence', desc: 'Identify patterns that cross operator boundaries — shared device clusters, behavioral similarity scores.', color: 'text-brand-300' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-5 hover:border-brand-500/30 transition-colors">
                <Icon className={`w-5 h-5 ${color} mb-3`} />
                <h3 className="text-white font-medium text-sm mb-2">{title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESG & Child Protection */}
      <section className="py-20 px-6 bg-gray-900/20 border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-medium text-brand-400 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-full">ESG ALIGNMENT</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-4">ESG & Child Protection Alignment</h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                GuardianLayer directly supports ESG Social (S) pillar obligations for licensed gaming operators under King IV governance principles and NRGP regulatory frameworks in South Africa.
              </p>
              <div className="space-y-3">
                {[
                  { pillar: 'Social — Child Protection', desc: 'AI monitoring of underage gambling risk indicators directly addresses Social responsibility obligations in operator ESG reporting.' },
                  { pillar: 'Governance — Compliance Infrastructure', desc: 'Independent AI oversight supports Board-level governance obligations for responsible gambling monitoring.' },
                  { pillar: 'Social — Community Risk Mitigation', desc: 'Province-level school-hour monitoring and geo-risk analysis demonstrates proactive community protection.' },
                  { pillar: 'NRGP Reporting Ready', desc: 'GuardianLayer generates data structures aligned with National Responsible Gambling Programme reporting requirements.' },
                ].map(({ pillar, desc }) => (
                  <div key={pillar} className="flex gap-3">
                    <CheckCircle className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-white font-medium">{pillar}</div>
                      <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Minor Risk Score Precision', value: '0.001', sub: '3-decimal accuracy' },
                { label: 'Device Shift Detection', value: '120+', sub: 'Devices tracked' },
                { label: 'School-Hour Monitoring', value: '08:00–15:00', sub: 'Weekday window' },
                { label: 'Province Coverage', value: '3', sub: 'SA Provinces' },
                { label: 'Signal Types', value: '5', sub: 'Intervention signals' },
                { label: 'Compliance Data', value: '12mo', sub: 'Historical analysis' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-brand-400 mb-1">{value}</div>
                  <div className="text-xs text-white font-medium mb-0.5">{label}</div>
                  <div className="text-xs text-gray-500">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Independent Compliance Layer */}
      <section className="py-20 px-6 border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-medium text-brand-400 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-full">ARCHITECTURE</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-4">Independent Compliance Layer</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">GuardianLayer sits beside casino infrastructure — never inside it.</p>
          </div>

          <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Data Sources */}
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium">Data Sources (In)</div>
                <div className="space-y-2">
                  {['Player session logs', 'Betting event logs', 'Device metadata', 'Geo-location data', 'KYC verification responses'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 border border-gray-700/40 rounded-lg px-3 py-2">
                      <ArrowRight className="w-3 h-3 text-brand-400" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* GuardianLayer Engine */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-full bg-gradient-to-b from-brand-950/30 to-brand-900/20 border border-brand-500/30 rounded-2xl p-6 text-center">
                  <Shield className="w-10 h-10 text-brand-400 mx-auto mb-3" />
                  <div className="text-white font-bold text-lg mb-1">GuardianLayer</div>
                  <div className="text-xs text-gray-400 mb-4">Independent AI Engine</div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="bg-gray-800/50 rounded px-2 py-1">Minor Risk Score Engine</div>
                    <div className="bg-gray-800/50 rounded px-2 py-1">Device Intelligence Engine</div>
                    <div className="bg-gray-800/50 rounded px-2 py-1">Identity Drift AI</div>
                    <div className="bg-gray-800/50 rounded px-2 py-1">School-Hour Monitor</div>
                    <div className="bg-gray-800/50 rounded px-2 py-1">Intervention Signal System</div>
                  </div>
                </div>
              </div>

              {/* Intelligence Outputs */}
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium">Intelligence Outputs (Out)</div>
                <div className="space-y-2">
                  {['Minor Risk Scores (0.000–100.000)', 'Device Shift Alerts', 'Identity Drift Signals', 'School-Hour Flags', 'Intervention Recommendations', 'Compliance Reports', 'Province Risk Heatmap'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 border border-gray-700/40 rounded-lg px-3 py-2">
                      <ArrowRight className="w-3 h-3 text-brand-400" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 bg-brand-950/20 border border-brand-500/20 rounded-xl p-4 text-center text-sm text-brand-300">
              <Shield className="w-4 h-4 inline mr-2" />
              GuardianLayer runs completely independently. It does NOT modify bets, block players, control wallets, or access KYC systems directly.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'Does GuardianLayer block underage players?', a: 'No. GuardianLayer is a risk intelligence system only. It generates compliance signals and recommendations. The decision to act — including account review, re-verification, or suspension — is made by the licensed operator\'s compliance team. GuardianLayer does not control accounts, wallets, or game access.' },
              { q: 'Does GuardianLayer replace our existing KYC provider?', a: 'No. GuardianLayer is a behavioral analysis layer that sits alongside your KYC infrastructure. It generates a "Re-verification recommended" signal when drift patterns suggest possible account sharing — but your existing KYC processes handle identity verification.' },
              { q: 'How does the Minor Risk Score work?', a: 'The Minor Risk Score (0.000–100.000) is calculated from 8 weighted behavioral signals: betting velocity, reaction time, micro-bet frequency, session anomalies, school-hour activity, game-switch impulsivity, loss-chasing patterns, and device behavior mismatch. School-hour activity during weekday 08:00–15:00 carries the highest weight (20%) as a primary underage indicator.' },
              { q: 'What data does GuardianLayer consume?', a: 'GuardianLayer consumes event feeds via API integration: player session logs, betting event logs, device metadata, geo-location data, and KYC verification status responses. It does not store payment information, PII beyond operational identifiers, or communicate directly with gaming engines.' },
              { q: 'Is GuardianLayer NRGP compliant?', a: 'GuardianLayer is designed to align with National Responsible Gambling Programme (NRGP) reporting obligations in South Africa. It generates data structures and audit trails suitable for NRGP compliance reporting. Formal certification is operator-specific and should be confirmed with your compliance team.' },
              { q: 'How is this different from standard responsible gambling tools?', a: 'Standard responsible gambling tools focus on problem gambling behaviors in adults. GuardianLayer specifically addresses underage gambling risk through behavioral age-proxy signals — school-hour activity, reaction time patterns typical of younger players, and identity drift consistent with account sharing between adults and minors.' },
            ].map(({ q, a }) => (
              <FAQItem key={q} question={q} answer={a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/30 text-brand-300 text-sm px-4 py-2 rounded-full mb-6">
            <Shield className="w-4 h-4" />
            Africa's First Independent AI Underage Gambling Risk Intelligence System
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Implement GuardianLayer?</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Strengthen your compliance infrastructure with independent AI oversight. Designed for licensed African gaming operators.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/contact" className="inline-flex items-center gap-2 bg-brand-400 hover:bg-brand-300 text-black font-semibold px-8 py-3.5 rounded-xl transition-colors">
              Schedule a Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/safeplay-connect" className="inline-flex items-center gap-2 border border-gray-600 hover:border-gray-400 text-gray-300 px-8 py-3.5 rounded-xl transition-colors">
              API Integration Guide
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
