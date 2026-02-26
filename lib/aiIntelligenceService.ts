/**
 * AI Intelligence Service
 *
 * Generates explainable AI reason stacks by combining:
 * - Live gambling behavior data
 * - Nova IQ behavioral assessment outputs
 *
 * Produces AI-guided intervention recommendations with success probabilities
 */

import { supabase } from './supabase';

interface ContributingFactor {
  factor: string;
  weight_percent: number;
  source: 'live_casino' | 'nova_iq' | 'combined';
  time_period?: string;
  trend?: 'increasing' | 'stable' | 'decreasing';
}

interface ReasonStackResult {
  player_id: string;
  casino_id: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  ai_confidence_score: number;
  contributing_factors: ContributingFactor[];
  triggers_24h: any[];
  triggers_7d: any[];
  triggers_30d: any[];
  nova_iq_session_id?: string;
  nova_iq_weight_percent: number;
  casino_data_weight_percent: number;
}

interface InterventionRecommendation {
  reason_stack_id: string;
  casino_id: string;
  player_id: string;
  recommended_intervention_type: 'soft_message' | 'cooling_off' | 'limit' | 'escalation' | 'monitor';
  recommended_timing: 'immediate' | 'delayed' | 'scheduled' | 'monitor';
  success_probability: number;
  rationale: string;
  alternative_options: any[];
}

/**
 * Generate AI Reason Stack by combining live casino data with Nova IQ assessment
 */
