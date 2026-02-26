'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp, TrendingDown, Activity, Brain, Target } from 'lucide-react';

interface ContributingFactor {
  factor: string;
  weight_percent: number;
  source: 'live_casino' | 'nova_iq' | 'combined';
  time_period?: string;
  trend?: 'increasing' | 'stable' | 'decreasing';
}

interface ReasonStackProps {
  playerId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  contributingFactors: ContributingFactor[];
  novaIQWeightPercent?: number;
  casinoDataWeightPercent?: number;
  explanationSummary?: string;
  triggers24h?: any[];
  triggers7d?: any[];
  triggers30d?: any[];
  timestamp?: string;
  showAnonymized?: boolean;
}

export function ReasonStackDisplay({
  playerId,
  riskLevel,
  confidenceScore,
  contributingFactors,
  novaIQWeightPercent = 0,
  casinoDataWeightPercent = 0,
  explanationSummary,
  triggers24h = [],
  triggers7d = [],
  triggers30d = [],
  timestamp,
  showAnonymized = false,
}: ReasonStackProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'nova_iq': return <Brain className="h-4 w-4" />;
      case 'live_casino': return <Activity className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'nova_iq': return 'Nova IQ Assessment';
      case 'live_casino': return 'Live Casino Data';
      default: return 'Combined Analysis';
    }
  };

  const getTrendIcon = (trend?: string) => {
    if (!trend) return null;
    return trend === 'increasing' ?
      <TrendingUp className="h-3 w-3 text-red-600" /> :
      <TrendingDown className="h-3 w-3 text-green-600" />;
  };

  const sortedFactors = [...contributingFactors].sort((a, b) => b.weight_percent - a.weight_percent);
  const topFactors = sortedFactors.slice(0, 5);

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Explainable AI Reason Stack
            </CardTitle>
            <CardDescription>
              {showAnonymized ? 'Anonymized Player Profile' : `Player ${playerId}`}
              {timestamp && ` • ${new Date(timestamp).toLocaleString()}`}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={getRiskColor(riskLevel)}>
              {riskLevel.toUpperCase()} RISK
            </Badge>
            <div className="text-sm text-gray-600">
              AI Confidence: <span className="font-bold">{confidenceScore}%</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {explanationSummary && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-1">Analysis Summary</p>
            <p className="text-sm text-blue-700">{explanationSummary}</p>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Contributing Factors</h4>
          <div className="space-y-3">
            {topFactors.map((factor, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    {getSourceIcon(factor.source)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{factor.factor}</span>
                        {getTrendIcon(factor.trend)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getSourceLabel(factor.source)}
                        </Badge>
                        {factor.time_period && (
                          <span className="text-xs text-gray-500">{factor.time_period}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-lg font-bold text-brand-600">{factor.weight_percent}%</span>
                  </div>
                </div>
                <Progress value={factor.weight_percent} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        {(novaIQWeightPercent > 0 || casinoDataWeightPercent > 0) && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-900">Nova IQ Behavioral Assessment</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{novaIQWeightPercent}%</div>
              <Progress value={novaIQWeightPercent} className="h-1 mt-2" />
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-900">Live Casino Data</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{casinoDataWeightPercent}%</div>
              <Progress value={casinoDataWeightPercent} className="h-1 mt-2" />
            </div>
          </div>
        )}

        {(triggers24h.length > 0 || triggers7d.length > 0 || triggers30d.length > 0) && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Behavioral Triggers</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Last 24 Hours</div>
                <div className="text-xl font-bold text-gray-900">{triggers24h.length}</div>
                <div className="text-xs text-gray-500 mt-1">triggers</div>
              </div>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Last 7 Days</div>
                <div className="text-xl font-bold text-gray-900">{triggers7d.length}</div>
                <div className="text-xs text-gray-500 mt-1">triggers</div>
              </div>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Last 30 Days</div>
                <div className="text-xl font-bold text-gray-900">{triggers30d.length}</div>
                <div className="text-xs text-gray-500 mt-1">triggers</div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <AlertCircle className="h-3 w-3" />
            <span>
              This analysis combines live gambling behavior data with Nova IQ behavioral assessment outputs.
              All factors are auditable and regulator-approved.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
