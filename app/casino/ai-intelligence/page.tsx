'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ReasonStackDisplay } from '@/components/ReasonStackDisplay';
import { AIInterventionRecommendation } from '@/components/AIInterventionRecommendation';
import { InterventionOutcomeTracker } from '@/components/InterventionOutcomeTracker';
import { AILearningMetrics } from '@/components/AILearningMetrics';
import { Brain, Sparkles, TrendingUp, Download, FileText, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AIIntelligencePage() {
  const { user } = useAuth();
  const [learningMetrics, setLearningMetrics] = useState<any[]>([]);
  const [reasonStacks, setReasonStacks] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reason-stack');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.casino_id) {
        setLoading(false);
        return;
      }

      const [metricsRes, reasonStacksRes, recommendationsRes, outcomesRes] = await Promise.all([
        supabase
          .from('ai_learning_metrics')
          .select('*')
          .eq('casino_id', user.casino_id)
          .order('period_start', { ascending: false }),
        supabase
          .from('ai_reason_stacks')
          .select(`
            *,
            players (
              id,
              first_name,
              last_name,
              player_id
            )
          `)
          .eq('casino_id', user.casino_id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('ai_intervention_recommendations')
          .select(`
            *,
            players (
              id,
              first_name,
              last_name,
              player_id
            )
          `)
          .eq('casino_id', user.casino_id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('ai_intervention_outcomes')
          .select(`
            *,
            players (
              id,
              first_name,
              last_name,
              player_id
            )
          `)
          .eq('casino_id', user.casino_id)
          .order('applied_at', { ascending: false })
          .limit(5)
      ]);

      if (metricsRes.error) throw metricsRes.error;
      if (reasonStacksRes.error) throw reasonStacksRes.error;
      if (recommendationsRes.error) throw recommendationsRes.error;
      if (outcomesRes.error) throw outcomesRes.error;

      setLearningMetrics(metricsRes.data || []);
      setReasonStacks(reasonStacksRes.data || []);
      setRecommendations(recommendationsRes.data || []);
      setOutcomes(outcomesRes.data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [user?.casino_id]);

  useEffect(() => {
    if (user?.casino_id) {
      loadData();
    }
  }, [user?.casino_id, loadData]);

  const getPlayerName = (player: any) => {
    if (!player) return 'Unknown Player';
    return `${player.first_name} ${player.last_name}`;
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
      <div className="flex h-full flex-col">
        <PageHeader
          title="AI Intelligence System"
          subtitle="Explainable AI combining live casino data with Nova IQ behavioral assessments"
          actions={
            <>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
            </>
          }
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Full transparency into AI decision-making. Every risk assessment displays the top contributing factors, their percentage weights, and data sources (Nova IQ behavioral scores vs. casino gambling data).</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    AI Reason Stacks
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">100%</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Every AI decision shows top contributing factors with weights and sources
                  </p>
                </CardContent>
              </Card>

              <Card className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Percentage of AI-guided interventions that successfully led to positive behavioral changes, such as reduced risk scores, lower spending, or player engagement with support resources.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Intervention Success
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">83.4%</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Success rate for AI-guided interventions across all operators
                  </p>
                </CardContent>
              </Card>

              <Card className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Improvement in prediction accuracy when Nova IQ behavioral assessment data (impulsivity, patience, risk tolerance) is combined with live casino gambling patterns.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    Nova IQ Impact
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">+12.5%</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Additional accuracy gained when Nova IQ behavioral data is included
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                <Sparkles className="h-3 w-3 mr-1" />
                Explainable AI
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                <TrendingUp className="h-3 w-3 mr-1" />
                86.9% Accuracy
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                +19.4% Improvement
              </Badge>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="reason-stack">Reason Stack</TabsTrigger>
                <TabsTrigger value="recommendation">AI Recommendation</TabsTrigger>
                <TabsTrigger value="outcome">Outcome Tracking</TabsTrigger>
                <TabsTrigger value="learning">Learning Metrics</TabsTrigger>
              </TabsList>

              <TabsContent value="reason-stack" className="space-y-6">
                <Card className="relative">
                  <div className="absolute top-4 right-4 z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Complete breakdown of how the AI reached its risk assessment. Shows the top contributing factors with percentage weights, data sources (Nova IQ vs casino data), trigger patterns over time, and AI confidence scores.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <CardHeader>
                    <CardTitle>Explainable AI Reason Stack</CardTitle>
                    <CardDescription>
                      See exactly why the AI flagged this player, with contributing factors from live casino data and Nova IQ behavioral assessments.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!loading && reasonStacks.length > 0 ? (
                      <div className="space-y-6">
                        {reasonStacks.map((stack) => (
                          <ReasonStackDisplay
                            key={stack.id}
                            playerId={getPlayerName(stack.players)}
                            riskLevel={stack.risk_level}
                            confidenceScore={parseInt(stack.ai_confidence_score) || 0}
                            contributingFactors={stack.contributing_factors || []}
                            novaIQWeightPercent={parseFloat(stack.nova_iq_weight_percent) || 0}
                            casinoDataWeightPercent={parseFloat(stack.casino_data_weight_percent) || 0}
                            explanationSummary={stack.explanation_summary}
                            triggers24h={stack.triggers_24h || []}
                            triggers7d={stack.triggers_7d || []}
                            triggers30d={stack.triggers_30d || []}
                            timestamp={stack.created_at}
                          />
                        ))}
                      </div>
                    ) : loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading reason stacks...</p>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No reason stacks available</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-blue-900 mb-3">How It Works</h3>
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
                <Card className="relative">
                  <div className="absolute top-4 right-4 z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>AI recommends the best intervention approach (soft message, cooling-off, limits, escalation), optimal timing, and predicts success probability. Staff can accept, override, or defer decisions with full audit trail for compliance.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <CardHeader>
                    <CardTitle>AI-Guided Intervention Recommendation</CardTitle>
                    <CardDescription>
                      AI suggests the intervention type, timing, and provides success probability. Staff can accept, override, or defer with full decision logging.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!loading && recommendations.length > 0 ? (
                      <div className="space-y-6">
                        {recommendations.map((rec) => (
                          <AIInterventionRecommendation
                            key={rec.id}
                            recommendationId={rec.id}
                            playerId={getPlayerName(rec.players)}
                            interventionType={rec.recommended_intervention_type}
                            recommendedTiming={rec.recommended_timing}
                            successProbability={parseFloat(rec.success_probability) || 0}
                            rationale={rec.rationale}
                            alternativeOptions={rec.alternative_options || []}
                            readOnly
                          />
                        ))}
                      </div>
                    ) : loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading recommendations...</p>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No recommendations available</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-purple-900 mb-3">Decision Support Features</h3>
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
                <Card className="relative">
                  <div className="absolute top-4 right-4 z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Monitors player behavior after interventions to measure effectiveness. Tracks changes in risk scores, gambling patterns, and player engagement. Results feed back into the AI to improve future recommendations.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <CardHeader>
                    <CardTitle>Intervention Outcome Tracking</CardTitle>
                    <CardDescription>
                      Track post-intervention results to measure effectiveness and feed learning back into the AI system.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!loading && outcomes.length > 0 ? (
                      <div className="space-y-6">
                        {outcomes.map((outcome) => (
                          <InterventionOutcomeTracker
                            key={outcome.id}
                            id={outcome.id}
                            playerId={getPlayerName(outcome.players)}
                            interventionType={outcome.intervention_type}
                            appliedAt={outcome.applied_at}
                            novaIQInfluenced={outcome.nova_iq_influenced}
                            preRiskScore={outcome.pre_risk_score}
                            preImpulsivityScore={outcome.pre_impulsivity_score}
                            postRiskScore7d={outcome.post_risk_score_7d}
                            postRiskScore14d={outcome.post_risk_score_14d}
                            postRiskScore30d={outcome.post_risk_score_30d}
                            outcome={outcome.outcome}
                            effectivenessScore={outcome.effectiveness_score}
                            timeToImpactDays={outcome.time_to_impact_days}
                            playerResponse={outcome.player_response}
                            playerEngagementLevel={outcome.player_engagement_level}
                          />
                        ))}
                      </div>
                    ) : loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading outcomes...</p>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No outcomes available</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-green-900 mb-3">Outcome Learning Loop</h3>
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
                <Card className="relative">
                  <div className="absolute top-4 right-4 z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Tracks how the AI system improves over time. Monitors prediction accuracy, Nova IQ contribution to performance, intervention success rates, and system-wide learning trends across all operators.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <CardHeader>
                    <CardTitle>AI Learning Performance Metrics</CardTitle>
                    <CardDescription>
                      System-wide AI accuracy improvements, Nova IQ impact, and intervention success rates.
                    </CardDescription>
                  </CardHeader>
                </Card>

                {!loading && learningMetrics.length > 0 ? (
                  <div className="space-y-6">
                    {learningMetrics.map((metric, index) => (
                      <AILearningMetrics
                        key={metric.id}
                        casinoName={metric.casino_id ? 'Casino Performance' : 'Global System Performance'}
                        periodStart={metric.period_start}
                        periodEnd={metric.period_end}
                        totalPredictions={parseInt(metric.total_predictions) || 0}
                        correctPredictions={parseInt(metric.correct_predictions) || 0}
                        accuracyPercent={parseFloat(metric.accuracy_percent) || 0}
                        accuracyChangePercent={parseFloat(metric.accuracy_change_percent) || 0}
                        baselineAccuracyPercent={parseFloat(metric.baseline_accuracy_percent) || 0}
                        novaIQEnhancedPredictions={parseInt(metric.nova_iq_enhanced_predictions) || 0}
                        novaIQAccuracyLiftPercent={parseFloat(metric.nova_iq_accuracy_lift_percent) || 0}
                        totalInterventions={parseInt(metric.total_interventions) || 0}
                        successfulInterventions={parseInt(metric.successful_interventions) || 0}
                        successRatePercent={parseFloat(metric.success_rate_percent) || 0}
                        confidenceScoreAvg={parseFloat(metric.confidence_score_avg) || 0}
                        falsePositiveRate={parseFloat(metric.false_positive_rate) || 0}
                        falseNegativeRate={parseFloat(metric.false_negative_rate) || 0}
                        learningGeneration={index + 1}
                        showGlobal={!metric.casino_id}
                      />
                    ))}
                  </div>
                ) : loading ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-center">Loading learning metrics...</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-center">No learning metrics available</p>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-purple-900 mb-3">Continuous Improvement</h3>
                    <ul className="space-y-2 text-sm text-purple-700">
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
            <Card className="border-2 border-purple-200">
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
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="font-bold text-blue-900 mb-2">2. AI Analysis</div>
                    <ul className="text-sm text-blue-700 space-y-1">
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
    </DashboardLayout>
  );
}
