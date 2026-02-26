/*
  # Sync AI Intelligence System with All Casino Players

  Generates comprehensive AI intelligence data for all active players across all casinos:
  1. AI Reason Stacks - Risk assessments for ~80% of players with realistic risk distributions
  2. AI Intervention Recommendations - For high/critical risk players
  3. Historical Intervention Outcomes - Past 60 days of intervention data
  
  Risk Distribution:
  - Low: 50%
  - Moderate: 30%
  - High: 15%
  - Critical: 5%
*/

-- Clear existing AI data
TRUNCATE ai_reason_stacks, ai_intervention_recommendations, ai_intervention_outcomes CASCADE;

-- Generate AI Reason Stacks for ~80% of active players with realistic risk distribution
INSERT INTO ai_reason_stacks (
  player_id, 
  casino_id, 
  risk_level, 
  ai_confidence_score, 
  contributing_factors, 
  nova_iq_weight_percent, 
  casino_data_weight_percent, 
  explanation_summary, 
  triggers_24h, 
  triggers_7d, 
  triggers_30d, 
  created_at
)
SELECT 
  p.id,
  p.casino_id,
  -- Realistic risk distribution: 50% low, 30% moderate, 15% high, 5% critical
  CASE 
    WHEN random() < 0.50 THEN 'low'
    WHEN random() < 0.80 THEN 'moderate'
    WHEN random() < 0.95 THEN 'high'
    ELSE 'critical'
  END as risk_level,
  -- Confidence score based on risk level
  CASE 
    WHEN random() < 0.50 THEN (40 + random() * 20)::numeric  -- Low: 40-60
    WHEN random() < 0.80 THEN (60 + random() * 15)::numeric  -- Moderate: 60-75
    WHEN random() < 0.95 THEN (75 + random() * 15)::numeric  -- High: 75-90
    ELSE (85 + random() * 15)::numeric                       -- Critical: 85-100
  END as ai_confidence_score,
  -- Contributing factors based on risk level
  CASE 
    WHEN random() < 0.50 THEN 
      '[{"factor":"Stable play pattern","weight_percent":45,"source":"live_casino","time_period":"30d","trend":"stable"},{"factor":"Good self-control","weight_percent":30,"source":"nova_iq","time_period":"assessment","trend":"positive"},{"factor":"Budget adherence","weight_percent":15,"source":"live_casino","time_period":"90d","trend":"stable"},{"factor":"Healthy engagement","weight_percent":10,"source":"live_casino","time_period":"7d","trend":"stable"}]'::jsonb
    WHEN random() < 0.80 THEN 
      '[{"factor":"Increasing session frequency","weight_percent":32,"source":"live_casino","time_period":"7d","trend":"increasing"},{"factor":"Moderate impulsivity","weight_percent":26,"source":"nova_iq","time_period":"assessment","trend":"stable"},{"factor":"Late-night play pattern","weight_percent":24,"source":"live_casino","time_period":"14d","trend":"increasing"},{"factor":"Minor budget deviation","weight_percent":18,"source":"live_casino","time_period":"30d","trend":"new"}]'::jsonb
    WHEN random() < 0.95 THEN 
      '[{"factor":"Loss-chasing behavior","weight_percent":38,"source":"live_casino","time_period":"24h","trend":"increasing"},{"factor":"High impulsivity score","weight_percent":29,"source":"nova_iq","time_period":"assessment","trend":"concerning"},{"factor":"Session escalation","weight_percent":21,"source":"live_casino","time_period":"7d","trend":"increasing"},{"factor":"Spend volatility","weight_percent":12,"source":"live_casino","time_period":"7d","trend":"new"}]'::jsonb
    ELSE 
      '[{"factor":"Extreme loss-chasing","weight_percent":42,"source":"live_casino","time_period":"12h","trend":"critical"},{"factor":"Emotional decision pattern","weight_percent":31,"source":"nova_iq","time_period":"assessment","trend":"high"},{"factor":"Credit limit exceeded","weight_percent":18,"source":"live_casino","time_period":"24h","trend":"new"},{"factor":"Cognitive fatigue indicators","weight_percent":9,"source":"live_casino","time_period":"6h","trend":"increasing"}]'::jsonb
  END as contributing_factors,
  -- Nova IQ weight percentage (higher for more severe cases)
  CASE 
    WHEN random() < 0.50 THEN (30 + random() * 10)::numeric
    WHEN random() < 0.80 THEN (25 + random() * 10)::numeric
    WHEN random() < 0.95 THEN (25 + random() * 15)::numeric
    ELSE (28 + random() * 12)::numeric
  END as nova_iq_weight_percent,
  -- Casino data weight percentage (complement of nova_iq)
  CASE 
    WHEN random() < 0.50 THEN (60 + random() * 10)::numeric
    WHEN random() < 0.80 THEN (65 + random() * 10)::numeric
    WHEN random() < 0.95 THEN (60 + random() * 15)::numeric
    ELSE (60 + random() * 12)::numeric
  END as casino_data_weight_percent,
  -- Explanation based on risk level
  CASE 
    WHEN random() < 0.50 THEN 'Low risk profile with stable behavioral patterns. Nova IQ assessment shows good self-control. Continue routine monitoring.'
    WHEN random() < 0.80 THEN 'Moderate risk with some increasing behavioral patterns. Nova IQ indicates moderate impulsivity. Consider proactive engagement.'
    WHEN random() < 0.95 THEN 'High-risk behavioral pattern detected. Nova IQ assessment shows concerning impulsivity levels. Intervention recommended.'
    ELSE 'Critical risk level requiring immediate attention. Nova IQ profile combined with live data indicates urgent intervention needed.'
  END as explanation_summary,
  -- Triggers in last 24h
  CASE 
    WHEN random() < 0.50 THEN '[]'::jsonb
    WHEN random() < 0.80 THEN '[{"type":"minor_deviation","count":1}]'::jsonb
    WHEN random() < 0.95 THEN '[{"type":"loss_chasing","count":2},{"type":"session_escalation","ratio":1.8}]'::jsonb
    ELSE '[{"type":"loss_chasing","count":5},{"type":"credit_exceeded","amount":3000},{"type":"emotional_tilt","detected":true}]'::jsonb
  END as triggers_24h,
  -- Triggers in last 7d
  CASE 
    WHEN random() < 0.50 THEN '[]'::jsonb
    WHEN random() < 0.80 THEN '[{"type":"session_frequency","increase_percent":25}]'::jsonb
    WHEN random() < 0.95 THEN '[{"type":"spend_volatility","coefficient":55},{"type":"pattern_deviation","score":62}]'::jsonb
    ELSE '[{"type":"session_duration","hours":16},{"type":"deposit_spike","increase":85}]'::jsonb
  END as triggers_7d,
  -- Triggers in last 30d
  CASE 
    WHEN random() < 0.50 THEN '[]'::jsonb
    WHEN random() < 0.80 THEN '[{"type":"budget_deviation","amount":800}]'::jsonb
    ELSE '[{"type":"escalating_pattern","detected":true}]'::jsonb
  END as triggers_30d,
  -- Created at (staggered over last 24 hours)
  now() - (random() * interval '24 hours') as created_at