export async function generateReasonStack(
  casinoId: string,
  playerId: string,
  novaIQSessionId?: string
): Promise<ReasonStackResult | null> {
  try {
    const contributingFactors: ContributingFactor[] = [];
    const triggers24h: any[] = [];
    const triggers7d: any[] = [];
    const triggers30d: any[] = [];

    // Fetch live casino data (betting history, sessions, risk patterns)
    const now = new Date();
    const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get player's recent betting activity
    const { data: recentBets, error: betsError } = await supabase
      .from('player_betting_history')
      .select('*')
      .eq('player_id', playerId)
      .eq('casino_id', casinoId)
      .gte('created_at', days30Ago.toISOString())
      .order('created_at', { ascending: false });

    if (!betsError && recentBets) {
      // Analyze betting patterns
      const last24h = recentBets.filter(b => new Date(b.created_at) >= day24Ago);
      const last7d = recentBets.filter(b => new Date(b.created_at) >= days7Ago);

      // Calculate loss chasing behavior
      let lossChasing = 0;
      for (let i = 1; i < last24h.length; i++) {
        if (last24h[i - 1].result === 'loss' && last24h[i].bet_amount > last24h[i - 1].bet_amount * 1.5) {
          lossChasing++;
        }
      }

      if (lossChasing > 0) {
        const weight = Math.min(lossChasing * 8, 40);
        contributingFactors.push({
          factor: 'Loss-chasing behavior detected',
          weight_percent: weight,
          source: 'live_casino',
          time_period: '24h',
          trend: 'increasing',
        });
        triggers24h.push({ type: 'loss_chasing', count: lossChasing });
      }

      // Session escalation analysis
      const totalStake24h = last24h.reduce((sum, b) => sum + Number(b.bet_amount), 0);
      const avgStake7d = last7d.length > 0 ? last7d.reduce((sum, b) => sum + Number(b.bet_amount), 0) / last7d.length : 0;

      if (totalStake24h > avgStake7d * 2) {
        contributingFactors.push({
          factor: 'Session escalation above baseline',
          weight_percent: 27,
          source: 'live_casino',
          time_period: '24h vs 7d',
          trend: 'increasing',
        });
        triggers24h.push({ type: 'session_escalation', ratio: (totalStake24h / avgStake7d).toFixed(2) });
      }

      // Spend volatility
      const stakes = last7d.map(b => Number(b.bet_amount));
      if (stakes.length > 5) {
        const avg = stakes.reduce((a, b) => a + b, 0) / stakes.length;
        const variance = stakes.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / stakes.length;
        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / avg) * 100;

        if (cv > 50) {
          contributingFactors.push({
            factor: 'High spend volatility',
            weight_percent: 14,
            source: 'live_casino',
            time_period: '7d',
            trend: 'increasing',
          });
          triggers7d.push({ type: 'spend_volatility', coefficient: cv.toFixed(1) });
        }
      }
    }

    // Get Nova IQ assessment data if available
    let novaIQWeight = 0;
    if (novaIQSessionId) {
      const { data: novaSession, error: novaError } = await supabase
        .from('wellbeing_game_sessions')
        .select(`
          *,
          wellbeing_risk_scores (
            behaviour_risk_index,
            impulsivity_score,
            patience_score,
            risk_escalation_score
          )
        `)
        .eq('id', novaIQSessionId)
        .eq('status', 'completed')
        .single();

      if (!novaError && novaSession && novaSession.wellbeing_risk_scores) {
        const scores = novaSession.wellbeing_risk_scores[0];

        // High impulsivity index from Nova IQ
        if (scores.impulsivity_score > 70) {
          const weight = Math.round((scores.impulsivity_score / 100) * 25);
          contributingFactors.push({
            factor: 'High impulsivity index',
            weight_percent: weight,
            source: 'nova_iq',
            time_period: 'assessment',
            trend: 'stable',
          });
          novaIQWeight += weight;
        }

        // Low patience score
        if (scores.patience_score < 40) {
          const weight = Math.round(((100 - scores.patience_score) / 100) * 18);
          contributingFactors.push({
            factor: 'Low patience under pressure',
            weight_percent: weight,
            source: 'nova_iq',
            time_period: 'assessment',
            trend: 'stable',
          });
          novaIQWeight += weight;
        }

        // Risk escalation tendency
        if (scores.risk_escalation_score > 65) {
          contributingFactors.push({
            factor: 'Risk escalation tendency',
            weight_percent: 16,
            source: 'nova_iq',
            time_period: 'assessment',
            trend: 'stable',
          });
          novaIQWeight += 16;
        }
      }
    }

    // Calculate total weights and normalize if over 100%
    const totalWeight = contributingFactors.reduce((sum, f) => sum + f.weight_percent, 0);
    if (totalWeight > 100) {
      contributingFactors.forEach(f => {
        f.weight_percent = Math.round((f.weight_percent / totalWeight) * 100);
      });
    }

    // Recalculate Nova IQ weight
    novaIQWeight = contributingFactors
      .filter(f => f.source === 'nova_iq')
      .reduce((sum, f) => sum + f.weight_percent, 0);

    const casinoDataWeight = contributingFactors
      .filter(f => f.source === 'live_casino')
      .reduce((sum, f) => sum + f.weight_percent, 0);

    // Determine risk level based on contributing factors
    const topFactorWeight = Math.max(...contributingFactors.map(f => f.weight_percent));
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let confidenceScore = 75;

    if (topFactorWeight >= 35 || contributingFactors.length >= 4) {
      riskLevel = 'critical';
      confidenceScore = 92;
    } else if (topFactorWeight >= 25 || contributingFactors.length >= 3) {
      riskLevel = 'high';
      confidenceScore = 85;
    } else if (topFactorWeight >= 15 || contributingFactors.length >= 2) {
      riskLevel = 'medium';
      confidenceScore = 78;
    }

    // Boost confidence if Nova IQ data is available
    if (novaIQWeight > 0) {
      confidenceScore = Math.min(confidenceScore + 8, 98);
    }

    return {
      player_id: playerId,
      casino_id: casinoId,
      risk_level: riskLevel,
      ai_confidence_score: confidenceScore,
      contributing_factors: contributingFactors,
      triggers_24h: triggers24h,
      triggers_7d: triggers7d,
      triggers_30d: triggers30d,
      nova_iq_session_id: novaIQSessionId,
      nova_iq_weight_percent: novaIQWeight,
      casino_data_weight_percent: casinoDataWeight,
    };
  } catch (error) {
    console.error('[AI Intelligence] Error generating reason stack:', error);
    return null;
  }
}

/**
 * Generate AI-guided intervention recommendation based on reason stack
 */
