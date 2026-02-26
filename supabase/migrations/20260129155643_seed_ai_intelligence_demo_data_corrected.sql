/*
  # Seed AI Intelligence System Demo Data for All Casinos

  Populates comprehensive demo data for:
  1. AI Reason Stacks - Explainable AI risk assessments
  2. AI Intervention Recommendations - AI-guided intervention suggestions
  3. AI Intervention Outcomes - Post-intervention effectiveness tracking
  4. AI Learning Metrics - System performance and accuracy improvements

  Covers all three casinos with realistic behavioral patterns and outcomes.
*/

-- Clear existing data
TRUNCATE ai_reason_stacks, ai_intervention_recommendations, ai_intervention_outcomes, ai_learning_metrics CASCADE;

-- Helper: Get some player IDs for each casino
DO $$
DECLARE
  casino_royal uuid := '11111111-1111-1111-1111-111111111111';
  casino_golden uuid := '22222222-2222-2222-2222-222222222222';
  casino_silver uuid := '33333333-3333-3333-3333-333333333333';
  player_ids_royal uuid[];
  player_ids_golden uuid[];
  player_ids_silver uuid[];
BEGIN
  -- Get player IDs for Royal Palace Casino
  SELECT array_agg(id) INTO player_ids_royal FROM (
    SELECT id FROM players WHERE casino_id = casino_royal ORDER BY random() LIMIT 10
  ) sub;

  -- Get player IDs for Golden Dragon Gaming
  SELECT array_agg(id) INTO player_ids_golden FROM (
    SELECT id FROM players WHERE casino_id = casino_golden ORDER BY random() LIMIT 10
  ) sub;

  -- Get player IDs for Silver Star Resort
  SELECT array_agg(id) INTO player_ids_silver FROM (
    SELECT id FROM players WHERE casino_id = casino_silver ORDER BY random() LIMIT 10
  ) sub;

  -- Insert AI Reason Stacks for Royal Palace Casino
  IF array_length(player_ids_royal, 1) > 0 THEN
    INSERT INTO ai_reason_stacks (player_id, casino_id, risk_level, ai_confidence_score, contributing_factors, nova_iq_weight_percent, casino_data_weight_percent, explanation_summary, triggers_24h, triggers_7d, triggers_30d, created_at)
    VALUES
    (player_ids_royal[1], casino_royal, 'high', 87, 
      '[{"factor":"Loss-chasing behavior detected","weight_percent":38,"source":"live_casino","time_period":"24h","trend":"increasing"},{"factor":"Session escalation above baseline","weight_percent":27,"source":"live_casino","time_period":"24h vs 7d","trend":"increasing"},{"factor":"High impulsivity index","weight_percent":21,"source":"nova_iq","time_period":"assessment","trend":"stable"},{"factor":"High spend volatility","weight_percent":14,"source":"live_casino","time_period":"7d","trend":"increasing"}]'::jsonb,
      21, 79, 'Multiple high-risk behavioral patterns detected in the last 24 hours, supported by Nova IQ impulsivity assessment. Immediate intervention recommended.',
      '[{"type":"loss_chasing","count":3},{"type":"session_escalation","ratio":2.4}]'::jsonb,
      '[{"type":"spend_volatility","coefficient":68}]'::jsonb,
      '[]'::jsonb,
      now() - interval '2 hours'),
      
    (player_ids_royal[2], casino_royal, 'moderate', 68, 
      '[{"factor":"Increasing bet frequency","weight_percent":35,"source":"live_casino","time_period":"7d","trend":"increasing"},{"factor":"Time pressure sensitivity","weight_percent":28,"source":"nova_iq","time_period":"assessment","trend":"stable"},{"factor":"After-hours play pattern","weight_percent":22,"source":"live_casino","time_period":"24h","trend":"new"},{"factor":"Budget deviation","weight_percent":15,"source":"live_casino","time_period":"30d","trend":"increasing"}]'::jsonb,
      28, 72, 'Moderate risk profile with Nova IQ behavioral indicators suggesting need for soft intervention.',
      '[{"type":"time_pressure","sessions":2}]'::jsonb,
      '[{"type":"bet_frequency","increase_percent":42}]'::jsonb,
      '[{"type":"budget_deviation","amount":1200}]'::jsonb,
      now() - interval '5 hours'),
      
    (player_ids_royal[3], casino_royal, 'critical', 93, 
      '[{"factor":"Extreme loss-chasing","weight_percent":42,"source":"live_casino","time_period":"12h","trend":"critical"},{"factor":"Emotional decision pattern","weight_percent":31,"source":"nova_iq","time_period":"assessment","trend":"high"},{"factor":"Credit limit exceeded","weight_percent":18,"source":"live_casino","time_period":"24h","trend":"new"},{"factor":"Cognitive fatigue indicators","weight_percent":9,"source":"live_casino","time_period":"6h","trend":"increasing"}]'::jsonb,
      31, 69, 'Critical risk level requiring immediate escalation. Player shows extreme loss-chasing combined with emotional decision-making profile from Nova IQ.',
      '[{"type":"loss_chasing","count":7},{"type":"credit_exceeded","amount":5000},{"type":"cognitive_fatigue","score":82}]'::jsonb,
      '[{"type":"session_duration","hours":18}]'::jsonb,
      '[]'::jsonb,
      now() - interval '1 hour');
  END IF;

  -- Insert AI Reason Stacks for Golden Dragon Gaming
  IF array_length(player_ids_golden, 1) > 0 THEN
    INSERT INTO ai_reason_stacks (player_id, casino_id, risk_level, ai_confidence_score, contributing_factors, nova_iq_weight_percent, casino_data_weight_percent, explanation_summary, triggers_24h, triggers_7d, triggers_30d, created_at)
    VALUES
    (player_ids_golden[1], casino_golden, 'high', 84, 
      '[{"factor":"Rapid bet escalation","weight_percent":36,"source":"live_casino","time_period":"24h","trend":"increasing"},{"factor":"Low patience score","weight_percent":29,"source":"nova_iq","time_period":"assessment","trend":"stable"},{"factor":"Chasing losses after setback","weight_percent":23,"source":"live_casino","time_period":"6h","trend":"critical"},{"factor":"Deviation from play pattern","weight_percent":12,"source":"live_casino","time_period":"7d","trend":"new"}]'::jsonb,
      29, 71, 'High-risk player exhibiting loss-chasing behavior with Nova IQ low patience profile. Cooling-off period recommended.',
      '[{"type":"bet_escalation","multiplier":3.2},{"type":"loss_chasing","count":4}]'::jsonb,
      '[{"type":"pattern_deviation","score":67}]'::jsonb,
      '[]'::jsonb,
      now() - interval '3 hours'),
      
    (player_ids_golden[2], casino_golden, 'moderate', 72, 
      '[{"factor":"Session frequency increase","weight_percent":32,"source":"live_casino","time_period":"7d","trend":"increasing"},{"factor":"Moderate impulsivity","weight_percent":26,"source":"nova_iq","time_period":"assessment","trend":"stable"},{"factor":"Late-night sessions","weight_percent":24,"source":"live_casino","time_period":"14d","trend":"increasing"},{"factor":"Win-chasing behavior","weight_percent":18,"source":"live_casino","time_period":"24h","trend":"new"}]'::jsonb,
      26, 74, 'Moderate risk with increasing session frequency. Nova IQ impulsivity suggests proactive engagement.',
      '[{"type":"win_chasing","detected":true}]'::jsonb,
      '[{"type":"session_frequency","increase_percent":38}]'::jsonb,
      '[]'::jsonb,
      now() - interval '8 hours'),
      
    (player_ids_golden[3], casino_golden, 'low', 45, 
      '[{"factor":"Stable play pattern","weight_percent":40,"source":"live_casino","time_period":"30d","trend":"stable"},{"factor":"High self-control score","weight_percent":35,"source":"nova_iq","time_period":"assessment","trend":"positive"},{"factor":"Budget adherence","weight_percent":15,"source":"live_casino","time_period":"90d","trend":"stable"},{"factor":"Positive engagement","weight_percent":10,"source":"live_casino","time_period":"7d","trend":"stable"}]'::jsonb,
      35, 65, 'Low risk profile with positive Nova IQ behavioral assessment. Continue monitoring.',
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      now() - interval '12 hours');
  END IF;

  -- Insert AI Reason Stacks for Silver Star Resort
  IF array_length(player_ids_silver, 1) > 0 THEN
    INSERT INTO ai_reason_stacks (player_id, casino_id, risk_level, ai_confidence_score, contributing_factors, nova_iq_weight_percent, casino_data_weight_percent, explanation_summary, triggers_24h, triggers_7d, triggers_30d, created_at)
    VALUES
    (player_ids_silver[1], casino_silver, 'high', 89, 
      '[{"factor":"Compulsive betting pattern","weight_percent":41,"source":"live_casino","time_period":"24h","trend":"critical"},{"factor":"High risk tolerance","weight_percent":27,"source":"nova_iq","time_period":"assessment","trend":"high"},{"factor":"Emotional tilt detected","weight_percent":20,"source":"live_casino","time_period":"2h","trend":"increasing"},{"factor":"Social isolation pattern","weight_percent":12,"source":"live_casino","time_period":"14d","trend":"concerning"}]'::jsonb,
      27, 73, 'High-risk compulsive pattern with Nova IQ high risk tolerance. Requires immediate cooling-off intervention.',
      '[{"type":"compulsive_betting","score":88},{"type":"emotional_tilt","detected":true}]'::jsonb,
      '[{"type":"social_isolation","sessions":12}]'::jsonb,
      '[]'::jsonb,
      now() - interval '90 minutes'),
      
    (player_ids_silver[2], casino_silver, 'moderate', 66, 
      '[{"factor":"Weekend binge pattern","weight_percent":34,"source":"live_casino","time_period":"30d","trend":"increasing"},{"factor":"Impatient decision-making","weight_percent":28,"source":"nova_iq","time_period":"assessment","trend":"moderate"},{"factor":"Alcohol-influenced sessions","weight_percent":21,"source":"live_casino","time_period":"7d","trend":"detected"},{"factor":"Deposit frequency spike","weight_percent":17,"source":"live_casino","time_period":"14d","trend":"new"}]'::jsonb,
      28, 72, 'Weekend binge pattern with Nova IQ impatience indicators. Soft message with self-assessment tools recommended.',
      '[]'::jsonb,
      '[{"type":"alcohol_sessions","count":3},{"type":"deposit_spike","increase":65}]'::jsonb,
      '[{"type":"weekend_binge","sessions":8}]'::jsonb,
      now() - interval '6 hours');
  END IF;
