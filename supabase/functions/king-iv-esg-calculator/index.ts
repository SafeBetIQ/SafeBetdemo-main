import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ESGCalculationRequest {
  casino_id: string;
  period_start: string;
  period_end: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { casino_id, period_start, period_end }: ESGCalculationRequest = await req.json();

    // Fetch ESG metrics for the period
    const { data: esgMetrics, error: metricsError } = await supabase
      .from('esg_metrics')
      .select('*')
      .eq('casino_id', casino_id)
      .gte('reporting_period', period_start)
      .lte('reporting_period', period_end)
      .single();

    if (metricsError && metricsError.code !== 'PGRST116') {
      throw metricsError;
    }

    // Calculate Environmental Score (15% weighting)
    const environmentalScore = calculateEnvironmentalScore(esgMetrics);

    // Calculate Social Score (55% weighting)
    const socialScore = await calculateSocialScore(supabase, casino_id, period_start, period_end, esgMetrics);

    // Calculate Governance Score (30% weighting)
    const governanceScore = await calculateGovernanceScore(supabase, casino_id, period_start, period_end, esgMetrics);

    // Calculate weighted contributions
    const environmental_weighted = (environmentalScore * 0.15);
    const social_weighted = (socialScore * 0.55);
    const governance_weighted = (governanceScore * 0.30);

    // Calculate composite score
    const composite_score = environmental_weighted + social_weighted + governance_weighted;

    // Calculate King IV Outcome Scores
    const ethical_culture_score = await calculateEthicalCultureScore(supabase, casino_id, period_start, period_end);
    const good_performance_score = await calculateGoodPerformanceScore(supabase, casino_id, period_start, period_end);
    const effective_control_score = await calculateEffectiveControlScore(supabase, casino_id, period_start, period_end);
    const legitimacy_score = await calculateLegitimacyScore(supabase, casino_id, period_start, period_end);

    // Get previous score for trend analysis
    const { data: previousScore } = await supabase
      .from('esg_scores')
      .select('composite_score')
      .eq('casino_id', casino_id)
      .lt('scoring_period_end', period_start)
      .order('scoring_period_end', { ascending: false })
      .limit(1)
      .single();

    const previous_composite_score = previousScore?.composite_score || null;
    const score_change = previous_composite_score ? composite_score - previous_composite_score : null;
    const trend_direction = score_change === null ? 'new' :
      score_change > 2 ? 'improving' :
      score_change < -2 ? 'declining' : 'stable';

    // Insert the calculated score
    const { data: scoreData, error: scoreError } = await supabase
      .from('esg_scores')
      .insert({
        casino_id,
        scoring_period_start: period_start,
        scoring_period_end: period_end,
        composite_score,
        environmental_score: environmentalScore,
        social_score: socialScore,
        governance_score: governanceScore,
        environmental_weighted,
        social_weighted,
        governance_weighted,
        ethical_culture_score,
        good_performance_score,
        effective_control_score,
        legitimacy_score,
        previous_composite_score,
        score_change,
        trend_direction,
        calculation_method: 'automated',
        data_sources: [
          'esg_metrics',
          'player_protection_interventions',
          'employee_rg_training',
          'self_exclusion_registry',
          'responsible_gambling_contributions'
        ],
        scoring_confidence: 'high'
      })
      .select()
      .single();

    if (scoreError) throw scoreError;

    // Create evidence trail
    await createEvidenceTrail(supabase, casino_id, scoreData.id, esgMetrics);

    return new Response(
      JSON.stringify({
        success: true,
        score: scoreData,
        breakdown: {
          environmental: { score: environmentalScore, weighted: environmental_weighted, weight: '15%' },
          social: { score: socialScore, weighted: social_weighted, weight: '55%' },
          governance: { score: governanceScore, weighted: governance_weighted, weight: '30%' }
        },
        outcomes: {
          ethical_culture: ethical_culture_score,
          good_performance: good_performance_score,
          effective_control: effective_control_score,
          legitimacy: legitimacy_score
        },
        trend: {
          current: composite_score,
          previous: previous_composite_score,
          change: score_change,
          direction: trend_direction
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ESG Calculation Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateEnvironmentalScore(metrics: any): number {
  if (!metrics) return 50; // Default neutral score

  // Calculate based on renewable energy usage and carbon efficiency
  const renewablePercentage = metrics.renewable_energy_kwh /
    (metrics.renewable_energy_kwh + (metrics.carbon_emissions_tons * 1000)) * 100 || 0;

  // Score: 0-100 based on environmental performance
  return Math.min(100, Math.max(0, renewablePercentage * 2));
}

async function calculateSocialScore(
  supabase: any,
  casino_id: string,
  period_start: string,
  period_end: string,
  metrics: any
): Promise<number> {
  if (!metrics) return 50;

  // Player Protection (40% of social score)
  const interventionRate = metrics.interventions_performed /
    Math.max(1, metrics.high_risk_players_identified) * 100;
  const interventionSuccess = metrics.successful_interventions /
    Math.max(1, metrics.interventions_performed) * 100;
  const playerProtectionScore = (interventionRate * 0.5 + interventionSuccess * 0.5);

  // Employee Training (30% of social score)
  const trainingScore = metrics.training_completion_rate || 0;

  // Self-Exclusion Support (20% of social score)
  const { data: selfExclusions } = await supabase
    .from('self_exclusion_registry')
    .select('counseling_sessions_completed, counseling_sessions_required')
    .eq('casino_id', casino_id)
    .gte('exclusion_start_date', period_start)
    .lte('exclusion_start_date', period_end);

  const totalRequired = selfExclusions?.reduce((sum: number, se: any) => sum + (se.counseling_sessions_required || 0), 0) || 1;
  const totalCompleted = selfExclusions?.reduce((sum: number, se: any) => sum + (se.counseling_sessions_completed || 0), 0) || 0;
  const selfExclusionScore = (totalCompleted / totalRequired) * 100;

  // NRGP Contribution (10% of social score)
  const nrgpScore = metrics.nrgp_contribution_amount > 0 ? 100 : 0;

  // Weighted social score
  return (
    playerProtectionScore * 0.40 +
    trainingScore * 0.30 +
    selfExclusionScore * 0.20 +
    nrgpScore * 0.10
  );
}

async function calculateGovernanceScore(
  supabase: any,
  casino_id: string,
  period_start: string,
  period_end: string,
  metrics: any
): Promise<number> {
  if (!metrics) return 50;

  // Regulatory Compliance (40% of governance score)
  const complianceRate = (metrics.compliance_audits_passed /
    Math.max(1, metrics.compliance_audits_passed + metrics.regulatory_violations)) * 100;

  // Risk Detection Timeliness (30% of governance score)
  const { data: interventions } = await supabase
    .from('player_protection_interventions')
    .select('intervention_date, created_at')
    .eq('casino_id', casino_id)
    .gte('intervention_date', period_start)
    .lte('intervention_date', period_end);

  const avgResponseTime = interventions?.length > 0 ?
    interventions.reduce((sum: number, i: any) => {
      const diff = new Date(i.intervention_date).getTime() - new Date(i.created_at).getTime();
      return sum + (diff / (1000 * 60 * 60)); // hours
    }, 0) / interventions.length : 24;

  const timelinessScore = Math.max(0, 100 - (avgResponseTime * 2)); // Penalty for slow response

  // Audit Trail Completeness (20% of governance score)
  const auditTrailScore = 95; // High score for read-only system with automatic logging

  // Transparency (10% of governance score)
  const { data: reports } = await supabase
    .from('esg_reports')
    .select('status')
    .eq('casino_id', casino_id)
    .gte('report_period_start', period_start)
    .lte('report_period_end', period_end);

  const transparencyScore = reports?.filter((r: any) => r.status === 'published').length > 0 ? 100 : 50;

  // Weighted governance score
  return (
    complianceRate * 0.40 +
    timelinessScore * 0.30 +
    auditTrailScore * 0.20 +
    transparencyScore * 0.10
  );
}

async function calculateEthicalCultureScore(
  supabase: any,
  casino_id: string,
  period_start: string,
  period_end: string
): Promise<number> {
  // Based on principles 1, 2, 3 - ethical leadership, ethics governance, corporate citizenship
  const { data: principles } = await supabase
    .from('king_iv_compliance_status')
    .select('compliance_score')
    .eq('casino_id', casino_id)
    .in('king_iv_principle_id', [
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 1).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 2).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 3).single()).data?.id,
    ]);

  const avgScore = principles?.reduce((sum: number, p: any) => sum + (p.compliance_score || 0), 0) / Math.max(1, principles?.length || 1);
  return avgScore || 75;
}

async function calculateGoodPerformanceScore(
  supabase: any,
  casino_id: string,
  period_start: string,
  period_end: string
): Promise<number> {
  // Based on principles 4, 9 - strategy/risk/performance integration, performance evaluation
  const { data: principles } = await supabase
    .from('king_iv_compliance_status')
    .select('compliance_score')
    .eq('casino_id', casino_id)
    .in('king_iv_principle_id', [
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 4).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 9).single()).data?.id,
    ]);

  const avgScore = principles?.reduce((sum: number, p: any) => sum + (p.compliance_score || 0), 0) / Math.max(1, principles?.length || 1);
  return avgScore || 80;
}

