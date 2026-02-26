'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';
import { Eye, FileText, BarChart3, CheckCircle, ArrowRight, Menu, X, Globe, AlertTriangle, Lock, Database, Bell, Building2, GraduationCap, Award, Users, Download, TrendingUp, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function RegulatorsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [animatedStats, setAnimatedStats] = useState({
    casinos: 24,
    staff: 1847,
    enrollments: 892,
    completion: 87
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedStats({
        casinos: Math.floor(Math.random() * 5) + 22,
        staff: Math.floor(Math.random() * 200) + 1750,
        enrollments: Math.floor(Math.random() * 100) + 850,
        completion: Math.floor(Math.random() * 5) + 85
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <MainNavigation />

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 8, repeat: Infinity }}
          ></motion.div>
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5]
            }}
            transition={{ duration: 8, repeat: Infinity }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
                <Eye className="h-4 w-4 mr-2" />
                For Gaming Regulators
              </Badge>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Complete Industry Oversight.
              <br />
              <span className="text-brand-400">Simplified Compliance.</span>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Monitor all licensed operators, track industry-wide risk trends, and ensure responsible gambling standards.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Link href="/contact">
                <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-8 py-6 text-lg rounded-full transform hover:scale-105 transition-transform">
                  Request Access<ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Comprehensive Regulatory Oversight Platform
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Monitor industry compliance, track operator performance, and oversee training standards across all licensed casinos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {[
              {
                icon: Building2,
                title: 'Multi-Casino Dashboard',
                description: 'Monitor all licensed operators from a single unified dashboard with real-time data across every casino in your jurisdiction.',
                features: ['View all casino operations', 'Real-time compliance status', 'License verification']
              },
              {
                icon: GraduationCap,
                title: 'Training Academy Oversight',
                description: 'Monitor staff training compliance, certification status, and educational standards across all casino operators.',
                features: ['Staff certification tracking', 'Course completion rates', 'Training credit verification']
              },
              {
                icon: Users,
                title: 'Staff Compliance Monitoring',
                description: 'Track total industry staff, active certifications, and training participation across all licensed operators.',
                features: ['Industry-wide staff count', 'Enrollment statistics', 'Progress tracking']
              },
              {
                icon: FileText,
                title: 'Comprehensive Audit Reports',
                description: 'Generate detailed compliance reports with complete training records, certification data, and audit trails for each operator.',
                features: ['PDF report generation', 'Complete audit trails', 'Exportable data formats']
              },
              {
                icon: Award,
                title: 'Credits & Certification System',
                description: 'Monitor industry-wide professional development credits and certification compliance for responsible gambling standards.',
                features: ['Total credits earned', 'Certification verification', 'Compliance scoring']
              },
              {
                icon: Lock,
                title: 'Secure Read-Only Access',
                description: 'Enterprise-grade security with read-only permissions ensuring data integrity while providing complete oversight.',
                features: ['Read-only access', 'Audit trail logging', 'Secure authentication']
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                onHoverStart={() => setActiveFeature(index)}
                onHoverEnd={() => setActiveFeature(-1)}
              >
                <Card className={`bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all h-full cursor-pointer ${activeFeature === index ? 'shadow-xl shadow-brand-400/20' : ''}`}>
                  <CardContent className="p-8">
                    <motion.div
                      className="w-14 h-14 bg-gradient-to-br from-brand-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6"
                      animate={{
                        rotate: activeFeature === index ? [0, -10, 10, -10, 0] : 0
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      <feature.icon className="h-7 w-7 text-black" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-400 mb-4">{feature.description}</p>
                    <ul className="space-y-2 text-sm text-gray-300">
                      {feature.features.map((item, i) => (
                        <motion.li
                          key={i}
                          className="flex items-center"
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay: 0.5 + (i * 0.1) }}
                        >
                          <CheckCircle className="h-4 w-4 text-brand-400 mr-2" />{item}
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 md:p-12"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="mb-6 bg-brand-400/10 text-brand-400 border-brand-400/20">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Real-Time Analytics
                </Badge>
                <h3 className="text-3xl font-bold text-white mb-6">
                  Industry-Wide Performance Metrics
                </h3>
                <p className="text-gray-400 mb-8 leading-relaxed">
                  Access comprehensive statistics across all licensed operators including total staff counts, enrollment metrics, completion rates, and compliance scores.
                </p>
                <div className="space-y-4">
                  {['Total Industry Staff', 'Training Enrollments', 'Avg Completion Rate'].map((label, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center justify-between p-4 bg-gray-950 rounded-lg border border-gray-800"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.1 }}
                    >
                      <span className="text-gray-300">{label}</span>
                      <Badge className="bg-brand-400/10 text-brand-400 border-0">
                        {i === 0 ? 'Live Tracking' : i === 1 ? 'Real-Time' : 'Updated Daily'}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </div>
              <motion.div
                className="bg-gray-950 rounded-xl border border-gray-800 p-8"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-sm text-gray-400 mb-6">Regulator Dashboard Preview</div>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="text-center">
                    <motion.div
                      className="text-4xl font-bold text-brand-400 mb-2"
                      key={animatedStats.casinos}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {animatedStats.casinos}
                    </motion.div>
                    <div className="text-sm text-gray-400">Licensed Casinos</div>
                  </div>
                  <div className="text-center">
                    <motion.div
                      className="text-4xl font-bold text-brand-400 mb-2"
                      key={animatedStats.staff}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {animatedStats.staff.toLocaleString()}
                    </motion.div>
                    <div className="text-sm text-gray-400">Total Staff</div>
                  </div>
                  <div className="text-center">
                    <motion.div
                      className="text-4xl font-bold text-brand-400 mb-2"
                      key={animatedStats.enrollments}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {animatedStats.enrollments}
                    </motion.div>
                    <div className="text-sm text-gray-400">Enrollments</div>
                  </div>
                  <div className="text-center">
                    <motion.div
                      className="text-4xl font-bold text-brand-400 mb-2"
                      key={animatedStats.completion}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {animatedStats.completion}%
                    </motion.div>
                    <div className="text-sm text-gray-400">Completion Rate</div>
                  </div>
                </div>
                <Button className="w-full bg-brand-400 hover:bg-brand-500 text-black font-semibold transform hover:scale-105 transition-transform">
                  <Download className="mr-2 h-4 w-4" />
                  Generate Industry Report
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              Why Choose SafeBet IQ for Regulatory Oversight
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Trusted by gaming authorities across South Africa
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: TrendingUp,
                title: 'Simplified Compliance Management',
                description: 'Reduce regulatory burden with automated reporting and real-time compliance tracking. Access all operator data from one centralized platform.'
              },
              {
                icon: Activity,
                title: 'Proactive Industry Oversight',
                description: 'Identify non-compliant operators early and ensure industry-wide adherence to responsible gambling standards and training requirements.'
              },
              {
                icon: Database,
                title: 'Complete Data Transparency',
                description: 'Access detailed operator records, staff training data, and certification information with full audit trail documentation.'
              },
              {
                icon: Bell,
                title: 'Automated Alerts & Notifications',
                description: 'Receive instant notifications when operators fall below compliance thresholds or require regulatory attention.'
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <Card className="bg-gray-900/50 border-gray-800 hover:border-brand-400/50 transition-all h-full">
                  <CardContent className="p-8">
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      <benefit.icon className="h-12 w-12 text-brand-400 mb-4" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-3">{benefit.title}</h3>
                    <p className="text-gray-400">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
