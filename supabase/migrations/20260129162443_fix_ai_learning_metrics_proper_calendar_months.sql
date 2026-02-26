/*
  # Fix AI Learning Metrics - Proper Calendar Month Periods

  Regenerates AI Learning Metrics with proper calendar month periods:
  1. August 2025: Aug 1 - Aug 31
  2. September 2025: Sep 1 - Sep 30
  3. October 2025: Oct 1 - Oct 31
  4. November 2025: Nov 1 - Nov 30
  5. December 2025: Dec 1 - Dec 31
  6. January 2026: Jan 1 - Current Date (Jan 29, 2026)
  
  Each casino gets identical monthly periods (not staggered)
  Shows realistic AI learning improvement over 6 months
*/

-- Clear existing data
TRUNCATE ai_learning_metrics CASCADE;

-- Generate proper monthly AI learning metrics for each casino
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
WITH monthly_periods AS (
  -- Generate 6 months of data: Aug 2025 - Jan 2026
  SELECT 
    date_trunc('month', '2025-08-01'::date + (n || ' months')::interval) as month_start,
    CASE 
      -- January 2026 ends on current date
      WHEN date_trunc('month', '2025-08-01'::date + (n || ' months')::interval) = '2026-01-01'::date 
        THEN CURRENT_DATE
      -- All other months end on last day of month
      ELSE (date_trunc('month', '2025-08-01'::date + (n || ' months')::interval) + interval '1 month' - interval '1 day')::date
    END as month_end,
    n as month_offset
  FROM generate_series(0, 5) as n
),
casino_monthly_metrics AS (
  SELECT 
    c.id as casino_id,
    c.name as casino_name,
    mp.month_start,
    mp.month_end,
    mp.month_offset,
    -- Casino-specific base prediction volumes
    CASE c.name
      WHEN 'Royal Palace Casino' THEN 1500
      WHEN 'Golden Dragon Gaming' THEN 1300
      WHEN 'Silver Star Resort' THEN 1200
    END as base_predictions
  FROM casinos c
  CROSS JOIN monthly_periods mp
)
SELECT 
  cmm.casino_id,
  cmm.month_start as period_start,
  cmm.month_end as period_end,
  -- Total predictions (growing slightly over time + random variation)
  (cmm.base_predictions + (cmm.month_offset * 50) + (random() * 200 - 100))::int as total_predictions,
  -- Correct predictions - accuracy improves from 60% to 87%
  ((cmm.base_predictions + (cmm.month_offset * 50) + (random() * 200 - 100)) * 
    (0.60 + (cmm.month_offset * 0.045) + (random() * 0.03)))::int as correct_predictions,
  -- Accuracy percent (60% → 87% improvement over 6 months)
  (60 + (cmm.month_offset * 4.5) + (random() * 3))::numeric(5,2) as accuracy_percent,
  -- Month-over-month accuracy change
  CASE 
    WHEN cmm.month_offset = 0 THEN 0.00
    ELSE (4.5 + (random() * 2 - 1))::numeric(5,2)
  END as accuracy_change_percent,
  -- Baseline accuracy without Nova IQ (lower improvement)
  (58 + (cmm.month_offset * 3.2) + (random() * 2))::numeric(5,2) as baseline_accuracy_percent,
  -- Nova IQ enhanced predictions (78% of total predictions)
  ((cmm.base_predictions + (cmm.month_offset * 50)) * 0.78)::int as nova_iq_enhanced_predictions,
  -- Nova IQ accuracy lift (8% → 13% improvement)
  (8 + (cmm.month_offset * 0.8) + (random() * 2))::numeric(5,2) as nova_iq_accuracy_lift_percent,
  -- Total interventions (12% of predictions)
  ((cmm.base_predictions + (cmm.month_offset * 50)) * 0.12)::int as total_interventions,
  -- Successful interventions (improving from 68% to 88%)
  ((cmm.base_predictions + (cmm.month_offset * 50)) * 0.12 * (0.68 + cmm.month_offset * 0.04))::int as successful_interventions,
  -- Success rate percent (68% → 88%)
  (68 + (cmm.month_offset * 4) + (random() * 3))::numeric(5,2) as success_rate_percent,
  -- Confidence score (improving from 72% to 93%)
  (72 + (cmm.month_offset * 3.5) + (random() * 2))::numeric(5,2) as confidence_score_avg,
  -- False positive rate (decreasing from 15% to 6%)
  (15 - (cmm.month_offset * 1.5) + (random() * 1))::numeric(5,2) as false_positive_rate,
  -- False negative rate (decreasing from 12% to 5%)
  (12 - (cmm.month_offset * 1.2) + (random() * 1))::numeric(5,2) as false_negative_rate,
  -- Created at (day after period ends)
  (cmm.month_end + interval '1 day') as created_at
FROM casino_monthly_metrics cmm
ORDER BY cmm.casino_id, cmm.month_offset;

-- Verify the data
DO $$
DECLARE
  record_count int;
  month_count int;
BEGIN
  SELECT COUNT(*) INTO record_count FROM ai_learning_metrics;
  SELECT COUNT(DISTINCT period_start) INTO month_count FROM ai_learning_metrics;
  
  RAISE NOTICE 'AI Learning Metrics: % records with % unique months', record_count, month_count;
END $$;

-- Update statistics
ANALYZE ai_learning_metrics;
