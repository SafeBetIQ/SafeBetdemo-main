'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, TrendingDown, Users, Activity } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface NovaIQData {
  totalSessions: number;
  completedSessions: number;
  avgRiskIndex: number;
  avgImpulsivityScore: number;
  avgPatienceScore: number;
  highRiskCount: number;
  recentTrend: 'improving' | 'stable' | 'declining';
  completionRate: number;
}

interface NovaIQResultsCardProps {
  data: NovaIQData | null;
  loading?: boolean;
}

export function NovaIQResultsCard({ data, loading }: NovaIQResultsCardProps) {
  if (loading) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900">Nova IQ Results</CardTitle>
              <CardDescription className="text-gray-600">Behavioral wellbeing assessments</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalSessions === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900">Nova IQ Results</CardTitle>
              <CardDescription className="text-gray-600">Behavioral wellbeing assessments</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-2">No Nova IQ sessions yet</p>
            <p className="text-gray-400 text-xs">Invite players to complete wellbeing assessments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (data.recentTrend === 'improving') {
      return <TrendingDown className="h-4 w-4 text-green-600" />;
    } else if (data.recentTrend === 'declining') {
      return <TrendingUp className="h-4 w-4 text-red-600" />;
    }
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = () => {
    if (data.recentTrend === 'improving') return 'text-green-600';
    if (data.recentTrend === 'declining') return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendLabel = () => {
    if (data.recentTrend === 'improving') return 'Risk declining';
    if (data.recentTrend === 'declining') return 'Risk increasing';
    return 'Risk stable';
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return 'text-green-600';
    if (score < 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskLabel = (score: number) => {
    if (score < 40) return 'Low Risk';
    if (score < 70) return 'Moderate Risk';
    return 'High Risk';
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900">Nova IQ Results</CardTitle>
              <CardDescription className="text-gray-600">Behavioral wellbeing assessments</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {getTrendLabel()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-1">
              <Users className="h-4 w-4 text-gray-500" />
              <p className="text-xs text-gray-600">Total Sessions</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{data.totalSessions}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-1">
              <Activity className="h-4 w-4 text-gray-500" />
              <p className="text-xs text-gray-600">Completed</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{data.completedSessions}</p>
            <p className="text-xs text-gray-500 mt-1">{formatPercentage(data.completionRate)} rate</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-1">
              <Brain className="h-4 w-4 text-gray-500" />
              <p className="text-xs text-gray-600">Avg Risk Index</p>
            </div>
            <p className={`text-2xl font-bold ${getRiskColor(data.avgRiskIndex)}`}>
              {data.avgRiskIndex.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{getRiskLabel(data.avgRiskIndex)}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-1">
              <Activity className="h-4 w-4 text-gray-500" />
              <p className="text-xs text-gray-600">High Risk</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{data.highRiskCount}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatPercentage((data.highRiskCount / Math.max(data.completedSessions, 1)) * 100)} of completed
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Behavioral Indicators</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Impulsivity Score</span>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      data.avgImpulsivityScore < 40
                        ? 'bg-green-500'
                        : data.avgImpulsivityScore < 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${data.avgImpulsivityScore}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-semibold ${getRiskColor(data.avgImpulsivityScore)}`}>
                  {data.avgImpulsivityScore.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Patience Score</span>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      data.avgPatienceScore > 60
                        ? 'bg-green-500'
                        : data.avgPatienceScore > 30
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${data.avgPatienceScore}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-semibold ${
                  data.avgPatienceScore > 60 ? 'text-green-600' : data.avgPatienceScore > 30 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {data.avgPatienceScore.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Brain className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-900 mb-1">Nova IQ Insights</p>
              <p className="text-xs text-purple-700">
                {data.avgRiskIndex < 40
                  ? 'Players showing healthy behavioral patterns. Continue monitoring.'
                  : data.avgRiskIndex < 70
                  ? 'Some concerning behavioral signals detected. Consider increasing engagement frequency.'
                  : 'Multiple high-risk indicators present. Immediate review and interventions recommended.'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
