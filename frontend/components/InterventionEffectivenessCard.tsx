'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, CheckCircle2, Phone } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface InterventionStats {
  totalInterventions: number;
  successfulInterventions: number;
  successRate: number;
  aiAlertsGenerated: number;
  helplineReferrals: number;
  counselingReferrals: number;
  averageRiskScore: number;
}

interface InterventionEffectivenessCardProps {
  stats: InterventionStats;
  className?: string;
}

export function InterventionEffectivenessCard({ stats, className }: InterventionEffectivenessCardProps) {
  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 dark:text-red-400';
    if (score >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  const getRiskBgColor = (score: number) => {
    if (score >= 80) return 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900';
    if (score >= 60) return 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900';
    return 'from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">AI-Driven Intervention Effectiveness</CardTitle>
            <CardDescription>Player protection and harm minimization outcomes</CardDescription>
          </div>
          <div className="p-3 bg-teal-100 dark:bg-teal-900 rounded-lg">
            <Target className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Overall Success Rate
              </p>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">
                {formatPercentage(stats.successRate)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Interventions
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.totalInterventions}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs text-teal-700 dark:text-teal-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{stats.successfulInterventions} successful outcomes</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                AI Alerts
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {stats.aiAlertsGenerated}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Behavioral patterns detected
            </p>
          </div>

          <div className={`p-3 bg-gradient-to-br ${getRiskBgColor(stats.averageRiskScore)} rounded-lg`}>
            <div className="flex items-center space-x-2 mb-2">
              <Target className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Avg Risk Score
              </span>
            </div>
            <p className={`text-lg font-bold ${getRiskColor(stats.averageRiskScore)}`}>
              {stats.averageRiskScore}/100
            </p>
            <Badge
              variant="outline"
              className="mt-1 text-xs"
            >
              {stats.averageRiskScore >= 80 ? 'High' : stats.averageRiskScore >= 60 ? 'Medium' : 'Low'}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg">
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Helpline Referrals
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  NRGP 0800 006 008
                </p>
              </div>
            </div>
            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {stats.helplineReferrals}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Counseling Referrals
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  SARGF treatment network
                </p>
              </div>
            </div>
            <span className="text-xl font-bold text-purple-700 dark:text-purple-300">
              {stats.counselingReferrals}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 leading-relaxed">
            AI-powered behavioral analysis enables early detection and proactive intervention,
            aligned with industry-leading standards for responsible gambling and player protection.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