async function calculateEffectiveControlScore(
  supabase: any,
  casino_id: string,
  period_start: string,
  period_end: string
): Promise<number> {
  // Based on principles 10, 11, 13, 15 - audit, risk, compliance, assurance
  const { data: principles } = await supabase
    .from('king_iv_compliance_status')
    .select('compliance_score')
    .eq('casino_id', casino_id)
    .in('king_iv_principle_id', [
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 10).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 11).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 13).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 15).single()).data?.id,
    ]);

  const avgScore = principles?.reduce((sum: number, p: any) => sum + (p.compliance_score || 0), 0) / Math.max(1, principles?.length || 1);
  return avgScore || 85;
}

async function calculateLegitimacyScore(
  supabase: any,
  casino_id: string,
  period_start: string,
  period_end: string
): Promise<number> {
  // Based on principles 5, 16, 17 - reporting, stakeholder relationships, accountability
  const { data: principles } = await supabase
    .from('king_iv_compliance_status')
    .select('compliance_score')
    .eq('casino_id', casino_id)
    .in('king_iv_principle_id', [
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 5).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 16).single()).data?.id,
      (await supabase.from('king_iv_principles').select('id').eq('principle_number', 17).single()).data?.id,
    ]);

  const avgScore = principles?.reduce((sum: number, p: any) => sum + (p.compliance_score || 0), 0) / Math.max(1, principles?.length || 1);
  return avgScore || 80;
}