END $$;

-- Insert AI Intervention Recommendations
INSERT INTO ai_intervention_recommendations (player_id, casino_id, recommended_intervention_type, recommended_timing, success_probability, rationale, alternative_options, staff_decision, decision_rationale, decided_at, created_at)
SELECT 
  rs.player_id,
  rs.casino_id,
  CASE 
    WHEN rs.risk_level = 'critical' THEN 'escalation'
    WHEN rs.risk_level = 'high' THEN 'cooling_off'
    WHEN rs.risk_level = 'moderate' THEN 'soft_message'
    ELSE 'monitor_only'
  END,
  CASE 
    WHEN rs.risk_level IN ('critical', 'high') THEN 'immediate'
    WHEN rs.risk_level = 'moderate' THEN 'delayed'
    ELSE 'monitor'
  END,
  CASE 
    WHEN rs.risk_level = 'critical' THEN 85 + (random() * 10)::int
    WHEN rs.risk_level = 'high' THEN 75 + (random() * 10)::int
    WHEN rs.risk_level = 'moderate' THEN 65 + (random() * 15)::int
    ELSE 50 + (random() * 20)::int
  END,
  CASE 
    WHEN rs.risk_level = 'critical' THEN 'Critical risk indicators detected. Immediate escalation to senior staff and mandatory cooling-off period required. Nova IQ emotional profile supports immediate action.'
    WHEN rs.risk_level = 'high' THEN 'High-risk behavioral pattern with Nova IQ indicators. Cooling-off period recommended to restore rational decision-making.'
    WHEN rs.risk_level = 'moderate' THEN 'Moderate risk with increasing patterns. Soft intervention with self-assessment tools recommended as first step.'
    ELSE 'Low risk profile. Continue monitoring with no active intervention required.'
  END,
  CASE 
    WHEN rs.risk_level = 'critical' THEN '[{"type":"cooling_off","probability":92,"rationale":"Mandatory break with support resources"},{"type":"deposit_limit","probability":78,"rationale":"Immediate deposit and bet limits"}]'::jsonb
    WHEN rs.risk_level = 'high' THEN '[{"type":"soft_message","probability":68,"rationale":"Send supportive message with self-assessment tools"},{"type":"deposit_limit","probability":72,"rationale":"Set deposit and bet limits"}]'::jsonb
    WHEN rs.risk_level = 'moderate' THEN '[{"type":"deposit_limit","probability":62,"rationale":"Proactive limit setting"},{"type":"monitor_only","probability":58,"rationale":"Increase monitoring frequency"}]'::jsonb
    ELSE '[]'::jsonb
  END,
  CASE 
    WHEN random() < 0.7 THEN 'accepted'
    WHEN random() < 0.85 THEN 'overridden'
    ELSE 'deferred'
  END,
  CASE 
    WHEN random() < 0.7 THEN 'Recommendation aligns with observed behavior. Proceeding as suggested.'
    WHEN random() < 0.85 THEN 'Player has been cooperative in past. Using softer approach first.'
    ELSE 'Waiting for additional data before intervention.'
  END,
  now() - (random() * interval '6 hours'),
  rs.created_at + interval '5 minutes'
