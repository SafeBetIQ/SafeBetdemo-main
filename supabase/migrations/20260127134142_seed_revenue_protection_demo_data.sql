/*
  # Seed Revenue Protection Intelligence Demo Data

  ## Overview
  Generates realistic revenue protection events for all casinos based on:
  - Existing AI intervention outcomes
  - Player risk profiles
  - Calculated financial impacts

  ## Data Generated
  - 150+ revenue protection events across 3 casinos
  - 3 months of historical data
  - All 5 protection event types
  - Realistic ZAR values based on South African casino economics
*/

DO $$
DECLARE
  v_casino RECORD;
  v_player RECORD;
  v_intervention RECORD;
  v_event_type TEXT;
  v_financial_impact NUMERIC;
  v_avg_player_value NUMERIC;
  v_vip_multiplier NUMERIC;
  v_months_active INTEGER;
  v_event_date DATE;
  v_confidence NUMERIC;
BEGIN
  -- Set average player monthly values (South African Rand)
  v_avg_player_value := 3500; -- R3,500 average monthly player value
  
  -- Loop through each casino
  FOR v_casino IN (
    SELECT id, name FROM casinos ORDER BY name
  )
  LOOP
    RAISE NOTICE 'Generating RPI data for: %', v_casino.name;
    
    -- Generate events for successful interventions (risk_reduced outcomes)
    FOR v_intervention IN (
      SELECT 
        aio.player_id,
        aio.casino_id,
        aio.recommendation_id,
        aio.intervention_type,
        aio.pre_risk_score,
        aio.post_risk_score_30d,
        aio.effectiveness_score,
        aio.nova_iq_influenced,
        aio.applied_at,
        p.risk_level,
        p.total_wagered
      FROM ai_intervention_outcomes aio
      JOIN players p ON p.id = aio.player_id
      WHERE aio.casino_id = v_casino.id
        AND aio.outcome = 'risk_reduced'
      ORDER BY aio.applied_at
    )
    LOOP
      -- Calculate event date (within last 90 days)
      v_event_date := CURRENT_DATE - (random() * 90)::INTEGER;
      
      -- LTV SAVED EVENTS (70% of risk_reduced cases)
      IF random() > 0.3 THEN
        -- Calculate months player stayed active beyond predicted dropout
        v_months_active := CASE 
          WHEN v_intervention.pre_risk_score >= 80 THEN 6 + (random() * 6)::INTEGER
          WHEN v_intervention.pre_risk_score >= 60 THEN 4 + (random() * 4)::INTEGER
          ELSE 3 + (random() * 3)::INTEGER
        END;
        
        -- Higher value for high-risk players saved
        v_financial_impact := v_avg_player_value * v_months_active * 
          (1 + (v_intervention.pre_risk_score::NUMERIC / 100));
        
        INSERT INTO revenue_protection_events (
          casino_id,
          player_id,
          event_type,
          event_date,
          financial_impact_zar,
          intervention_id,
          calculation_method,
          calculation_details,
          player_risk_before,
          player_risk_after,
          confidence_score,
          notes
        ) VALUES (
          v_intervention.casino_id,
          v_intervention.player_id,
          'ltv_saved',
          v_event_date,
          ROUND(v_financial_impact, 2),
          v_intervention.recommendation_id,
          'Post-intervention active months × Avg monthly player value × Risk multiplier',
          jsonb_build_object(
            'months_active', v_months_active,
            'avg_monthly_value', v_avg_player_value,
            'risk_multiplier', (1 + (v_intervention.pre_risk_score::NUMERIC / 100)),
            'intervention_type', v_intervention.intervention_type
          ),
          v_intervention.pre_risk_score,
          v_intervention.post_risk_score_30d,
          v_intervention.effectiveness_score,
          'Player retained beyond predicted dropout window after ' || v_intervention.intervention_type || ' intervention'
        );
      END IF;
      
      -- DROPOUT PREVENTION EVENTS (50% of high-risk cases)
      IF v_intervention.pre_risk_score >= 70 AND random() > 0.5 THEN
        v_financial_impact := v_avg_player_value * (3 + random() * 4) * 1.5;
        
        INSERT INTO revenue_protection_events (
          casino_id,
          player_id,
          event_type,
          event_date,
          financial_impact_zar,
          intervention_id,
          calculation_method,
          calculation_details,
          player_risk_before,
          player_risk_after,
          confidence_score,
          notes
        ) VALUES (
          v_intervention.casino_id,
          v_intervention.player_id,
          'dropout_prevented',
          v_event_date + (random() * 10)::INTEGER,
          ROUND(v_financial_impact, 2),
          v_intervention.recommendation_id,
          'Reduction in dropout % × Avg player value × Affected players',
          jsonb_build_object(
            'dropout_risk_reduction', ROUND((v_intervention.pre_risk_score - v_intervention.post_risk_score_30d)::NUMERIC, 1),
            'historical_dropout_rate', 0.85,
            'new_dropout_rate', 0.25
          ),
          v_intervention.pre_risk_score,
          v_intervention.post_risk_score_30d,
          v_intervention.effectiveness_score,
          'Player would have quit after extreme loss but intervention prevented dropout'
        );
      END IF;
    END LOOP;
    
    -- Generate VIP RETENTION events (5-8 per casino)
    FOR i IN 1..(5 + (random() * 3)::INTEGER)
    LOOP
      SELECT p.id, p.casino_id, p.risk_score, p.total_wagered INTO v_player
      FROM players p
      WHERE p.casino_id = v_casino.id
        AND p.total_wagered > 500000 -- VIP threshold
      ORDER BY random()
      LIMIT 1;
      
      IF v_player.id IS NOT NULL THEN
        v_vip_multiplier := 5 + (random() * 10); -- VIPs worth 5-15x average
        v_months_active := 6 + (random() * 12)::INTEGER;
        v_financial_impact := v_avg_player_value * v_vip_multiplier * v_months_active;
        v_event_date := CURRENT_DATE - (random() * 60)::INTEGER;
        
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
          v_player.casino_id,
          v_player.id,
          'vip_retained',
          v_event_date,
          ROUND(v_financial_impact, 2),
          'Recovered VIPs × Avg VIP monthly revenue × Retention duration',
          jsonb_build_object(
            'vip_multiplier', v_vip_multiplier,
            'retention_months', v_months_active,
            'total_wagered', v_player.total_wagered
          ),
          v_player.risk_score,
          v_player.risk_score - (15 + (random() * 20)::INTEGER),
          80 + (random() * 15),
          'High-value player retained through personalized intervention'
        );
      END IF;
    END LOOP;
    
    -- Generate FRAUD PREVENTION events (3-5 per casino)
    FOR i IN 1..(3 + (random() * 2)::INTEGER)
    LOOP
      SELECT p.id, p.casino_id, p.risk_score INTO v_player
      FROM players p
      WHERE p.casino_id = v_casino.id
      ORDER BY random()
      LIMIT 1;
      
      IF v_player.id IS NOT NULL THEN
        v_financial_impact := 15000 + (random() * 85000); -- R15k - R100k per fraud case
        v_event_date := CURRENT_DATE - (random() * 75)::INTEGER;
        
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
          v_player.casino_id,
          v_player.id,
          'fraud_prevented',
          v_event_date,
          ROUND(v_financial_impact, 2),
          'Suspicious activity value − Actual financial loss',
          jsonb_build_object(
            'suspicious_activity_value', ROUND(v_financial_impact * 1.2, 2),
            'actual_loss', ROUND(v_financial_impact * 0.05, 2),
            'fraud_type', CASE (random() * 3)::INTEGER
              WHEN 0 THEN 'collusion_detected'
              WHEN 1 THEN 'bonus_abuse'
              ELSE 'identity_fraud'
            END
          ),
          85 + (random() * 12)::INTEGER,
          35 + (random() * 15)::INTEGER,
          90 + (random() * 8),
          'AI detected suspicious pattern; staff investigation prevented major loss'
        );
      END IF;
    END LOOP;
    
    -- Generate CHARGEBACK AVOIDED events (4-7 per casino)
    FOR i IN 1..(4 + (random() * 3)::INTEGER)
    LOOP
      SELECT p.id, p.casino_id, p.risk_score INTO v_player
      FROM players p
      WHERE p.casino_id = v_casino.id
      ORDER BY random()
      LIMIT 1;
      
      IF v_player.id IS NOT NULL THEN
        v_financial_impact := 8000 + (random() * 22000); -- R8k - R30k per chargeback
        v_event_date := CURRENT_DATE - (random() * 80)::INTEGER;
        
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
          v_player.casino_id,
          v_player.id,
          'chargeback_avoided',
          v_event_date,
          ROUND(v_financial_impact, 2),
          '(Historical rate − Current rate) × Avg dispute value × Player count',
          jsonb_build_object(
            'historical_dispute_rate', 0.12,
            'current_dispute_rate', 0.04,
            'avg_dispute_value', ROUND(v_financial_impact, 2),
            'intervention_reduced_frustration', true
          ),
          v_player.risk_score + (10 + (random() * 15)::INTEGER),
          v_player.risk_score,
          75 + (random() * 15),
          'Early intervention prevented player frustration and potential dispute'
        );
      END IF;
    END LOOP;
    
  END LOOP;
  
  -- Calculate and update ROI for all monthly records
  UPDATE revenue_protection_monthly
  SET roi_multiple = calculate_rpi_roi(casino_id, month);
  
  RAISE NOTICE '=== Revenue Protection Intelligence Data Generated ===';
  RAISE NOTICE 'Total events: %', (SELECT COUNT(*) FROM revenue_protection_events);
  RAISE NOTICE 'Total value protected: R%', (SELECT SUM(financial_impact_zar) FROM revenue_protection_events);
  
END $$;
