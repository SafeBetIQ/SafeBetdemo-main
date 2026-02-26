'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, TrendingUp, Minus, CheckCircle, AlertCircle, Brain, Activity, Clock } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface OutcomeData {
  id: string;
  playerId: string;
  interventionType: string;
  appliedAt: string;
  novaIQInfluenced: boolean;
  preRiskScore: number;
  preImpulsivityScore?: number;
  postRiskScore7d?: number;
  postRiskScore14d?: number;
  postRiskScore30d?: number;
  outcome: 'risk_reduced' | 'stabilized' | 'escalated' | 'no_change';
  effectivenessScore: number;
  timeToImpactDays?: number;
  playerResponse?: string;
  playerEngagementLevel?: string;
  showAnonymized?: boolean;
}

export function InterventionOutcomeTracker({
  id,
  playerId,
  interventionType,
  appliedAt,
  novaIQInfluenced,
  preRiskScore,
  preImpulsivityScore,
  postRiskScore7d,
  postRiskScore14d,
  postRiskScore30d,
  outcome,
  effectivenessScore,
  timeToImpactDays,
  playerResponse,
  playerEngagementLevel,
  showAnonymized = false,
}: OutcomeData) {
  const getOutcomeColor = (outcomeType: string) => {
    switch (outcomeType) {
      case 'risk_reduced': return 'bg-green-100 text-green-700 border-green-300';
      case 'stabilized': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'escalated': return 'bg-red-100 text-red-700 border-red-300';
      case 'no_change': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getOutcomeIcon = (outcomeType: string) => {
    switch (outcomeType) {
      case 'risk_reduced': return <TrendingDown className="h-4 w-4" />;
      case 'stabilized': return <Minus className="h-4 w-4" />;
      case 'escalated': return <TrendingUp className="h-4 w-4" />;
      case 'no_change': return <Minus className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getOutcomeLabel = (outcomeType: string) => {
    switch (outcomeType) {
      case 'risk_reduced': return 'Risk Reduced';
      case 'stabilized': return 'Stabilized';
      case 'escalated': return 'Risk Escalated';
      case 'no_change': return 'No Significant Change';
      default: return outcomeType;
    }
  };

  const getRiskChange = () => {
    if (!postRiskScore30d) return null;
    const change = preRiskScore - postRiskScore30d;
    const percentChange = (change / preRiskScore) * 100;
    return { change, percentChange };
  };

  const riskChange = getRiskChange();

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Intervention Outcome Tracker
            </CardTitle>
            <CardDescription>
              {showAnonymized ? 'Anonymized Player' : `Player ${playerId}`} • {interventionType}
              {' • Applied '}{new Date(appliedAt).toLocaleDateString()}
            </CardDescription>
          </div>
          <Badge className={getOutcomeColor(outcome) + ' flex items-center gap-1'}>
            {getOutcomeIcon(outcome)}
            {getOutcomeLabel(outcome)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {novaIQInfluenced && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <Brain className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">
              Nova IQ behavioral assessment influenced this intervention
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">Effectiveness Score</div>
            <div className="text-3xl font-bold text-brand-600 mb-2">{effectivenessScore}/100</div>
            <Progress value={effectivenessScore} className="h-2" />
          </div>

          {timeToImpactDays && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Time to Impact</div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-gray-900">{timeToImpactDays}</div>
                <div className="text-sm text-gray-600">days</div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>Measurable change detected</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Risk Score Progression</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
              <div>
                <span className="text-sm font-medium text-gray-900">Pre-Intervention</span>
                {preImpulsivityScore && (
                  <div className="text-xs text-gray-500">Impulsivity: {preImpulsivityScore}</div>
                )}
              </div>
              <div className="text-xl font-bold text-gray-900">{preRiskScore}</div>
            </div>

            {postRiskScore7d && (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                <span className="text-sm font-medium text-gray-900">After 7 Days</span>
                <div className="flex items-center gap-2">
                  <div className="text-xl font-bold text-gray-900">{postRiskScore7d}</div>
                  {postRiskScore7d < preRiskScore && (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </div>
            )}

            {postRiskScore14d && (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                <span className="text-sm font-medium text-gray-900">After 14 Days</span>
                <div className="flex items-center gap-2">
                  <div className="text-xl font-bold text-gray-900">{postRiskScore14d}</div>
                  {postRiskScore14d < preRiskScore && (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </div>
            )}

            {postRiskScore30d && (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                <span className="text-sm font-medium text-gray-900">After 30 Days</span>
                <div className="flex items-center gap-2">
                  <div className="text-xl font-bold text-gray-900">{postRiskScore30d}</div>
                  {postRiskScore30d < preRiskScore && (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </div>
            )}
          </div>

          {riskChange && (
            <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Risk Reduction</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    riskChange.change > 0 ? 'text-green-600' :
                    riskChange.change < 0 ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {riskChange.change > 0 ? '-' : '+'}{Math.abs(riskChange.change)} points
                  </span>
                  <span className="text-sm text-gray-500">
                    ({formatPercentage(Math.abs(Number(riskChange.percentChange)))})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {(playerResponse || playerEngagementLevel) && (
          <div className="grid grid-cols-2 gap-4">
            {playerResponse && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Player Response</div>
                <div className="text-sm font-medium text-gray-900">{playerResponse}</div>
              </div>
            )}
            {playerEngagementLevel && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Engagement Level</div>
                <div className="text-sm font-medium text-gray-900">{playerEngagementLevel}</div>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <CheckCircle className="h-3 w-3" />
            <span>
              Outcome data feeds into AI learning system to improve future intervention recommendations.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
