/*
  # Seed 450 Demo Players with Revenue Protection Events

  Generates realistic demo data for all casinos
*/

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'vip_tier') THEN
    ALTER TABLE players ADD COLUMN vip_tier text DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'lifetime_value') THEN
    ALTER TABLE players ADD COLUMN lifetime_value numeric(12, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'total_deposits') THEN
    ALTER TABLE players ADD COLUMN total_deposits numeric(12, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'total_withdrawals') THEN
    ALTER TABLE players ADD COLUMN total_withdrawals numeric(12, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'status') THEN
    ALTER TABLE players ADD COLUMN status text DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'signup_date') THEN
    ALTER TABLE players ADD COLUMN signup_date timestamptz DEFAULT now();
  END IF;
END $$;

-- Seed function
DO $$
DECLARE
  c_id uuid;
  c_idx integer := 1;
  new_pid uuid;
  i integer;
  risk_score numeric;
  ltv numeric;
BEGIN
  -- Delete existing demo players
  DELETE FROM revenue_protection_events WHERE player_id IN (SELECT id FROM players WHERE player_id LIKE 'SBQ-CA%');
  DELETE FROM players WHERE player_id LIKE 'SBQ-CA%';

  -- Loop through casinos
  FOR c_id IN SELECT id FROM casinos ORDER BY id LIMIT 3 LOOP
    -- Create 150 players per casino
    FOR i IN 1..150 LOOP
      ltv := (random() * 700000 + 10000)::numeric(12, 2);
      risk_score := (random() * 85 + 10)::numeric(5, 1);

      INSERT INTO players (
        casino_id, player_id, first_name, last_name, email, phone,
        risk_score, risk_level, vip_tier, lifetime_value,
        total_deposits, total_withdrawals, total_wagered, total_won,
        status, is_active, last_active, created_at
      ) VALUES (
        c_id,
        'SBQ-CA' || c_idx || '-' || LPAD(i::text, 5, '0'),
        'Player', 'Demo-' || i,
        'demo' || c_idx || '_' || i || '@safebetiq.com',
        '+27 82 ' || LPAD((random() * 9999999)::integer::text, 7, '0'),
        risk_score,
        CASE WHEN risk_score >= 80 THEN 'critical' WHEN risk_score >= 60 THEN 'high' WHEN risk_score >= 40 THEN 'medium' ELSE 'low' END,
        CASE WHEN ltv >= 500000 THEN 'platinum' WHEN ltv >= 200000 THEN 'gold' WHEN ltv >= 80000 THEN 'silver' WHEN ltv >= 30000 THEN 'bronze' ELSE 'none' END,
        ltv,
        (ltv * 1.3)::numeric(12, 2),
        (ltv * 0.1)::numeric(12, 2),
        (ltv * 9)::numeric(12, 2),
        (ltv * 7.5)::numeric(12, 2),
        CASE WHEN random() < 0.85 THEN 'active' ELSE 'flagged' END,
        true,
        now() - (random() * 7 || ' days')::interval,
        now() - (random() * 180 || ' days')::interval
      )
      RETURNING id INTO new_pid;

      -- Add revenue protection event for higher risk players
      IF risk_score >= 50 AND random() > 0.4 THEN
        INSERT INTO revenue_protection_events (
          casino_id, player_id, event_type, event_date,
          financial_impact_zar, calculation_method,
          player_risk_before, player_risk_after,
          confidence_score, notes, created_at
        ) VALUES (
          c_id, new_pid,
          CASE (random() * 4)::integer
            WHEN 0 THEN 'ltv_saved'
            WHEN 1 THEN 'vip_retained'
            WHEN 2 THEN 'dropout_prevented'
            ELSE 'fraud_prevented'
          END,
          CURRENT_DATE - (random() * 60)::integer,
          (ltv * (0.12 + random() * 0.25))::numeric(12, 2),
          'AI intervention prevented revenue loss',
          risk_score::integer,
          (risk_score * (0.65 + random() * 0.15))::integer,
          (70 + random() * 25)::numeric(5, 2),
          'Intervention successful',
          now() - (random() * 60 || ' days')::interval
        );
      END IF;
    END LOOP;

    c_idx := c_idx + 1;
  END LOOP;

  RAISE NOTICE '450 demo players seeded successfully';
END $$;
