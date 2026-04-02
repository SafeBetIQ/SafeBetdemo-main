/*
  # Seed King IV Compliance Demo Data
  
  Creates sample compliance status data for demonstration purposes.
  Populates king_iv_compliance_status table with realistic assessments
  for all 17 King IV principles across demo casinos.
*/

-- Create demo compliance status for each casino and principle
DO $$
DECLARE
  casino_rec RECORD;
  principle_rec RECORD;
  compliance_levels TEXT[] := ARRAY['applied', 'partially_applied', 'applied', 'applied'];
  random_level TEXT;
  random_score INTEGER;
BEGIN
  -- For each casino
  FOR casino_rec IN SELECT id FROM casinos LIMIT 5 LOOP
    -- For each King IV principle
    FOR principle_rec IN SELECT * FROM king_iv_principles ORDER BY principle_number LOOP
      -- Random compliance level (weighted toward 'applied')
      random_level := compliance_levels[1 + floor(random() * 4)];
      
      -- Generate score based on compliance level
      IF random_level = 'applied' THEN
        random_score := 85 + floor(random() * 15); -- 85-100
      ELSIF random_level = 'partially_applied' THEN
        random_score := 65 + floor(random() * 20); -- 65-85
      ELSE
        random_score := 50 + floor(random() * 15); -- 50-65
      END IF;
      
      -- Insert compliance status
      INSERT INTO king_iv_compliance_status (
        casino_id,
        king_iv_principle_id,
        assessment_date,
        compliance_level,
        compliance_score,
        explanation,
        improvement_areas,
        recommended_actions,
        next_review_date
      )
      VALUES (
        casino_rec.id,
        principle_rec.id,
        CURRENT_DATE,
        random_level,
        random_score,
        CASE principle_rec.principle_number
          WHEN 1 THEN 'SafeBet IQ provides independent oversight that demonstrates ethical leadership through transparent, read-only monitoring.'
          WHEN 2 THEN 'Ethics are embedded in our AI-driven risk detection system with detailed audit trails.'
          WHEN 3 THEN 'Responsible corporate citizenship evidenced through automated NRGP contribution tracking.'
          WHEN 4 THEN 'Risk and performance integrated through real-time behavioral analysis.'
          WHEN 5 THEN 'Comprehensive ESG reporting with transparent, time-stamped evidence.'
          WHEN 6 THEN 'Board oversight enabled through dashboards with clear compliance visibility.'
          WHEN 7 THEN 'Platform supports diverse stakeholder needs with role-specific dashboards.'
          WHEN 8 THEN 'Clear delegation framework with separation of operational and monitoring duties.'
          WHEN 9 THEN 'Performance evaluations supported through trend analysis and KPI tracking.'
          WHEN 10 THEN 'Independent audit supported through complete trails and transparent AI processes.'
          WHEN 11 THEN 'Risk management enhanced through AI-driven behavioral pattern detection.'
          WHEN 12 THEN 'Technology governance embedded with cybersecurity and POPIA compliance.'
          WHEN 13 THEN 'Compliance integral to platform with automated regulatory tracking.'
          WHEN 14 THEN 'Remuneration fairness supported through training and competency programs.'
          WHEN 15 THEN 'Combined assurance through independent read-only monitoring.'
          WHEN 16 THEN 'Stakeholder relationships managed through transparent engagement.'
          WHEN 17 THEN 'Performance measured through comprehensive ESG metrics.'
          ELSE 'Compliance demonstrated through platform capabilities.'
        END,
        CASE 
          WHEN random_level = 'applied' THEN ARRAY[]::TEXT[]
          WHEN random_level = 'partially_applied' THEN ARRAY['Enhanced documentation', 'Quarterly reviews']
          ELSE ARRAY['Establish formal processes', 'Set review schedule']
        END,
        CASE 
          WHEN random_level = 'applied' THEN ARRAY['Maintain practices', 'Continue monitoring']
          WHEN random_level = 'partially_applied' THEN ARRAY['Strengthen documentation', 'Increase frequency']
          ELSE ARRAY['Develop plan', 'Allocate resources']
        END,
        CURRENT_DATE + INTERVAL '90 days'
      )
      ON CONFLICT (casino_id, king_iv_principle_id, assessment_date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Create sample ESG scores for demo casinos
DO $$
DECLARE
  casino_rec RECORD;
  env_score DECIMAL;
  soc_score DECIMAL;
  gov_score DECIMAL;
  comp_score DECIMAL;
BEGIN
  FOR casino_rec IN SELECT id FROM casinos LIMIT 5 LOOP
    -- Generate realistic scores
    env_score := 60 + (random() * 30); -- 60-90
    soc_score := 75 + (random() * 20); -- 75-95
    gov_score := 80 + (random() * 15); -- 80-95
    
    -- Calculate composite (15% E, 55% S, 30% G)
    comp_score := (env_score * 0.15) + (soc_score * 0.55) + (gov_score * 0.30);
    
    INSERT INTO esg_scores (
      casino_id,
      scoring_period_start,
      scoring_period_end,
      composite_score,
      environmental_score,
      social_score,
      governance_score,
      environmental_weighted,
      social_weighted,
      governance_weighted,
      ethical_culture_score,
      good_performance_score,
      effective_control_score,
      legitimacy_score,
      trend_direction,
      calculation_method,
      data_sources,
      scoring_confidence
    )
    VALUES (
      casino_rec.id,
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE,
      comp_score,
      env_score,
      soc_score,
      gov_score,
      env_score * 0.15,
      soc_score * 0.55,
      gov_score * 0.30,
      75 + (random() * 20),
      80 + (random() * 15),
      85 + (random() * 12),
      78 + (random() * 18),
      CASE 
        WHEN random() < 0.7 THEN 'improving'
        WHEN random() < 0.9 THEN 'stable'
        ELSE 'new'
      END,
      'automated',
      '["esg_metrics", "player_protection_interventions", "employee_rg_training"]'::jsonb,
      'high'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