FROM players p
WHERE random() < 0.80  -- Only 80% of players have current AI assessments
ORDER BY random();

-- Generate AI Intervention Recommendations for high/critical risk players
INSERT INTO ai_intervention_recommendations (
  player_id,
  casino_id,
  reason_stack_id,
  recommended_intervention_type,
  recommended_timing,
  success_probability,
  rationale,
  alternative_options,
  staff_decision,
  decision_rationale,
  decided_at,
  created_at
)
SELECT 
  rs.player_id,
  rs.casino_id,
  rs.id,
  -- Intervention type based on risk level
  CASE 
    WHEN rs.risk_level = 'critical' THEN (ARRAY['escalation', 'self_exclusion', 'cooling_off'])[floor(random() * 3 + 1)]
    WHEN rs.risk_level = 'high' THEN (ARRAY['cooling_off', 'deposit_limit', 'staff_contact'])[floor(random() * 3 + 1)]
    WHEN rs.risk_level = 'moderate' THEN (ARRAY['soft_message', 'deposit_limit', 'session_limit'])[floor(random() * 3 + 1)]
    ELSE 'monitor_only'
  END as recommended_intervention_type,
  -- Timing based on risk level
  CASE 
    WHEN rs.risk_level IN ('critical', 'high') THEN 'immediate'
    WHEN rs.risk_level = 'moderate' THEN (ARRAY['delayed', 'monitor'])[floor(random() * 2 + 1)]
    ELSE 'monitor'
  END as recommended_timing,
  -- Success probability
  CASE 
    WHEN rs.risk_level = 'critical' THEN (82 + random() * 13)::numeric
    WHEN rs.risk_level = 'high' THEN (72 + random() * 15)::numeric
    WHEN rs.risk_level = 'moderate' THEN (65 + random() * 18)::numeric
    ELSE (50 + random() * 25)::numeric
  END as success_probability,
  -- Rationale
  CASE 
    WHEN rs.risk_level = 'critical' THEN 'Critical risk indicators detected. Immediate escalation required. Nova IQ emotional profile supports urgent intervention.'
    WHEN rs.risk_level = 'high' THEN 'High-risk behavioral pattern with Nova IQ indicators. Proactive intervention recommended to prevent escalation.'
    WHEN rs.risk_level = 'moderate' THEN 'Moderate risk with increasing patterns. Soft intervention recommended to maintain healthy play.'
    ELSE 'Low risk profile. Continue monitoring with no active intervention required.'
  END as rationale,
  -- Alternative options
  CASE 
    WHEN rs.risk_level = 'critical' THEN '[{"type":"cooling_off","probability":92,"rationale":"Mandatory cooling-off period"},{"type":"deposit_limit","probability":85,"rationale":"Immediate deposit limits"}]'::jsonb
    WHEN rs.risk_level = 'high' THEN '[{"type":"soft_message","probability":68,"rationale":"Supportive message with tools"},{"type":"deposit_limit","probability":74,"rationale":"Proactive limit setting"}]'::jsonb
    WHEN rs.risk_level = 'moderate' THEN '[{"type":"session_limit","probability":65,"rationale":"Set session time limits"},{"type":"monitor_only","probability":58,"rationale":"Increase monitoring"}]'::jsonb
    ELSE '[]'::jsonb
  END as alternative_options,
  -- Staff decision (70% accepted, 20% overridden, 10% deferred)
  CASE 
    WHEN random() < 0.70 THEN 'accepted'
    WHEN random() < 0.90 THEN 'overridden'
    ELSE 'deferred'
  END as staff_decision,
  -- Decision rationale
  CASE 
    WHEN random() < 0.70 THEN 'AI recommendation aligns with observed player behavior. Proceeding as suggested.'
    WHEN random() < 0.90 THEN 'Player has been cooperative historically. Using softer approach initially.'
    ELSE 'Waiting for additional behavioral data before final intervention decision.'
  END as decision_rationale,
  -- Decided at (within 6 hours of creation)
  rs.created_at + (random() * interval '6 hours') as decided_at,
  rs.created_at + interval '5 minutes' as created_at