FROM ai_reason_stacks rs
WHERE rs.created_at > now() - interval '24 hours';

-- Insert AI Intervention Outcomes (historical data)
INSERT INTO ai_intervention_outcomes (player_id, casino_id, intervention_type, applied_at, nova_iq_influenced, pre_risk_score, pre_impulsivity_score, post_risk_score_7d, post_risk_score_14d, post_risk_score_30d, outcome, effectiveness_score, time_to_impact_days, player_response, player_engagement_level, created_at, updated_at)
SELECT 
  p.id,
  p.casino_id,
  (ARRAY['cooling_off', 'soft_message', 'deposit_limit', 'escalation'])[floor(random() * 4 + 1)],
  now() - (random() * interval '45 days' + interval '15 days'),
  random() < 0.75,
  70 + (random() * 25)::int,
  65 + (random() * 30)::int,
  GREATEST(30, (70 - random() * 30)::int),
  GREATEST(25, (65 - random() * 35)::int),
  GREATEST(20, (60 - random() * 40)::int),
  (ARRAY['risk_reduced', 'risk_reduced', 'risk_reduced', 'risk_stable', 'risk_increased'])[floor(random() * 5 + 1)],
  60 + (random() * 35)::int,
  3 + (random() * 12)::int,
  (ARRAY['Positive - player acknowledged support', 'Neutral - player complied without feedback', 'Positive - player requested additional resources', 'Negative - player expressed frustration'])[floor(random() * 4 + 1)],
  (ARRAY['high', 'high', 'medium', 'medium', 'low'])[floor(random() * 5 + 1)],
  now() - (random() * interval '45 days' + interval '15 days'),
  now() - (random() * interval '10 days')
