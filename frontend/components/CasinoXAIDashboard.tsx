'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ReasonStackDisplay } from '@/components/ReasonStackDisplay';
import { AIInterventionRecommendation } from '@/components/AIInterventionRecommendation';
import { InterventionOutcomeTracker } from '@/components/InterventionOutcomeTracker';

interface CasinoXAIDashboardProps {
  casinoId: string;
}

export function CasinoXAIDashboard({ casinoId }: CasinoXAIDashboardProps) {
  const [reasonStacks, setReasonStacks] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalHighRisk: 0,
    pendingRecommendations: 0,
    successRate: 0,
    avgConfidence: 0,
  });

  useEffect(() => {
    console.log('[XAI Dashboard] Component mounted with casinoId:', casinoId);
    if (casinoId) {
      loadXAIData();
    } else {
      console.error('[XAI Dashboard] No casinoId provided!');
      setError('No casino ID available');
      setLoading(false);
    }
  }, [casinoId]);

  async function loadXAIData() {
    try {
      setLoading(true);
      console.log('[XAI Dashboard] Loading data for casino:', casinoId);

      // Load reason stacks (medium, high and critical risk)
      const { data: stacksData, error: stacksError } = await supabase
        .from('ai_reason_stacks')
        .select(`
          *,
          players:player_id (
            id,
            player_id,
            first_name,
            last_name,
            risk_score
          )
        `)
        .eq('casino_id', casinoId)
        .in('risk_level', ['medium', 'high', 'critical', 'moderate'])
        .order('created_at', { ascending: false })
        .limit(30);

      if (stacksError) {
        console.error('[XAI Dashboard] Error loading reason stacks:', stacksError);
        throw stacksError;
      }

      console.log('[XAI Dashboard] Loaded', stacksData?.length || 0, 'reason stacks');
      if (stacksData && stacksData.length > 0) {
        console.log('[XAI Dashboard] Sample reason stack:', stacksData[0]);
      }

      // Load pending recommendations
      const { data: recsData, error: recsError } = await supabase
        .from('ai_intervention_recommendations')
        .select(`
          *,
          ai_reason_stacks:reason_stack_id (
            risk_level,
            ai_confidence_score
          ),
          players:player_id (
            id,
            player_id,
            first_name,
            last_name
          )
        `)
        .eq('casino_id', casinoId)
        .in('staff_decision', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (recsError) {
        console.error('[XAI Dashboard] Error loading recommendations:', recsError);
        throw recsError;
      }

      console.log('[XAI Dashboard] Loaded', recsData?.length || 0, 'recommendations');

      // Load recent outcomes
      const { data: outcomesData, error: outcomesError } = await supabase
        .from('ai_intervention_outcomes')
        .select(`
          *,
          players:player_id (
            id,
            player_id,
            first_name,
            last_name
          )
        `)
        .eq('casino_id', casinoId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (outcomesError) {
        console.error('[XAI Dashboard] Error loading outcomes:', outcomesError);
        throw outcomesError;
      }

      console.log('[XAI Dashboard] Loaded', outcomesData?.length || 0, 'outcomes');

      setReasonStacks(stacksData || []);
      setRecommendations(recsData || []);
      setOutcomes(outcomesData || []);

      // Calculate stats
      const highRiskCount = stacksData?.filter(s => s.risk_level === 'high' || s.risk_level === 'critical' || s.risk_level === 'moderate').length || 0;
      const pendingCount = recsData?.filter(r => r.staff_decision === 'pending').length || 0;
      const successfulOutcomes = outcomesData?.filter(o => o.outcome === 'risk_reduced').length || 0;
      const totalOutcomes = outcomesData?.length || 0;
      const avgConf = stacksData?.reduce((acc, s) => acc + (parseFloat(s.ai_confidence_score) || 0), 0) / (stacksData?.length || 1);

      const calculatedStats = {
        totalHighRisk: highRiskCount,
        pendingRecommendations: pendingCount,
        successRate: totalOutcomes > 0 ? Math.round((successfulOutcomes / totalOutcomes) * 100) : 0,
        avgConfidence: Math.round(avgConf),
      };

      console.log('[XAI Dashboard] Calculated stats:', calculatedStats);
      setStats(calculatedStats);
      setError(null);
    } catch (error) {
      console.error('[XAI Dashboard] Error loading XAI data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load AI Intelligence data');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(recommendationId: string, decision: 'accepted' | 'overridden' | 'deferred', rationale?: string) {
    try {
      const { error } = await supabase
        .from('ai_intervention_recommendations')
        .update({
          staff_decision: decision,
          decision_rationale: rationale,
          decided_at: new Date().toISOString(),
        })
        .eq('id', recommendationId);

      if (error) throw error;

      // Reload data
      await loadXAIData();
    } catch (error) {
      console.error('Error updating recommendation:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Brain className="h-12 w-12 text-brand-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading AI Intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading AI Intelligence</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => loadXAIData()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Risk Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.totalHighRisk}</div>
            <p className="text-xs text-gray-500 mt-1">Players requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.pendingRecommendations}</div>
            <p className="text-xs text-gray-500 mt-1">AI recommendations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.successRate}%</div>
            <p className="text-xs text-gray-500 mt-1">Risk reduced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">AI Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brand-600">{stats.avgConfidence}%</div>
            <p className="text-xs text-gray-500 mt-1">Average score</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="reason-stacks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reason-stacks">
            <Brain className="h-4 w-4 mr-2" />
            AI Reason Stacks ({stats.totalHighRisk})
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Recommendations ({stats.pendingRecommendations})
          </TabsTrigger>
          <TabsTrigger value="outcomes">
            <TrendingUp className="h-4 w-4 mr-2" />
            Outcomes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reason-stacks" className="space-y-4">
          {reasonStacks.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No high-risk players detected</p>
              </CardContent>
            </Card>
          ) : (
            reasonStacks.map((stack) => (
              <ReasonStackDisplay
                key={stack.id}
                playerId={
                  stack.players?.first_name && stack.players?.last_name
                    ? `${stack.players.first_name} ${stack.players.last_name}`
                    : stack.players?.player_id || stack.player_id
                }
                riskLevel={stack.risk_level as 'low' | 'medium' | 'high' | 'critical'}
                confidenceScore={parseFloat(stack.ai_confidence_score)}
                contributingFactors={stack.contributing_factors}
                novaIQWeightPercent={parseFloat(stack.nova_iq_weight_percent)}
                casinoDataWeightPercent={parseFloat(stack.casino_data_weight_percent)}
                explanationSummary={stack.explanation_summary}
                triggers24h={stack.triggers_24h}
                triggers7d={stack.triggers_7d}
                triggers30d={stack.triggers_30d}
                timestamp={stack.created_at}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No pending recommendations</p>
              </CardContent>
            </Card>
          ) : (
            recommendations.map((rec) => (
              <AIInterventionRecommendation
                key={rec.id}
                recommendationId={rec.id}
                playerId={
                  rec.players?.first_name && rec.players?.last_name
                    ? `${rec.players.first_name} ${rec.players.last_name}`
                    : rec.players?.player_id || rec.player_id
                }
                interventionType={rec.recommended_intervention_type as any}
                recommendedTiming={rec.recommended_timing as any}
                successProbability={parseFloat(rec.success_probability)}
                rationale={rec.rationale}
                alternativeOptions={rec.alternative_options}
                staffDecision={rec.staff_decision as any}
                decisionRationale={rec.decision_rationale}
                onDecisionMade={(decision, rationale) => handleDecision(rec.id, decision as any, rationale)}
                readOnly={rec.staff_decision === 'accepted'}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="outcomes" className="space-y-4">
          {outcomes.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No intervention outcomes yet</p>
              </CardContent>
            </Card>
          ) : (
            outcomes.map((outcome) => (
              <InterventionOutcomeTracker
                key={outcome.id}
                id={outcome.id}
                playerId={
                  outcome.players?.first_name && outcome.players?.last_name
                    ? `${outcome.players.first_name} ${outcome.players.last_name}`
                    : outcome.players?.player_id || outcome.player_id
                }
                interventionType={outcome.intervention_type}
                appliedAt={outcome.applied_at}
                novaIQInfluenced={outcome.nova_iq_influenced}
                preRiskScore={outcome.pre_risk_score}
                preImpulsivityScore={outcome.pre_impulsivity_score}
                postRiskScore7d={outcome.post_risk_score_7d}
                postRiskScore14d={outcome.post_risk_score_14d}
                postRiskScore30d={outcome.post_risk_score_30d}
                outcome={outcome.outcome as any}
                effectivenessScore={outcome.effectiveness_score}
                timeToImpactDays={outcome.time_to_impact_days}
                playerResponse={outcome.player_response}
                playerEngagementLevel={outcome.player_engagement_level as any}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
