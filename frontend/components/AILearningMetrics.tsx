'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Brain, Target, CheckCircle, Activity, Zap } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface LearningMetricsProps {
  casinoName?: string;
  periodStart: string;
  periodEnd: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracyPercent: number;
  accuracyChangePercent: number;
  baselineAccuracyPercent: number;
  novaIQEnhancedPredictions: number;
  novaIQAccuracyLiftPercent: number;
  totalInterventions: number;
  successfulInterventions: number;
  successRatePercent: number;
  confidenceScoreAvg: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  learningGeneration: number;
  showGlobal?: boolean;
}

export function AILearningMetrics({
  casinoName,
  periodStart,
  periodEnd,
  totalPredictions,
  correctPredictions,
  accuracyPercent,
  accuracyChangePercent,
  baselineAccuracyPercent,
  novaIQEnhancedPredictions,
  novaIQAccuracyLiftPercent,
  totalInterventions,
  successfulInterventions,
  successRatePercent,
  confidenceScoreAvg,
  falsePositiveRate,
  falseNegativeRate,
  learningGeneration,
  showGlobal = false,
}: LearningMetricsProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return 'text-green-600';
    if (accuracy >= 70) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span>+{formatPercentage(change)}</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingUp className="h-4 w-4 rotate-180" />
          <span>{formatPercentage(change)}</span>
        </div>
      );
    }
    return <span className="text-gray-600">No change</span>;
  };

  return (
    <Card className="border-2 border-brand-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-brand-600" />
              AI Learning Performance Metrics
            </CardTitle>
            <CardDescription>
              {showGlobal ? 'Global System Performance' : casinoName || 'Casino Performance'}
              {' • '}{formatDate(periodStart)} to {formatDate(periodEnd)}
            </CardDescription>
          </div>
          <Badge className="bg-brand-100 text-brand-600 border-0">
            Generation {learningGeneration}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-br from-brand-50 to-brand-100 rounded-lg border-2 border-brand-300">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-medium text-brand-900">AI Accuracy</span>
            </div>
            <div className={`text-3xl font-bold ${getAccuracyColor(accuracyPercent)}`}>
              {formatPercentage(accuracyPercent)}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-brand-700">vs baseline {formatPercentage(baselineAccuracyPercent)}</span>
              {getChangeIndicator(accuracyChangePercent)}
            </div>
            <Progress value={accuracyPercent} className="h-1 mt-2" />
          </div>

          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border-2 border-purple-300">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-900">Nova IQ Impact</span>
            </div>
            <div className="text-3xl font-bold text-purple-600">
              +{formatPercentage(novaIQAccuracyLiftPercent)}
            </div>
            <div className="text-xs text-purple-700 mt-2">
              {novaIQEnhancedPredictions} predictions enhanced
            </div>
            <Progress value={novaIQAccuracyLiftPercent} className="h-1 mt-2" />
          </div>

          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border-2 border-green-300">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-900">Success Rate</span>
            </div>
            <div className="text-3xl font-bold text-green-600">
              {formatPercentage(successRatePercent)}
            </div>
            <div className="text-xs text-green-700 mt-2">
              {successfulInterventions} of {totalInterventions} interventions
            </div>
            <Progress value={successRatePercent} className="h-1 mt-2" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm font-semibold text-gray-900 mb-3">Prediction Performance</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Total Predictions</span>
                <span className="font-bold text-gray-900">{totalPredictions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Correct Predictions</span>
                <span className="font-bold text-green-600">{correctPredictions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Avg Confidence Score</span>
                <span className="font-bold text-brand-600">{formatPercentage(confidenceScoreAvg)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm font-semibold text-gray-900 mb-3">Error Rates</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">False Positive Rate</span>
                <span className="font-bold text-orange-600">{formatPercentage(falsePositiveRate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">False Negative Rate</span>
                <span className="font-bold text-red-600">{formatPercentage(falseNegativeRate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Combined Error Rate</span>
                <span className="font-bold text-gray-900">
                  {formatPercentage(falsePositiveRate + falseNegativeRate)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {accuracyChangePercent > 0 && (
          <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-green-600" />
              <span className="font-bold text-green-900">AI Learning Progress</span>
            </div>
            <p className="text-sm text-green-700">
              The AI system has improved its accuracy by <strong>{formatPercentage(accuracyChangePercent)}</strong> over the past {learningGeneration} learning cycles.
              {novaIQAccuracyLiftPercent > 0 && (
                <> Nova IQ behavioral assessments contributed an additional <strong>{formatPercentage(novaIQAccuracyLiftPercent)}</strong> accuracy lift.</>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Activity className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Continuous Learning</div>
              <p className="text-xs text-gray-600 mt-1">
                AI models are continuously refined based on real intervention outcomes
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Privacy-Safe Intelligence</div>
              <p className="text-xs text-gray-600 mt-1">
                Learning occurs without exposing personal data between operators
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <TrendingUp className="h-3 w-3" />
            <span>
              System performance metrics are auditable and compliant with regulatory requirements.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
