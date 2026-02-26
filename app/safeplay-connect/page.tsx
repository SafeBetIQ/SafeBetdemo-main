'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle,
  Code,
  Clock,
  Database,
  Globe,
  Lock,
  Zap,
  Shield,
  Plug,
  Server,
  FileJson,
  MessageSquare,
  BarChart3,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';

const platforms = [
  {
    name: 'SOFTSWISS',
    description: 'Full iGaming platform integration with real-time player data sync',
    features: ['Player activity webhooks', 'Deposit/withdrawal tracking', 'Session monitoring'],
  },
  {
    name: 'Altenar',
    description: 'Sports betting platform integration for comprehensive risk coverage',
    features: ['Bet pattern analysis', 'Live event tracking', 'Stake monitoring'],
  },
  {
    name: 'BET Software',
    description: 'South Africa\'s leading betting platform with native integration',
    features: ['SA-specific compliance', 'Branch-level reporting', 'FICA integration'],
  },
  {
    name: 'Playtech PAM',
    description: 'Enterprise platform integration for large-scale casino operators',
    features: ['Multi-brand support', 'Cross-product analytics', 'VIP tier tracking'],
  },
];

const integrationSteps = [
  {
    step: '01',
    title: 'Register & Authenticate',
    description: 'Get your API key and configure webhook endpoints in minutes. OAuth 2.0 and API key authentication supported.',
    icon: Lock,
    time: 'Day 1',
  },
  {
    step: '02',
    title: 'Connect Player Data',
    description: 'Stream player session data, deposits, and betting activity through our REST API or webhook listeners.',
    icon: Plug,
    time: 'Day 1-2',
  },
  {
    step: '03',
    title: 'Configure Risk Rules',
    description: 'Set risk thresholds, intervention triggers, and compliance rules tailored to your license requirements.',
    icon: Shield,
    time: 'Day 2-3',
  },
  {
    step: '04',
    title: 'Go Live',
    description: 'Enable real-time monitoring. Our AI starts building player profiles and scoring risk from the first session.',
    icon: Zap,
    time: 'Day 3-5',
  },
];

const apiEndpoints = [
  { method: 'POST', path: '/v1/sessions/ingest', description: 'Stream player session data' },
  { method: 'GET', path: '/v1/players/{id}/risk', description: 'Get real-time risk score' },
  { method: 'POST', path: '/v1/interventions/trigger', description: 'Trigger player intervention' },
  { method: 'GET', path: '/v1/reports/compliance', description: 'Generate compliance report' },
  { method: 'POST', path: '/v1/webhooks/configure', description: 'Set up event webhooks' },
  { method: 'GET', path: '/v1/analytics/dashboard', description: 'Fetch dashboard analytics' },
];

const capabilities = [
  {
    icon: Zap,
    title: 'AI Risk Detection',
    description: 'Real-time behavioral analysis with dynamic risk scoring from 0-100 across 150+ behavioral signals.',
  },
  {
    icon: Shield,
    title: 'RegTech Compliance',
    description: 'Automated NGA compliance monitoring, NRGP tracking, and audit-ready regulatory reporting.',
  },
  {
    icon: Code,
    title: 'RESTful API',
    description: 'Clean JSON responses, webhook support, CSV batch imports, and comprehensive API documentation.',
  },
  {
    icon: Clock,
    title: '3-5 Day Integration',
    description: 'Fast deployment with dedicated technical support, sandbox testing, and migration assistance.',
  },
  {
    icon: Lock,
    title: 'Player Protection',
    description: 'Configurable cool-off periods, deposit limits, self-exclusion management, and WhatsApp interventions.',
  },
  {
    icon: Globe,
    title: 'Regulator Reporting',
    description: 'Monthly compliance reports, complete audit trails, and CSV/PDF exports for licensing boards.',
  },
];

export default function SafeBetIQConnectPublicPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeEndpoint, setActiveEndpoint] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % integrationSteps.length);
    }, 3000);

    const endpointInterval = setInterval(() => {
      setActiveEndpoint(prev => (prev + 1) % apiEndpoints.length);
    }, 2000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(endpointInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <MainNavigation />

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 right-20 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-10 left-10 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.15, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
                  <Plug className="h-4 w-4 mr-2" />
                  Integration Platform
                </Badge>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                SafeBet IQ
                <br />
                <span className="text-brand-400">Connect</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-gray-400 mb-8 leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Plug-and-play responsible gambling intelligence for any casino platform.
                One API integration gives you real-time risk scoring, automated player
                protection, and regulator-grade compliance -- live in under a week.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Link href="/contact">
                  <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8 py-6 text-lg rounded-full transform hover:scale-105 transition-transform">
                    Get API Access
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="border-brand-400 bg-transparent text-brand-400 hover:bg-brand-400 hover:text-black px-8 py-6 text-lg rounded-full transform hover:scale-105 transition-transform">
                    Talk to Engineering
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                className="flex items-center space-x-8 mt-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {[
                  { value: '3-5 days', label: 'To Go Live' },
                  { value: '99.9%', label: 'Uptime SLA' },
                  { value: '<50ms', label: 'API Latency' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <Card className="bg-gray-950 border-gray-800 overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gray-900 px-4 py-3 flex items-center space-x-2 border-b border-gray-800">
                    <div className="flex space-x-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/70" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                      <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    </div>
                    <span className="text-xs text-gray-500 ml-2 font-mono">api.safebetiq.com</span>
                  </div>
                  <div className="p-5 font-mono text-sm space-y-3">
                    {apiEndpoints.map((endpoint, i) => (
                      <motion.div
                        key={endpoint.path}
                        className={`flex items-start space-x-3 p-2 rounded transition-all ${
                          i === activeEndpoint ? 'bg-brand-400/10 border border-brand-400/20' : ''
                        }`}
                        animate={i === activeEndpoint ? { x: 4 } : { x: 0 }}
                      >
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          endpoint.method === 'GET'
                            ? 'bg-green-400/20 text-green-400'
                            : 'bg-blue-400/20 text-blue-400'
                        }`}>
                          {endpoint.method}
                        </span>
                        <div>
                          <div className="text-gray-300 text-xs">{endpoint.path}</div>
                          <div className="text-gray-600 text-xs mt-0.5">{endpoint.description}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need, <span className="text-brand-400">One Integration</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              SafeBet IQ Connect bundles AI risk detection, player protection, and regulatory
              compliance into a single API -- so you can focus on running your casino.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap, index) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="bg-gray-950 border-gray-800 hover:border-brand-400/40 transition-all h-full group">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-brand-400/10 flex items-center justify-center mb-4 group-hover:bg-brand-400/20 transition-colors">
                      <cap.icon className="h-6 w-6 text-brand-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{cap.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{cap.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <RefreshCw className="h-4 w-4 mr-2" />
              Integration Timeline
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Live in <span className="text-brand-400">Under a Week</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Our streamlined integration process gets you from first API call to full
              production monitoring in 3-5 business days.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {integrationSteps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                <Card className={`h-full transition-all ${
                  index === activeStep
                    ? 'bg-gray-950 border-brand-400/50'
                    : 'bg-gray-950 border-gray-800'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-brand-400/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-brand-400" />
                      </div>
                      <Badge variant="outline" className="border-gray-700 text-gray-400 text-xs">
                        {item.time}
                      </Badge>
                    </div>
                    <div className="text-xs text-brand-400 font-bold mb-1">STEP {item.step}</div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
              <Database className="h-4 w-4 mr-2" />
              Platform Compatibility
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Works With Your <span className="text-brand-400">Existing Stack</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Pre-built integrations for the platforms that power South African and international casinos.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -3 }}
              >
                <Card className="bg-gray-950 border-gray-800 hover:border-brand-400/40 transition-all h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-400/10 flex items-center justify-center flex-shrink-0">
                        <Server className="h-6 w-6 text-brand-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">{platform.name}</h3>
                        <p className="text-sm text-gray-400 mb-3">{platform.description}</p>
                        <div className="space-y-1.5">
                          {platform.features.map((feature) => (
                            <div key={feature} className="flex items-center space-x-2">
                              <CheckCircle className="h-3.5 w-3.5 text-brand-400 flex-shrink-0" />
                              <span className="text-xs text-gray-400">{feature}</span>
                            </div>
                          ))}
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

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <FileJson className="h-4 w-4 mr-2" />
                Developer-Friendly
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Built by Engineers, <span className="text-brand-400">for Engineers</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                Clean RESTful endpoints, comprehensive documentation, webhook support, and a
                full sandbox environment. Your engineering team will have everything they need
                to integrate quickly and confidently.
              </p>

              <div className="space-y-4">
                {[
                  { title: 'RESTful JSON API', desc: 'Predictable endpoints with consistent response schemas' },
                  { title: 'Webhook Events', desc: 'Real-time event notifications for risk alerts and interventions' },
                  { title: 'Sandbox Environment', desc: 'Full test environment with simulated player data' },
                  { title: 'CSV Batch Import', desc: 'Bulk import historical data for immediate baseline profiling' },
                  { title: 'SDKs & Libraries', desc: 'JavaScript, Python, and PHP client libraries available' },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    className="flex items-start space-x-3"
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-medium">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-gray-950 border-gray-800 overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gray-900 px-4 py-3 flex items-center space-x-2 border-b border-gray-800">
                    <div className="flex space-x-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/70" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                      <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    </div>
                    <span className="text-xs text-gray-500 ml-2 font-mono">Response Example</span>
                  </div>
                  <div className="p-5 font-mono text-xs leading-relaxed">
                    <div className="text-gray-500">{'// GET /v1/players/p_2847/risk'}</div>
                    <div className="mt-2 text-gray-300">{'{'}</div>
                    <div className="text-gray-400 pl-4">{'"player_id"'}: <span className="text-green-400">{'"p_2847"'}</span>,</div>
                    <div className="text-gray-400 pl-4">{'"risk_score"'}: <span className="text-yellow-400">72</span>,</div>
                    <div className="text-gray-400 pl-4">{'"risk_level"'}: <span className="text-orange-400">{'"high"'}</span>,</div>
                    <div className="text-gray-400 pl-4">{'"signals"'}: {'{'}</div>
                    <div className="text-gray-400 pl-8">{'"persona_shift"'}: <span className="text-red-400">true</span>,</div>
                    <div className="text-gray-400 pl-8">{'"loss_chasing"'}: <span className="text-red-400">true</span>,</div>
                    <div className="text-gray-400 pl-8">{'"session_fatigue"'}: <span className="text-yellow-400">0.83</span>,</div>
                    <div className="text-gray-400 pl-8">{'"deposit_anomaly"'}: <span className="text-red-400">true</span></div>
                    <div className="text-gray-400 pl-4">{'}'},</div>
                    <div className="text-gray-400 pl-4">{'"recommendation"'}: <span className="text-cyan-400">{'"trigger_cooloff"'}</span>,</div>
                    <div className="text-gray-400 pl-4">{'"confidence"'}: <span className="text-green-400">0.94</span></div>
                    <div className="text-gray-300">{'}'}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-black border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to <span className="text-brand-400">Integrate?</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              Get API access, explore the sandbox, and have SafeBet IQ Connect running
              on your platform in under a week. Our engineering team will guide you
              through every step.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8 py-6 text-lg rounded-full">
                  Request API Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/features/casinos">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-900 px-8 py-6 text-lg rounded-full">
                  Explore Casino Features
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
