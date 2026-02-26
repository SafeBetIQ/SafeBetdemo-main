'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import MainNavigation from '@/components/MainNavigation';
import { ReasonStackDisplay } from '@/components/ReasonStackDisplay';
import { AIInterventionRecommendation } from '@/components/AIInterventionRecommendation';
import { InterventionOutcomeTracker } from '@/components/InterventionOutcomeTracker';
import { AILearningMetrics } from '@/components/AILearningMetrics';
import { Brain, Sparkles, TrendingUp, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function NovaIQXAIPage() {
  const [learningMetrics, setLearningMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLearningMetrics();
  }, []);

  async function loadLearningMetrics() {
    try {
      const { data, error } = await supabase
        .from('ai_learning_metrics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLearningMetrics(data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }

  // Sample data for demo
  const sampleReasonStack = {
    playerId: 'P-8472',
    riskLevel: 'high' as const,
    confidenceScore: 87,
    contributingFactors: [
      {
        factor: 'Loss-chasing behavior detected',
        weight_percent: 38,
        source: 'live_casino' as const,
        time_period: '24h',
        trend: 'increasing' as const,
      },
      {
        factor: 'Session escalation above baseline',
        weight_percent: 27,
        source: 'live_casino' as const,
        time_period: '24h vs 7d',
        trend: 'increasing' as const,
      },
      {
        factor: 'High impulsivity index',
        weight_percent: 21,
        source: 'nova_iq' as const,
        time_period: 'assessment',
        trend: 'stable' as const,
      },
      {
        factor: 'High spend volatility',
        weight_percent: 14,
        source: 'live_casino' as const,
        time_period: '7d',
        trend: 'increasing' as const,
      },
    ],
    novaIQWeightPercent: 21,
    casinoDataWeightPercent: 79,
    explanationSummary: 'Multiple high-risk behavioral patterns detected in the last 24 hours, supported by Nova IQ impulsivity assessment. Immediate intervention recommended.',
    triggers24h: [
      { type: 'loss_chasing', count: 3 },
      { type: 'session_escalation', ratio: 2.4 },
    ],
    triggers7d: [
      { type: 'spend_volatility', coefficient: 68 },
    ],
    triggers30d: [],
    timestamp: new Date().toISOString(),
  };

  const sampleRecommendation = {
    recommendationId: 'rec-001',
    playerId: 'P-8472',
    interventionType: 'cooling_off' as const,
    recommendedTiming: 'immediate' as const,
    successProbability: 79,
    rationale: 'Loss-chasing and session escalation patterns detected. Nova IQ behavioral profile indicates high impulsivity requiring immediate intervention. Cooling-off period recommended to restore rational decision-making.',
    alternativeOptions: [
      {
        type: 'soft_message',
        probability: 68,
        rationale: 'Send supportive message with self-assessment tools as alternative',
      },
      {
        type: 'limit',
        probability: 72,
        rationale: 'Set deposit and bet limits as alternative',
      },
    ],
  };

  const sampleOutcome = {
    id: 'outcome-001',
    playerId: 'P-7234',
    interventionType: 'cooling_off',
    appliedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    novaIQInfluenced: true,
    preRiskScore: 78,
    preImpulsivityScore: 72,
    postRiskScore7d: 65,
    postRiskScore14d: 58,
    postRiskScore30d: 52,
    outcome: 'risk_reduced' as const,
    effectivenessScore: 84,
    timeToImpactDays: 5,
    playerResponse: 'Positive - player acknowledged support',
    playerEngagementLevel: 'high',
  };

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />

      <div className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-brand-500 rounded-2xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Nova IQ XAI Intelligence System</h1>
                <p className="text-lg text-gray-600 mt-1">
                  Explainable AI combining live casino data with behavioral assessments
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge className="bg-purple-100 text-purple-700 border-0">
                <Sparkles className="h-3 w-3 mr-1" />
                Explainable AI
              </Badge>
              <Badge className="bg-green-100 text-green-700 border-0">
                <TrendingUp className="h-3 w-3 mr-1" />
                86.9% Accuracy
              </Badge>
              <Badge className="bg-blue-100 text-blue-700 border-0">
                +19.4% Improvement
              </Badge>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="relative">
              <div className="absolute top-3 right-3 z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Full transparency into AI decision-making. Every risk assessment displays the top contributing factors, their percentage weights, and data sources (Nova IQ behavioral scores vs. casino gambling data).</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">AI Reason Stacks</CardTitle>
                <CardDescription>Explainable decision factors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-brand-600 mb-2">100%</div>
                <p className="text-sm text-gray-600">
                  Every AI decision shows top contributing factors with weights and sources
                </p>
              </CardContent>
            </Card>

            <Card className="relative">
              <div className="absolute top-3 right-3 z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Percentage of AI-guided interventions that successfully led to positive behavioral changes, such as reduced risk scores, lower spending, or player engagement with support resources.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">Intervention Success</CardTitle>
                <CardDescription>Outcome tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 mb-2">83.4%</div>
                <p className="text-sm text-gray-600">
                  Success rate for AI-guided interventions across all operators
                </p>
              </CardContent>
            </Card>

            <Card className="relative">
              <div className="absolute top-3 right-3 z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Improvement in prediction accuracy when Nova IQ behavioral assessment data (impulsivity, patience, risk tolerance) is combined with live casino gambling patterns.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">Nova IQ Impact</CardTitle>
                <CardDescription>Accuracy lift</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600 mb-2">+12.5%</div>
                <p className="text-sm text-gray-600">
                  Additional accuracy gained when Nova IQ behavioral data is included
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="reason-stack" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="reason-stack">Reason Stack</TabsTrigger>
              <TabsTrigger value="recommendation">AI Recommendation</TabsTrigger>
              <TabsTrigger value="outcome">Outcome Tracking</TabsTrigger>
              <TabsTrigger value="learning">Learning Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="reason-stack" className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Explainable AI Reason Stack</h2>
                <p className="text-gray-600">
                  See exactly why the AI flagged this player, with contributing factors from live casino data and Nova IQ behavioral assessments.
                </p>
              </div>
              <ReasonStackDisplay {...sampleReasonStack} />

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li>• Analyzes live gambling behavior (loss-chasing, session escalation, spend patterns)</li>
                    <li>• Integrates Nova IQ behavioral assessments (impulsivity, patience, risk escalation)</li>
                    <li>• Weights all factors and displays top 3-5 contributors with percentages</li>
                    <li>• Shows recent triggers across 24h, 7d, and 30d time windows</li>
                    <li>• Provides AI confidence score for full transparency</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendation" className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">AI-Guided Intervention Recommendation</h2>
                <p className="text-gray-600">
                  AI suggests the intervention type, timing, and provides success probability. Staff can accept, override, or defer with full decision logging.
                </p>
              </div>
              <AIInterventionRecommendation {...sampleRecommendation} readOnly />

              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-purple-900 mb-2">Decision Support Features</h3>
                  <ul className="space-y-2 text-sm text-purple-700">
                    <li>• AI recommends intervention type (soft message, cooling-off, limits, escalation, monitor)</li>
                    <li>• Provides timing guidance (immediate, delayed, scheduled)</li>
                    <li>• Estimates success probability based on behavioral profile</li>
                    <li>• Shows alternative options with probability scores</li>
                    <li>• Staff can accept, override, or defer with rationale logging</li>
                    <li>• All decisions tracked for compliance and audit</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="outcome" className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Intervention Outcome Tracking</h2>
                <p className="text-gray-600">
                  Track post-intervention results to measure effectiveness and feed learning back into the AI system.
                </p>
              </div>
              <InterventionOutcomeTracker {...sampleOutcome} />

              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-green-900 mb-2">Outcome Learning Loop</h3>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li>• Tracks pre-intervention risk scores and behavioral metrics</li>
                    <li>• Measures post-intervention scores at 7d, 14d, and 30d intervals</li>
                    <li>• Calculates effectiveness scores (0-100) and time-to-impact</li>
                    <li>• Records player responses and engagement levels</li>
                    <li>• Identifies which interventions work best for which behavioral profiles</li>
                    <li>• Feeds results back into AI to improve future recommendations</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="learning" className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Learning Performance Metrics</h2>
                <p className="text-gray-600">
                  System-wide AI accuracy improvements, Nova IQ impact, and intervention success rates.
                </p>
              </div>

              {!loading && learningMetrics.length > 0 ? (
                <div className="space-y-6">
                  {learningMetrics.map((metric) => (
                    <AILearningMetrics
                      key={metric.id}
                      casinoName={metric.casino_id ? 'Casino Performance' : 'Global System Performance'}
                      periodStart={metric.period_start}
                      periodEnd={metric.period_end}
                      totalPredictions={metric.total_predictions}
                      correctPredictions={metric.correct_predictions}
                      accuracyPercent={metric.accuracy_percent}
                      accuracyChangePercent={metric.accuracy_change_percent}
                      baselineAccuracyPercent={metric.baseline_accuracy_percent}
                      novaIQEnhancedPredictions={metric.nova_iq_enhanced_predictions}
                      novaIQAccuracyLiftPercent={metric.nova_iq_accuracy_lift_percent}
                      totalInterventions={metric.total_interventions}
                      successfulInterventions={metric.successful_interventions}
                      successRatePercent={metric.success_rate_percent}
                      confidenceScoreAvg={metric.confidence_score_avg}
                      falsePositiveRate={metric.false_positive_rate}
                      falseNegativeRate={metric.false_negative_rate}
                      learningGeneration={1}
                      showGlobal={!metric.casino_id}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-500 text-center">Loading learning metrics...</p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-brand-50 border-brand-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-brand-900 mb-2">Continuous Improvement</h3>
                  <ul className="space-y-2 text-sm text-brand-700">
                    <li>• AI models continuously learn from real intervention outcomes</li>
                    <li>• Accuracy improves over time (current: +19.4% over 90 days)</li>
                    <li>• Nova IQ behavioral data contributes additional +12.5% accuracy lift</li>
                    <li>• Learning occurs without exposing personal data between operators</li>
                    <li>• Performance metrics are auditable and regulator-approved</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* System Architecture */}
          <Card className="mt-8 border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                System Architecture
              </CardTitle>
              <CardDescription>How Nova IQ XAI works with SafeBet IQ intervention engine</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-bold text-purple-900 mb-2">1. Data Collection</div>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Live casino betting data</li>
                    <li>• Session patterns</li>
                    <li>• Nova IQ assessments</li>
                    <li>• Behavioral metrics</li>
                  </ul>
                </div>
                <div className="p-4 bg-brand-50 rounded-lg border border-brand-200">
                  <div className="font-bold text-brand-900 mb-2">2. AI Analysis</div>
                  <ul className="text-sm text-brand-700 space-y-1">
                    <li>• Generate reason stacks</li>
                    <li>• Calculate risk levels</li>
                    <li>• Provide recommendations</li>
                    <li>• Estimate success probability</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-bold text-green-900 mb-2">3. Outcome Learning</div>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Track interventions</li>
                    <li>• Measure effectiveness</li>
                    <li>• Improve AI accuracy</li>
                    <li>• Personalize guidance</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
