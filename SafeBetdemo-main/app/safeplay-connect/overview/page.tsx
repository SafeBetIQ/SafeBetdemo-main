'use client';

import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Zap, Lock, Globe, Shield, Code, Clock, Database } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SafeBetIQOverviewPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">SafeBet IQ Connect</h1>
          <p className="text-muted-foreground mt-2">
            Plug & Play Integration for Casino Platforms
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <Shield className="h-10 w-10 text-brand-400 mb-4" />
              <h3 className="font-semibold mb-2">RegTech Compliance</h3>
              <p className="text-sm text-muted-foreground">
                Automated compliance monitoring and regulatory reporting
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Zap className="h-10 w-10 text-brand-400 mb-4" />
              <h3 className="font-semibold mb-2">AI Risk Detection</h3>
              <p className="text-sm text-muted-foreground">
                Real-time player behavior analysis and intervention triggers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Code className="h-10 w-10 text-brand-400 mb-4" />
              <h3 className="font-semibold mb-2">API-Ready Integration</h3>
              <p className="text-sm text-muted-foreground">
                RESTful API with JSON responses and CSV batch support
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Clock className="h-10 w-10 text-brand-400 mb-4" />
              <h3 className="font-semibold mb-2">3-5 Day Integration</h3>
              <p className="text-sm text-muted-foreground">
                Fast deployment with comprehensive technical support
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-brand-400" />
              Real-Time AI Risk Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Our machine learning engine analyzes player behavior in real-time, detecting patterns that indicate problem gambling.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>Behavioral pattern analysis</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>Dynamic risk scoring (0-100)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>Automatic intervention triggers</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-brand-400" />
              Automated Player Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              When risk thresholds are exceeded, SafePlay automatically initiates protective measures.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>Configurable cool-off periods (1-72 hours)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>Daily/weekly deposit limits</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>WhatsApp intervention messaging</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-brand-400" />
              Regulator-Grade Reporting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Generate comprehensive compliance reports that meet South African regulatory requirements.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>Monthly compliance reports</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>Complete audit trail</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brand-400 flex-shrink-0" />
                <span>CSV/PDF export options</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compatible Casino Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Works seamlessly with SOFTSWISS, Altenar, BET Software & Playtech PAM
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['SOFTSWISS', 'Altenar', 'BET Software', 'Playtech PAM'].map((platform) => (
                <div key={platform} className="border rounded-lg p-4 flex flex-col items-center justify-center">
                  <Database className="h-10 w-10 text-brand-400 mb-2" />
                  <h3 className="font-semibold text-center">{platform}</h3>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
