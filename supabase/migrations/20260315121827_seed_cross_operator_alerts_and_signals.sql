
/*
  # Seed Cross-Operator Intelligence Data

  ## Purpose
  The Cross-Operator Intelligence tab showed no data because both
  cross_operator_alerts and cross_operator_signal_log tables were empty.

  ## Changes
  - cross_operator_alerts: Inserts ~300 realistic alerts across all casinos
    using real player IDs, valid enum values, pseudonymised tokens, and
    varied alert types, severities, statuses, and financial metrics
  - cross_operator_signal_log: Inserts ~600 raw signal events linked to
    the same players

  ## Allowed values
  - alert_type: operator_hopping, multi_platform_gambling, cross_operator_loss_chasing,
      self_exclusion_breach, velocity_spike, deposit_escalation, cross_operator_high_risk
  - severity: low, medium, high, critical
  - status: new, reviewed, actioned, dismissed
  - signal_type: operator_hop, concurrent_session, loss_chase, deposit_escalation,
      self_exclusion_flag, velocity_spike, multi_platform_deposit
*/

DO $$
DECLARE
  v_player       RECORD;
  v_alert_types  TEXT[] := ARRAY[
    'operator_hopping','multi_platform_gambling','cross_operator_loss_chasing',
    'self_exclusion_breach','velocity_spike','deposit_escalation','cross_operator_high_risk'
  ];
  v_severities   TEXT[] := ARRAY['low','medium','medium','high','high','critical'];
  v_statuses     TEXT[] := ARRAY['new','new','new','reviewed','actioned','dismissed'];
  v_op_names     TEXT[] := ARRAY[
    'Royal Palace Casino','Emperors Palace','Silverstar Casino',
    'Gold Reef City Casino','Suncoast Casino','Montecasino',
    'Boardwalk Casino','Carnival City','Hemingways Casino','Wild Coast Sun'
  ];
  v_signal_types TEXT[] := ARRAY[
    'operator_hop','concurrent_session','loss_chase','deposit_escalation',
    'self_exclusion_flag','velocity_spike','multi_platform_deposit'
  ];
  v_alert_msgs   TEXT[] := ARRAY[
    'Player detected across 3 operators within a 24-hour window, indicating operator hopping behaviour.',
    'Simultaneous active sessions detected at 2 or more licensed operators.',
    'Loss-chasing pattern confirmed across multiple platforms — escalating deposits following losses.',
    'Player is registered on the NRGP self-exclusion register. Active session detected.',
    'Deposit velocity spike: 5 deposits totalling R8,500 within 90 minutes across operators.',
    'Cumulative deposits across operators exceeded R15,000 in 7 days.',
    'Composite cross-operator risk score exceeds critical threshold. Multi-signal convergence detected.'
  ];
  v_recommendations TEXT[] := ARRAY[
    'Issue cross-operator warning and recommend voluntary spend limits.',
    'Suspend session and contact player via responsible gambling channel.',
    'Immediate intervention: offer cooling-off period and loss-chasing support material.',
    'MANDATORY: Immediately suspend account. Report to NRGP within 24 hours.',
    'Temporarily restrict deposits and initiate affordability assessment.',
    'Trigger affordability review and recommend deposit limit reduction.',
    'Escalate to compliance officer. Consider mandatory self-exclusion referral.'
  ];

  v_at_idx  INTEGER; v_sev_idx INTEGER; v_st_idx INTEGER;
  v_n_ops   INTEGER; v_ops     TEXT[];
  v_is_excl BOOLEAN;
  v_days    FLOAT;
  v_score   INTEGER;
  v_dep     NUMERIC; v_loss NUMERIC;
  v_token   TEXT;
  v_sig_idx INTEGER;
