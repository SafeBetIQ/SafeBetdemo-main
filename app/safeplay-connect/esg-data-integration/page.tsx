'use client';

import MainNavigation from '@/components/MainNavigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw, BarChart3, Upload, Clock, CheckCircle, ArrowRight, Shield } from 'lucide-react';

export default function ESGDataIntegrationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <MainNavigation />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center space-x-3 mb-6">
          <BarChart3 className="h-10 w-10 text-brand-400" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-400 to-teal-500 text-transparent bg-clip-text">
            ESG Data Integration
          </h1>
        </div>
        <p className="text-xl text-gray-400 mb-12">How casino operational data flows into ESG performance dashboards</p>

        <div className="space-y-8">
          {/* Data Flow Overview */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl flex items-center space-x-2">
                <RefreshCw className="h-6 w-6 text-brand-400" />
                <span>Data Integration Methods</span>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Multiple pathways for casino data to populate ESG metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <Database className="h-8 w-8 text-brand-400" />
                    <h3 className="text-lg font-semibold text-white">Real-Time API</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    SafePlay Connect API automatically captures player activity, interventions, and risk events in real-time
                  </p>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Automated</Badge>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <Clock className="h-8 w-8 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Scheduled Syncs</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Nightly batch jobs pull training records, contribution data, and compliance metrics from casino systems
                  </p>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Daily</Badge>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <Upload className="h-8 w-8 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Manual Entry</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Casino admins can manually input certain ESG metrics through the admin dashboard
                  </p>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">As Needed</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Sources Mapping */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl">ESG Metric Data Sources</CardTitle>
              <CardDescription className="text-gray-400">
                Where each ESG metric comes from in your casino systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-6 w-6 text-green-400" />
                      <h3 className="text-lg font-semibold text-white">Responsible Gambling Metrics</h3>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Real-Time API</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-2">Data Points:</p>
                      <ul className="space-y-1 text-gray-300">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Players Screened</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>High-Risk Identifications</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Interventions Performed</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Successful Interventions</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-2">Source System:</p>
                      <code className="text-xs bg-gray-900 border border-gray-700 px-3 py-2 rounded block">
                        POST /api/v1/players/sync
                      </code>
                      <p className="text-gray-400 mt-2">
                        Every time your casino system processes a bet or session, send the data to SafePlay Connect.
                        The AI engine automatically tracks and records intervention metrics.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Database className="h-6 w-6 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">NRGP Contributions & Compliance</h3>
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Scheduled Sync</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-2">Data Points:</p>
                      <ul className="space-y-1 text-gray-300">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>NRGP Levy Payments</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Research Contributions</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Community Investment</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Compliance Audit Results</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-2">Source System:</p>
                      <code className="text-xs bg-gray-900 border border-gray-700 px-3 py-2 rounded block">
                        POST /api/v1/esg/contributions
                      </code>
                      <p className="text-gray-400 mt-2">
                        Connect your financial/accounting system to automatically sync payment records.
                        Alternative: Manual entry through Casino Admin Dashboard.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Database className="h-6 w-6 text-purple-400" />
                      <h3 className="text-lg font-semibold text-white">Employee Training Records</h3>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Scheduled Sync</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-2">Data Points:</p>
                      <ul className="space-y-1 text-gray-300">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Training Completion Status</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>SARGF Certification</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Test Scores</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Renewal Dates</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-2">Source System:</p>
                      <code className="text-xs bg-gray-900 border border-gray-700 px-3 py-2 rounded block">
                        POST /api/v1/esg/training
                      </code>
                      <p className="text-gray-400 mt-2">
                        Connect your LMS (Learning Management System) or HR system. SafeBet IQ Academy can also
                        be your primary training platform.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-6 w-6 text-teal-400" />
                      <h3 className="text-lg font-semibold text-white">Self-Exclusion & Player Protection</h3>
                    </div>
                    <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">Real-Time API</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-2">Data Points:</p>
                      <ul className="space-y-1 text-gray-300">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Active Self-Exclusions</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Counseling Progress</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Reinstatement Requests</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Helpline Referrals</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-2">Source System:</p>
                      <code className="text-xs bg-gray-900 border border-gray-700 px-3 py-2 rounded block">
                        POST /api/v1/exclusions
                      </code>
                      <p className="text-gray-400 mt-2">
                        When a player self-excludes in your system, send the record to SafePlay. The platform
                        automatically tracks compliance and counseling requirements.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Database className="h-6 w-6 text-yellow-400" />
                      <h3 className="text-lg font-semibold text-white">Environmental & Governance</h3>
                    </div>
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Manual/Scheduled</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-2">Data Points:</p>
                      <ul className="space-y-1 text-gray-300">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Renewable Energy Usage</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Carbon Emissions</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Local Jobs Created</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-brand-400" />
                          <span>Regulatory Violations</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-2">Source System:</p>
                      <code className="text-xs bg-gray-900 border border-gray-700 px-3 py-2 rounded block">
                        POST /api/v1/esg/metrics
                      </code>
                      <p className="text-gray-400 mt-2">
                        Submit quarterly or annually through the Admin Dashboard. Can integrate with facilities
                        management or sustainability tracking systems.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Implementation Timeline */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Typical Implementation Timeline</CardTitle>
              <CardDescription className="text-gray-400">
                From integration to full ESG reporting capability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-400/20 flex items-center justify-center text-brand-400 font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Week 1: SafePlay Connect API Integration</h3>
                    <p className="text-gray-400 text-sm">
                      Integrate the main player activity API. This immediately enables responsible gambling metrics
                      and AI-powered interventions.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-600" />
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-400/20 flex items-center justify-center text-brand-400 font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Week 2-3: Financial & Compliance Data Sync</h3>
                    <p className="text-gray-400 text-sm">
                      Connect accounting systems for NRGP contributions. Set up scheduled syncs for compliance records.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-600" />
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-400/20 flex items-center justify-center text-brand-400 font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Week 4: Training & HR Integration</h3>
                    <p className="text-gray-400 text-sm">
                      Integrate LMS or migrate to SafeBet IQ Academy. Sync employee training records and certifications.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-600" />
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-400/20 flex items-center justify-center text-green-400 font-bold">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Week 5+: Full ESG Reporting Active</h3>
                    <p className="text-gray-400 text-sm">
                      Complete ESG dashboard with King IV compliance, regulator-ready reports, and automated monitoring.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Support */}
          <Card className="bg-gradient-to-r from-brand-400/10 to-teal-500/10 border-brand-400/30">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">Need Integration Support?</h3>
              <p className="text-gray-300 mb-4">
                Our technical team provides full implementation support including API documentation, webhook setup,
                and custom integration assistance.
              </p>
              <div className="flex items-center space-x-4">
                <Badge className="bg-white/20 text-white">
                  Technical Documentation Available
                </Badge>
                <Badge className="bg-white/20 text-white">
                  Sandbox Environment Included
                </Badge>
                <Badge className="bg-white/20 text-white">
                  Integration Testing Tools
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