FROM players p
WHERE p.casino_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')
ORDER BY random()
LIMIT 25;

-- Insert AI Learning Metrics for each casino (last 90 days)
INSERT INTO ai_learning_metrics (casino_id, period_start, period_end, total_predictions, correct_predictions, accuracy_percent, accuracy_change_percent, baseline_accuracy_percent, nova_iq_enhanced_predictions, nova_iq_accuracy_lift_percent, total_interventions, successful_interventions, success_rate_percent, confidence_score_avg, false_positive_rate, false_negative_rate, created_at)
VALUES
-- Royal Palace Casino - 90 days ago
('11111111-1111-1111-1111-111111111111', now() - interval '90 days', now() - interval '60 days', 1247, 855, 68.56, 0, 68.56, 456, 10.2, 342, 278, 81.3, 73.4, 14.2, 8.1, now() - interval '60 days'),
-- Royal Palace Casino - 60 days ago
('11111111-1111-1111-1111-111111111111', now() - interval '60 days', now() - interval '30 days', 1389, 1042, 75.02, 6.46, 68.56, 523, 11.8, 387, 328, 84.8, 76.2, 11.5, 6.8, now() - interval '30 days'),
-- Royal Palace Casino - 30 days ago
('11111111-1111-1111-1111-111111111111', now() - interval '30 days', now(), 1502, 1301, 86.62, 18.06, 68.56, 612, 13.4, 418, 349, 83.5, 79.1, 8.7, 4.9, now() - interval '1 day'),

