/*
  # Fix AI Learning Metrics - Remove Duplicated Dates

  Regenerates AI Learning Metrics with:
  1. Unique, varied dates for each casino (not all identical)
  2. More realistic temporal patterns showing learning improvement
  3. Casino-specific performance variations
  4. Staggered measurement periods across casinos
  
  Creates 6 months of historical data per casino with varying:
  - Start/end dates offset by days
  - Prediction volumes based on casino size
  - Accuracy improvements over time
  - Nova IQ integration impact
*/

-- Clear existing duplicated data
TRUNCATE ai_learning_metrics CASCADE;

-- Generate varied AI learning metrics for each casino over 6 months
-- Each casino gets slightly offset measurement periods to avoid identical dates
INSERT INTO ai_learning_metrics (
  casino_id,
  period_start,
  period_end,
  total_predictions,
  correct_predictions,
  accuracy_percent,
  accuracy_change_percent,
  baseline_accuracy_percent,
  nova_iq_enhanced_predictions,
  nova_iq_accuracy_lift_percent,
  total_interventions,
  successful_interventions,
  success_rate_percent,
  confidence_score_avg,
  false_positive_rate,
  false_negative_rate,
  created_at
)
WITH casino_metrics AS (
  SELECT 
    c.id as casino_id,
    c.name as casino_name,
    -- Create 6 monthly periods per casino
    generate_series(0, 5) as month_offset,
    -- Casino-specific base metrics
    CASE c.name
      WHEN 'Royal Palace Casino' THEN 1500
      WHEN 'Golden Dragon Gaming' THEN 1300
      WHEN 'Silver Star Resort' THEN 1200
    END as base_predictions
  FROM casinos c
)
SELECT 
  cm.casino_id,
  -- Staggered period starts (offset by casino position)
  (now() - interval '180 days' + (cm.month_offset * interval '30 days') + 
    CASE cm.casino_name
      WHEN 'Royal Palace Casino' THEN interval '0 days'
      WHEN 'Golden Dragon Gaming' THEN interval '3 days'
      WHEN 'Silver Star Resort' THEN interval '7 days'
    END + 
    (random() * interval '12 hours')) as period_start,
  -- Period end (30 days after start)
  (now() - interval '180 days' + (cm.month_offset * interval '30 days') + interval '30 days' + 
    CASE cm.casino_name
      WHEN 'Royal Palace Casino' THEN interval '0 days'
      WHEN 'Golden Dragon Gaming' THEN interval '3 days'
      WHEN 'Silver Star Resort' THEN interval '7 days'
    END + 
    (random() * interval '12 hours')) as period_end,
  -- Total predictions (growing over time)
  (cm.base_predictions + (cm.month_offset * 50) + (random() * 200 - 100))::int as total_predictions,
  -- Correct predictions (improving accuracy over time)
  -- Start at 60% accuracy, improve to 87% by month 5
  ((cm.base_predictions + (cm.month_offset * 50) + (random() * 200 - 100)) * 
    (0.60 + (cm.month_offset * 0.045) + (random() * 0.03)))::int as correct_predictions,
  -- Accuracy percent (60% → 87% improvement)
  (60 + (cm.month_offset * 4.5) + (random() * 3))::numeric(5,2) as accuracy_percent,
  -- Month-over-month change
  CASE 
    WHEN cm.month_offset = 0 THEN 0.00
    ELSE (4.5 + (random() * 2 - 1))::numeric(5,2)
  END as accuracy_change_percent,
  -- Baseline without Nova IQ
  (58 + (cm.month_offset * 3.2) + (random() * 2))::numeric(5,2) as baseline_accuracy_percent,
  -- Nova IQ enhanced predictions (78% of total)
  ((cm.base_predictions + (cm.month_offset * 50)) * 0.78)::int as nova_iq_enhanced_predictions,
  -- Nova IQ lift (improving as model learns)
  (8 + (cm.month_offset * 0.8) + (random() * 2))::numeric(5,2) as nova_iq_accuracy_lift_percent,
  -- Total interventions (based on predictions)
  ((cm.base_predictions + (cm.month_offset * 50)) * 0.12)::int as total_interventions,
  -- Successful interventions (improving over time)
  ((cm.base_predictions + (cm.month_offset * 50)) * 0.12 * (0.68 + cm.month_offset * 0.04))::int as successful_interventions,
  -- Success rate (68% → 88%)
  (68 + (cm.month_offset * 4) + (random() * 3))::numeric(5,2) as success_rate_percent,
  -- Confidence score (improving)
  (72 + (cm.month_offset * 3.5) + (random() * 2))::numeric(5,2) as confidence_score_avg,
  -- False positive rate (decreasing)
  (15 - (cm.month_offset * 1.5) + (random() * 1))::numeric(5,2) as false_positive_rate,
  -- False negative rate (decreasing)
  (12 - (cm.month_offset * 1.2) + (random() * 1))::numeric(5,2) as false_negative_rate,
  -- Created at (end of period + 1 day)
  (now() - interval '180 days' + (cm.month_offset * interval '30 days') + interval '31 days' + 
    CASE cm.casino_name
      WHEN 'Royal Palace Casino' THEN interval '0 days'
      WHEN 'Golden Dragon Gaming' THEN interval '3 days'
      WHEN 'Silver Star Resort' THEN interval '7 days'
    END) as created_at
FROM casino_metrics cm
ORDER BY cm.casino_id, cm.month_offset;

-- Update statistics
ANALYZE ai_learning_metrics;
