'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import MainNavigation from '@/components/MainNavigation';
import { Book, CheckCircle } from 'lucide-react';

export default function ReadmePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <MainNavigation />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center space-x-3 mb-6">
          <Book className="h-10 w-10 text-brand-400" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-400 to-teal-500 text-transparent bg-clip-text">
            Integration Guide
          </h1>
        </div>
        <p className="text-xl text-gray-400 mb-12">
          Complete guide to integrating SafeBet IQ Connect with your casino platform
        </p>

        <div className="space-y-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">What is SafeBet IQ Connect?</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                SafeBet IQ Connect is a RegTech compliance engine for casino platforms. We provide:
              </p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                  <span>AI-powered risk detection and player behavior analysis</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                  <span>Automated interventions and protective limits</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                  <span>Regulator-grade compliance reporting</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Integration Timeline</h2>
              <p className="text-gray-400 mb-6">
                Estimated integration time: <strong className="text-brand-400">3-5 business days</strong>
              </p>
              <div className="space-y-4">
                <div className="border-l-4 border-brand-400 pl-4">
                  <h3 className="font-semibold text-lg mb-1">Phase 1: Planning (Day 1-2)</h3>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Initial technical consultation</li>
                    <li>• API key provisioning</li>
                    <li>• Data mapping and architecture review</li>
                  </ul>
                </div>
                <div className="border-l-4 border-brand-400 pl-4">
                  <h3 className="font-semibold text-lg mb-1">Phase 2: Implementation (Day 3-4)</h3>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• API endpoint integration</li>
                    <li>• Webhook configuration</li>
                    <li>• Testing in staging environment</li>
                  </ul>
                </div>
                <div className="border-l-4 border-brand-400 pl-4">
                  <h3 className="font-semibold text-lg mb-1">Phase 3: Deployment (Day 5)</h3>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Production deployment</li>
                    <li>• Real-time monitoring</li>
                    <li>• Final testing and validation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-gradient-to-r from-brand-400/10 to-teal-500/10 border border-brand-400/20 rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">Contact Information</h3>
            <p className="text-gray-400 mb-6">
              Ready to integrate SafeBet IQ Connect? Our technical team is standing by.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold">
                  Request Demo
                </Button>
              </Link>
              <Link href="/safeplay-connect/postman-samples">
                <Button size="lg" variant="outline" className="border-gray-700 hover:bg-gray-800">
                  Download Integration Kit
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
