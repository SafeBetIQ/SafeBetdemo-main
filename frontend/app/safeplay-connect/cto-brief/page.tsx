'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import MainNavigation from '@/components/MainNavigation';
import { Zap, Database, Lock, Globe } from 'lucide-react';

export default function CTOBriefPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <MainNavigation />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brand-400 to-teal-500 text-transparent bg-clip-text">
          Technical Brief for Casino CTOs
        </h1>
        <p className="text-xl text-gray-400 mb-12">2-minute technical overview of SafeBet IQ Connect architecture</p>
        
        <div className="space-y-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Executive Summary</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                SafeBet IQ Connect is a <strong className="text-brand-400">plug-and-play compliance layer</strong> that sits on top of your existing casino platform.
              </p>
              <p className="text-gray-300 leading-relaxed">
                <strong className="text-brand-400">No migration required.</strong> Integration typically takes 3-5 days.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6">Architecture Overview</h2>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Database className="h-8 w-8 text-blue-400" />
                    <div>
                      <div className="font-semibold text-white">Your Casino Platform</div>
                      <div className="text-sm text-gray-400">SOFTSWISS / Altenar / BET Software / Playtech PAM</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-8 bg-brand-400"></div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Zap className="h-8 w-8 text-brand-400" />
                    <div>
                      <div className="font-semibold text-white">SafeBet IQ Connect API Layer</div>
                      <div className="text-sm text-gray-400">RESTful JSON API / CSV Batch Import</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-gradient-to-r from-brand-400/10 to-teal-500/10 border border-brand-400/20 rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">Ready to Discuss Technical Details?</h3>
            <p className="text-gray-400 mb-6">
              Schedule a technical deep-dive with our engineering team.
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold">
                Schedule Technical Call
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