export async function generateInterventionRecommendation(
  reasonStack: ReasonStackResult
): Promise<InterventionRecommendation> {
  const { risk_level, contributing_factors, nova_iq_weight_percent, ai_confidence_score } = reasonStack;

  let recommendedType: 'soft_message' | 'cooling_off' | 'limit' | 'escalation' | 'monitor' = 'monitor';
  let timing: 'immediate' | 'delayed' | 'scheduled' | 'monitor' = 'monitor';
  let successProbability = 50;
  let rationale = '';
  const alternatives: any[] = [];

  // Critical risk - escalate immediately
  if (risk_level === 'critical') {
    recommendedType = 'escalation';
    timing = 'immediate';
    successProbability = 78;
    rationale = 'Multiple high-risk indicators detected. Immediate senior staff intervention recommended.';

    if (nova_iq_weight_percent > 20) {
      rationale += ' Nova IQ behavioral profile indicates high impulsivity requiring direct engagement.';
      successProbability += 5;
    }

    alternatives.push({
      type: 'cooling_off',
      probability: 65,
      rationale: 'Mandatory 24-hour cooling-off period as alternative',
    });
  }
  // High risk - cooling off or limits
  else if (risk_level === 'high') {
    recommendedType = 'cooling_off';
    timing = 'immediate';
    successProbability = 72;
    rationale = 'Loss-chasing and session escalation patterns detected. Cooling-off period recommended.';

    if (nova_iq_weight_percent > 15) {
      rationale += ' Behavioral assessment supports temporary break to restore rational decision-making.';
      successProbability += 7;
    }

    alternatives.push({
      type: 'limit',
      probability: 68,
      rationale: 'Set deposit and bet limits as alternative',
    });
    alternatives.push({
      type: 'soft_message',
      probability: 55,
      rationale: 'Send supportive message with self-assessment tools',
    });
  }
  // Medium risk - soft intervention
  else if (risk_level === 'medium') {
    recommendedType = 'soft_message';
    timing = 'delayed';
    successProbability = 68;
    rationale = 'Emerging risk patterns detected. Soft intervention with self-reflection prompts recommended.';

    if (nova_iq_weight_percent > 10) {
      rationale += ' Player shows moderate impulsivity - educational content on decision patterns advised.';
      successProbability += 4;
    }

    alternatives.push({
      type: 'monitor',
      probability: 60,
      rationale: 'Continue monitoring for 48 hours before action',
    });
  }
  // Low risk - monitor
  else {
    recommendedType = 'monitor';
    timing = 'scheduled';
    successProbability = 85;
    rationale = 'No immediate intervention required. Continue standard monitoring protocols.';
  }

  // Adjust success probability based on AI confidence
  successProbability = Math.min(Math.round(successProbability * (ai_confidence_score / 100)), 98);

  return {
    reason_stack_id: '',  // Will be set after reason stack is saved
    casino_id: reasonStack.casino_id,
    player_id: reasonStack.player_id,
    recommended_intervention_type: recommendedType,
    recommended_timing: timing,
    success_probability: successProbability,
    rationale,
    alternative_options: alternatives,
  };
}

/**
 * Save reason stack and recommendation to database
 */
export async function saveReasonStackAndRecommendation(
  reasonStack: ReasonStackResult,
  recommendation?: InterventionRecommendation
) {
  try {
    // Save reason stack
    const { data: savedStack, error: stackError } = await supabase
      .from('ai_reason_stacks')
      .insert({
        casino_id: reasonStack.casino_id,
        player_id: reasonStack.player_id,
        risk_level: reasonStack.risk_level,
        ai_confidence_score: reasonStack.ai_confidence_score,
        contributing_factors: reasonStack.contributing_factors,
        triggers_24h: reasonStack.triggers_24h,
        triggers_7d: reasonStack.triggers_7d,
        triggers_30d: reasonStack.triggers_30d,
        nova_iq_session_id: reasonStack.nova_iq_session_id,
        nova_iq_weight_percent: reasonStack.nova_iq_weight_percent,
        casino_data_weight_percent: reasonStack.casino_data_weight_percent,
      })
      .select()
      .single();

    if (stackError) throw stackError;

    // Save recommendation if provided
    if (recommendation && savedStack) {
      const { error: recError } = await supabase
        .from('ai_intervention_recommendations')
        .insert({
          reason_stack_id: savedStack.id,
          casino_id: recommendation.casino_id,
          player_id: recommendation.player_id,
          recommended_intervention_type: recommendation.recommended_intervention_type,
          recommended_timing: recommendation.recommended_timing,
          success_probability: recommendation.success_probability,
          rationale: recommendation.rationale,
          alternative_options: recommendation.alternative_options,
        });

      if (recError) throw recError;
    }

    return savedStack;
  } catch (error) {
    console.error('[AI Intelligence] Error saving reason stack:', error);
    throw error;
  }
}