FROM ai_reason_stacks rs
WHERE rs.risk_level IN ('moderate', 'high', 'critical')
  AND random() < 0.85;  -- 85% of high-risk players get recommendations

-- Generate Historical Intervention Outcomes (last 60 days)
INSERT INTO ai_intervention_outcomes (
  player_id,
  casino_id,
  recommendation_id,
  intervention_type,
  applied_at,
  nova_iq_influenced,
  pre_risk_score,
  pre_impulsivity_score,
  post_risk_score_7d,
  post_risk_score_14d,
  post_risk_score_30d,
  outcome,
  effectiveness_score,
  time_to_impact_days,
  player_response,
  player_engagement_level,
  created_at,
  updated_at
)
SELECT 
  p.id as player_id,
  p.casino_id,
  NULL as recommendation_id,  -- Historical data without recommendation link
  (ARRAY['cooling_off', 'soft_message', 'deposit_limit', 'session_limit', 'staff_contact'])[floor(random() * 5 + 1)] as intervention_type,
  now() - (random() * interval '60 days' + interval '10 days') as applied_at,
  random() < 0.78 as nova_iq_influenced,  -- 78% were Nova IQ influenced
  (65 + random() * 30)::int as pre_risk_score,
  (60 + random() * 35)::int as pre_impulsivity_score,
  -- Post-risk scores show general improvement trend
  GREATEST(25, (60 - random() * 25)::int) as post_risk_score_7d,
  GREATEST(22, (55 - random() * 28)::int) as post_risk_score_14d,
  GREATEST(20, (50 - random() * 30)::int) as post_risk_score_30d,
  -- 75% successful outcomes
  CASE 
    WHEN random() < 0.75 THEN 'risk_reduced'
    WHEN random() < 0.90 THEN 'risk_stable'
    ELSE 'risk_increased'
  END as outcome,
  (55 + random() * 40)::int as effectiveness_score,
  (3 + random() * 14)::int as time_to_impact_days,
  (ARRAY[
    'Positive - player acknowledged support and engaged with resources',
    'Neutral - player complied without feedback',
    'Positive - player requested additional support resources',
    'Positive - player expressed gratitude for intervention',
    'Neutral - player accepted limits without comment',
    'Negative - player initially resistant but complied'
  ])[floor(random() * 6 + 1)] as player_response,
  (ARRAY['high', 'high', 'medium', 'medium', 'low'])[floor(random() * 5 + 1)] as player_engagement_level,
  now() - (random() * interval '60 days' + interval '10 days') as created_at,
  now() - (random() * interval '15 days') as updated_at
FROM players p
WHERE random() < 0.35  -- 35% of players have historical intervention outcomes
ORDER BY random();

-- Update statistics
ANALYZE ai_reason_stacks;
ANALYZE ai_intervention_recommendations;
ANALYZE ai_intervention_outcomes;