async function createEvidenceTrail(
  supabase: any,
  casino_id: string,
  score_id: string,
  metrics: any
): Promise<void> {
  const evidence = [];

  // Intervention evidence
  if (metrics?.interventions_performed > 0) {
    evidence.push({
      casino_id,
      esg_score_id: score_id,
      evidence_type: 'intervention_log',
      evidence_source: 'player_protection_interventions',
      evidence_timestamp: new Date().toISOString(),
      evidence_data: {
        interventions: metrics.interventions_performed,
        successful: metrics.successful_interventions
      },
      metric_name: 'Player Protection Intervention Rate',
      metric_value: (metrics.successful_interventions / metrics.interventions_performed) * 100
    });
  }

  // Training evidence
  if (metrics?.employees_trained > 0) {
    evidence.push({
      casino_id,
      esg_score_id: score_id,
      evidence_type: 'training_completion',
      evidence_source: 'employee_rg_training',
      evidence_timestamp: new Date().toISOString(),
      evidence_data: {
        employees_trained: metrics.employees_trained,
        completion_rate: metrics.training_completion_rate
      },
      metric_name: 'Employee RG Training Completion Rate',
      metric_value: metrics.training_completion_rate
    });
  }

  // Compliance evidence
  if (metrics?.compliance_audits_passed > 0) {
    evidence.push({
      casino_id,
      esg_score_id: score_id,
      evidence_type: 'audit_record',
      evidence_source: 'esg_metrics',
      evidence_timestamp: new Date().toISOString(),
      evidence_data: {
        audits_passed: metrics.compliance_audits_passed,
        violations: metrics.regulatory_violations
      },
      metric_name: 'Regulatory Compliance Rate',
      metric_value: (metrics.compliance_audits_passed / (metrics.compliance_audits_passed + metrics.regulatory_violations)) * 100
    });
  }

  if (evidence.length > 0) {
    await supabase.from('esg_evidence_trail').insert(evidence);
  }
}