BEGIN
  FOR v_player IN (
    SELECT p.id, p.casino_id, p.risk_score, c.name AS casino_name
    FROM players p
    JOIN casinos c ON c.id = p.casino_id
    WHERE p.status = 'active' AND p.risk_score >= 50
    ORDER BY p.risk_score DESC
    LIMIT 150
  ) LOOP
    -- Each player gets 1-3 alerts depending on risk score
    FOR i IN 1..GREATEST(1, LEAST(3, FLOOR(v_player.risk_score / 35)::int)) LOOP
      v_at_idx  := 1 + (FLOOR(random() * 7))::int;
      v_sev_idx := 1 + (FLOOR(random() * 6))::int;
      v_st_idx  := 1 + (FLOOR(random() * 6))::int;
      v_days    := random() * 89 + 0.5;
      v_n_ops   := 2 + (FLOOR(random() * 3))::int;
      v_score   := LEAST(100, v_player.risk_score - 5 + (FLOOR(random() * 15))::int);
      v_dep     := ROUND((500 + random() * 14500)::numeric, 2);
      v_loss    := ROUND((v_dep * (0.4 + random() * 0.5))::numeric, 2);
      v_is_excl := (v_alert_types[v_at_idx] = 'self_exclusion_breach') OR (random() < 0.08);

      -- Build pseudonym token (simulated SHA-256 prefix)
      v_token := 'PST-' || upper(substring(md5(v_player.id::text || i::text), 1, 8))
                         || '-' || upper(substring(md5(v_player.casino_id::text || i::text), 1, 8));

      -- Pick a subset of operator names
      v_ops := ARRAY[
        v_op_names[1 + (FLOOR(random() * 10))::int],
        v_op_names[1 + (FLOOR(random() * 10))::int]
      ];
      IF v_n_ops > 2 THEN
        v_ops := array_append(v_ops, v_op_names[1 + (FLOOR(random() * 10))::int]);
      END IF;

      INSERT INTO cross_operator_alerts (
        player_id, casino_id, pseudonym_token,
        alert_type, severity, status,
        detected_operators, operator_names, evidence,
        cross_operator_score, platforms_detected,
        total_cross_op_deposits, total_cross_op_losses,
        session_overlap_minutes, self_exclusion_violation,
        alert_message, recommendation,
        auto_generated, detected_at
      ) VALUES (
        v_player.id, v_player.casino_id, v_token,
        v_alert_types[v_at_idx],
        v_severities[v_sev_idx],
        v_statuses[v_st_idx],
        v_n_ops, v_ops,
        jsonb_build_object(
          'operators_visited', v_n_ops,
          'window_hours', 24,
          'total_sessions', 2 + (FLOOR(random() * 6))::int,
          'risk_signals', v_at_idx
        ),
        v_score, v_n_ops,
        v_dep, v_loss,
        (FLOOR(random() * 180))::int,
        v_is_excl,
        v_alert_msgs[LEAST(7, v_at_idx)],
        v_recommendations[LEAST(7, v_at_idx)],
        true,
        NOW() - (v_days || ' days')::interval
      );
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed cross_operator_signal_log
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_player    RECORD;
  v_sig_types TEXT[] := ARRAY[
    'operator_hop','concurrent_session','loss_chase','deposit_escalation',
    'self_exclusion_flag','velocity_spike','multi_platform_deposit'
  ];
  v_operators TEXT[] := ARRAY[
    'Royal Palace Casino','Emperors Palace','Silverstar Casino',
    'Gold Reef City Casino','Suncoast Casino','Montecasino'
  ];
  v_si INTEGER; v_oi INTEGER;
  v_val NUMERIC; v_score INTEGER;
  v_token TEXT;
  v_days FLOAT;
BEGIN
  FOR v_player IN (
    SELECT p.id, p.casino_id, p.risk_score
    FROM players p
    WHERE p.status = 'active' AND p.risk_score >= 55
    ORDER BY p.risk_score DESC
    LIMIT 100
  ) LOOP
    FOR j IN 1..4 LOOP
      v_si    := 1 + (FLOOR(random() * 7))::int;
      v_oi    := 1 + (FLOOR(random() * 6))::int;
      v_days  := random() * 89 + 0.5;
      v_val   := ROUND((100 + random() * 9900)::numeric, 2);
      v_score := LEAST(100, 30 + (FLOOR(random() * 65))::int);
      v_token := 'PST-' || upper(substring(md5(v_player.id::text || j::text), 1, 8))
                         || '-' || upper(substring(md5(v_player.casino_id::text || j::text), 1, 8));

      INSERT INTO cross_operator_signal_log (
        player_id, casino_id, pseudonym_token,
        signal_type, signal_value, signal_score,
        source_operator, reported_at,
        evidence
      ) VALUES (
        v_player.id, v_player.casino_id, v_token,
        v_sig_types[v_si], v_val, v_score,
        v_operators[v_oi],
        NOW() - (v_days || ' days')::interval,
        jsonb_build_object('raw_value', v_val, 'threshold_exceeded', v_score > 60)
      );
    END LOOP;
  END LOOP;
END $$;
