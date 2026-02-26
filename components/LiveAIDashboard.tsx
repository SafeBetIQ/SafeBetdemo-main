'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Shield, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function LiveAIDashboard() {
  const [interventionCount, setInterventionCount] = useState(0);
  const [complianceScore, setComplianceScore] = useState(0);

  useEffect(() => {
    const interval1 = setInterval(() => {
      setInterventionCount((prev) => (prev < 47 ? prev + 1 : 47));
    }, 50);

    const interval2 = setInterval(() => {
      setComplianceScore((prev) => (prev < 94 ? prev + 1 : 94));
    }, 30);

    return () => {
      clearInterval(interval1);
      clearInterval(interval2);
    };
  }, []);

  const riskLevels = [
    { level: 'Low', count: 892, color: 'bg-green-500', percentage: 75 },
    { level: 'Medium', count: 234, color: 'bg-yellow-500', percentage: 20 },
    { level: 'High', count: 45, color: 'bg-orange-500', percentage: 4 },
    { level: 'Critical', count: 12, color: 'bg-red-500', percentage: 1 },
  ];

  const liveAlerts = [
    { player: 'Thabo Nkosi', risk: 'High', action: 'Cool-off triggered', time: '2s ago' },
    { player: 'Lerato Dlamini', risk: 'Medium', action: 'Spending alert', time: '8s ago' },
    { player: 'Sipho Mthembu', risk: 'Critical', action: 'Self-exclusion', time: '15s ago' },
    { player: 'Nomsa Khumalo', risk: 'High', action: 'Session limit', time: '23s ago' },
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-black via-gray-900/50 to-black relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-400/10 via-transparent to-transparent"></div>

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-brand-400/10 text-brand-400 border-brand-400/20 text-sm px-4 py-1">
            DEMO MODE
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 relative inline-block">
            <span className="relative">
              Live AI Player Risk Monitoring
              <motion.div
                className="absolute -inset-2 bg-gradient-to-r from-brand-400/20 to-teal-500/20 blur-xl"
                animate={{
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">
            Simulated live monitoring feed. This demo shows how SafeBet IQ detects risky player behavior in real-time.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="text-lg">Player Risk Levels</span>
                  <Activity className="h-5 w-5 text-brand-400" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskLevels.map((risk, index) => (
                    <motion.div
                      key={risk.level}
                      initial={{ width: 0 }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">{risk.level}</span>
                        <span className="text-sm font-semibold text-white">{risk.count}</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <motion.div
                          className={`h-full ${risk.color}`}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${risk.percentage}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="text-lg">Live AI Alerts</span>
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {liveAlerts.map((alert, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.7 + index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-brand-400/30 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          alert.risk === 'Critical' ? 'bg-red-500' :
                          alert.risk === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                        } animate-pulse`} />
                        <div>
                          <div className="text-sm font-medium text-white">{alert.player}</div>
                          <div className="text-xs text-gray-400">{alert.action}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{alert.time}</div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="text-lg">Interventions</span>
                  <Shield className="h-5 w-5 text-blue-400" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div
                  className="text-5xl font-bold text-brand-400 mb-2"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', duration: 0.8, delay: 0.5 }}
                >
                  {interventionCount}
                </motion.div>
                <p className="text-sm text-gray-400 mb-4">triggered today</p>
                <div className="flex items-center text-green-400 text-sm">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  <span>+12% vs yesterday</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6"
        >
          <Card className="bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <span className="text-lg">Compliance Score</span>
                <Shield className="h-5 w-5 text-brand-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <motion.div
                    className="text-6xl font-bold text-brand-400"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                  >
                    {complianceScore}%
                  </motion.div>
                  <p className="text-gray-400 mt-2">System Compliance Rating</p>
                </div>
                <div className="relative w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-800"
                    />
                    <motion.circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 56}
                      initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                      whileInView={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - 0.94) }}
                      viewport={{ once: true }}
                      transition={{ duration: 2, delay: 0.8 }}
                      className="text-brand-400"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
