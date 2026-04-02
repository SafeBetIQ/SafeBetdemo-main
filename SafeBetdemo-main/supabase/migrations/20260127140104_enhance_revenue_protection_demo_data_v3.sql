/*
  # Enhance Revenue Protection Demo Data v3

  ## Overview
  Adds more comprehensive revenue protection events to ensure all casinos
  have visible demo data in their dashboards for the current month.

  ## Changes
  - Adds additional protection events for current month (January 2026)
  - Creates events directly from players (not just from interventions)
  - Ensures balanced distribution across all event types
  - Generates realistic financial impacts
*/

DO $$
DECLARE
  v_casino RECORD;
  v_player RECORD;
  v_event_date DATE;
  v_financial_impact NUMERIC;
  v_avg_player_value NUMERIC := 3500;
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_event_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Enhancing Revenue Protection Data ===';
  RAISE NOTICE 'Current month: %', v_current_month;
  
  -- Loop through each casino
  FOR v_casino IN (
    SELECT id, name FROM casinos WHERE is_active = true ORDER BY name
  )
  LOOP
    RAISE NOTICE 'Processing: %', v_casino.name;
    v_event_count := 0;
    
    -- Get players for this casino and create protection events
    FOR v_player IN (
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.risk_score,
        p.risk_level,
        p.total_wagered
      FROM players p
      WHERE p.casino_id = v_casino.id
      ORDER BY random()
      LIMIT 15
    )
    LOOP
      -- Event date in current month
      v_event_date := v_current_month + (random() * 25)::INTEGER;
      
      -- LTV SAVED EVENTS (40% of players)
      IF random() > 0.6 THEN
        v_financial_impact := v_avg_player_value * (4 + random() * 8) * (1 + (v_player.risk_score::NUMERIC / 100));
        
        INSERT INTO revenue_protection_events (
          casino_id,
          player_id,
          event_type,
          event_date,
          financial_impact_zar,
          calculation_method,
          calculation_details,
          player_risk_before,
          player_risk_after,
          confidence_score,
          notes
        ) VALUES (
          v_casino.id,
          v_player.id,
          'ltv_saved',
          v_event_date,
          v_financial_impact::NUMERIC(12,2),
          'Post-intervention active months × Avg monthly player value × Risk multiplier',
          jsonb_build_object(
            'months_active', (4 + random() * 8)::INTEGER,
            'avg_monthly_value', v_avg_player_value,
            'risk_multiplier', (1 + (v_player.risk_score::NUMERIC / 100)),
            'player_total_wagered', v_player.total_wagered
          ),
          v_player.risk_score,
          GREATEST(0, v_player.risk_score - (15 + random() * 25)::INTEGER),
          (75 + random() * 20)::NUMERIC(5,2),
          format('Player %s %s retained after AI intervention detected high-risk behavior',
            v_player.first_name, v_player.last_name)
        );
        v_event_count := v_event_count + 1;
      END IF;
      
      -- FRAUD PREVENTED (25% of players)
      IF random() > 0.75 THEN
        v_financial_impact := 15000 + (random() * 100000);
        
        INSERT INTO revenue_protection_events (
          casino_id,
          player_id,
          event_type,
          event_date,
          financial_impact_zar,
          calculation_method,
          calculation_details,
          player_risk_before,
          player_risk_after,
          confidence_score,
          notes
        ) VALUES (
          v_casino.id,
          v_player.id,
          'fraud_prevented',
          v_event_date + 1,
          v_financial_impact::NUMERIC(12,2),
          'Suspicious activity value − Actual financial loss',
          jsonb_build_object(
            'suspicious_activity_value', (v_financial_impact * 1.15)::NUMERIC(12,2),
            'actual_loss_prevented', v_financial_impact::NUMERIC(12,2),
            'fraud_type', CASE (random() * 3)::INTEGER
              WHEN 0 THEN 'collusion_detected'
              WHEN 1 THEN 'bonus_abuse'
              ELSE 'suspicious_pattern'
            END
          ),
          GREATEST(v_player.risk_score, 80 + (random() * 15)::INTEGER),
          v_player.risk_score,
          (85 + random() * 12)::NUMERIC(5,2),
          'AI detected suspicious betting patterns and prevented potential fraud'
        );
        v_event_count := v_event_count + 1;
      END IF;
      
      -- CHARGEBACK AVOIDED (30% of players)
      IF random() > 0.7 THEN
        v_financial_impact := 8000 + (random() * 25000);
        
        INSERT INTO revenue_protection_events (
          casino_id,
          player_id,
          event_type,
          event_date,
          financial_impact_zar,
          calculation_method,
          calculation_details,
          player_risk_before,
          player_risk_after,
          confidence_score,
          notes
        ) VALUES (
          v_casino.id,
          v_player.id,
          'chargeback_avoided',
          v_event_date + 2,
          v_financial_impact::NUMERIC(12,2),
          '(Historical rate − Current rate) × Avg dispute value',
          jsonb_build_object(
            'historical_dispute_rate', 0.12,
            'current_dispute_rate', 0.04,
            'avg_dispute_value', v_financial_impact::NUMERIC(12,2)
          ),
          v_player.risk_score + (10 + random() * 20)::INTEGER,
          v_player.risk_score,
          (70 + random() * 20)::NUMERIC(5,2),
          'Early intervention prevented player frustration and potential dispute'
        );
        v_event_count := v_event_count + 1;
      END IF;
      
      -- VIP RETENTION (only for high-value players)
      IF v_player.total_wagered > 500000 AND random() > 0.5 THEN
        v_financial_impact := v_avg_player_value * (8 + random() * 15) * (2 + random() * 3);
        
        INSERT INTO revenue_protection_events (
          casino_id,
          player_id,
          event_type,
          event_date,
          financial_impact_zar,
          calculation_method,
          calculation_details,
          player_risk_before,
          player_risk_after,
          confidence_score,
          notes
        ) VALUES (
          v_casino.id,
          v_player.id,
          'vip_retained',
          v_event_date + 3,
          v_financial_impact::NUMERIC(12,2),
          'Recovered VIPs × Avg VIP monthly revenue × Retention duration',
          jsonb_build_object(
            'vip_multiplier', (2 + random() * 3)::NUMERIC(5,2),
            'retention_months', (8 + random() * 15)::INTEGER,
            'total_wagered', v_player.total_wagered,
            'player_tier', 'VIP'
          ),
          v_player.risk_score,
          GREATEST(0, v_player.risk_score - (20 + random() * 30)::INTEGER),
          (85 + random() * 12)::NUMERIC(5,2),
          format('High-value VIP player %s %s retained through personalized AI intervention',
            v_player.first_name, v_player.last_name)
        );
        v_event_count := v_event_count + 1;
      END IF;
      
      -- DROPOUT PREVENTED (for high-risk players)
      IF v_player.risk_score >= 70 AND random() > 0.6 THEN
        v_financial_impact := v_avg_player_value * (3 + random() * 5) * 1.5;
        
        INSERT INTO revenue_protection_events (
          casino_id,
          player_id,
          event_type,
          event_date,
          financial_impact_zar,
          calculation_method,
          calculation_details,
          player_risk_before,
          player_risk_after,
          confidence_score,
          notes
        ) VALUES (
          v_casino.id,
          v_player.id,
          'dropout_prevented',
          v_event_date + 4,
          v_financial_impact::NUMERIC(12,2),
          'Reduction in dropout % × Avg player value × Affected players',
          jsonb_build_object(
            'dropout_risk_reduction', (random() * 30 + 40)::NUMERIC(5,1),
            'historical_dropout_rate', 0.85,
            'new_dropout_rate', 0.30,
            'intervention_effectiveness', 'high'
          ),
          v_player.risk_score,
          GREATEST(0, v_player.risk_score - (25 + random() * 35)::INTEGER),
          (80 + random() * 15)::NUMERIC(5,2),
          'Player would have quit after extreme loss but AI intervention prevented dropout'
        );
        v_event_count := v_event_count + 1;
      END IF;
    END LOOP;
    
    RAISE NOTICE '  - Added % protection events for % (current month)', v_event_count, v_casino.name;
  END LOOP;
  
  -- Update ROI for all monthly records
  UPDATE revenue_protection_monthly
  SET roi_multiple = calculate_rpi_roi(casino_id, month)
  WHERE month = v_current_month;
  
  RAISE NOTICE '=== Enhancement Complete ===';
  RAISE NOTICE 'Total current month events: %', (
    SELECT COUNT(*) 
    FROM revenue_protection_events 
    WHERE DATE_TRUNC('month', event_date) = v_current_month
  );
  RAISE NOTICE 'Current month total protected: R%', (
    SELECT COALESCE(SUM(financial_impact_zar), 0)::NUMERIC(12,2)
    FROM revenue_protection_events 
    WHERE DATE_TRUNC('month', event_date) = v_current_month
  );
  
END $$;