-- Golden Dragon Gaming - 90 days ago
('22222222-2222-2222-2222-222222222222', now() - interval '90 days', now() - interval '60 days', 1156, 793, 68.60, 0, 68.60, 423, 9.8, 318, 261, 82.1, 72.8, 13.8, 8.4, now() - interval '60 days'),
-- Golden Dragon Gaming - 60 days ago
('22222222-2222-2222-2222-222222222222', now() - interval '60 days', now() - interval '30 days', 1298, 981, 75.58, 6.98, 68.60, 489, 12.1, 356, 302, 84.8, 75.9, 11.2, 7.1, now() - interval '30 days'),
-- Golden Dragon Gaming - 30 days ago
('22222222-2222-2222-2222-222222222222', now() - interval '30 days', now(), 1423, 1235, 86.80, 18.20, 68.60, 578, 13.7, 392, 327, 83.4, 78.6, 8.4, 5.2, now() - interval '1 day'),

-- Silver Star Resort - 90 days ago
('33333333-3333-3333-3333-333333333333', now() - interval '90 days', now() - interval '60 days', 1089, 738, 67.77, 0, 67.77, 398, 9.5, 297, 242, 81.5, 71.9, 14.5, 8.8, now() - interval '60 days'),
-- Silver Star Resort - 60 days ago
('33333333-3333-3333-3333-333333333333', now() - interval '60 days', now() - interval '30 days', 1201, 903, 75.19, 7.42, 67.77, 467, 11.6, 334, 283, 84.7, 75.1, 11.8, 7.4, now() - interval '30 days'),
-- Silver Star Resort - 30 days ago
('33333333-3333-3333-3333-333333333333', now() - interval '30 days', now(), 1334, 1154, 86.51, 18.74, 67.77, 542, 13.1, 378, 314, 83.1, 78.2, 8.9, 5.3, now() - interval '1 day'),

-- Global System Metrics (NULL casino_id for system-wide)
(NULL, now() - interval '90 days', now() - interval '60 days', 3492, 2386, 68.31, 0, 68.31, 1277, 9.8, 957, 781, 81.6, 72.7, 14.2, 8.4, now() - interval '60 days'),
(NULL, now() - interval '60 days', now() - interval '30 days', 3888, 2926, 75.26, 6.95, 68.31, 1479, 11.8, 1077, 913, 84.8, 75.7, 11.5, 7.1, now() - interval '30 days'),
(NULL, now() - interval '30 days', now(), 4259, 3690, 86.64, 18.33, 68.31, 1732, 13.4, 1188, 990, 83.3, 78.6, 8.7, 5.1, now() - interval '1 day');
