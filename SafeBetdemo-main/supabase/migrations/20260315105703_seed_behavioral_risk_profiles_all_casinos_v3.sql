
/*
  # Seed Behavioral Risk Profiles for All 18 Casinos (v3)

  ## Summary
  Creates behavioral risk profiles for players across all 18 casinos.
  risk_level uses the correct enum values: low, moderate, high, critical.
  Maps players' 'medium' risk_level to 'moderate' for behavioral_risk_profiles.
*/

DELETE FROM behavioral_risk_profiles
WHERE casino_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

INSERT INTO behavioral_risk_profiles (
  id, player_id, session_id, casino_id,
  risk_score, risk_level,
  impulse_level, betting_velocity, session_duration_minutes,
  reaction_time_ms, fatigue_index, personality_shift_score,
  emotional_state, advised_break, intervention_triggered, intervention_accepted,
  analyzed_at, created_at, updated_at, session_duration_score
)
SELECT
  gen_random_uuid(),
  p.id,
  gs.id,
  p.casino_id,
  p.risk_score,
  CASE p.risk_level WHEN 'medium' THEN 'moderate' ELSE p.risk_level END,
  CASE p.risk_level
    WHEN 'critical' THEN (0.75 + (p.rn % 25)::numeric / 100)
    WHEN 'high'     THEN (0.50 + (p.rn % 30)::numeric / 100)
    WHEN 'medium'   THEN (0.25 + (p.rn % 30)::numeric / 100)
    ELSE                 (0.05 + (p.rn % 20)::numeric / 100)
  END,
  CASE p.risk_level
    WHEN 'critical' THEN (3.5 + (p.rn % 30)::numeric / 10)
    WHEN 'high'     THEN (2.0 + (p.rn % 20)::numeric / 10)
    WHEN 'medium'   THEN (1.0 + (p.rn % 15)::numeric / 10)
    ELSE                 (0.3 + (p.rn % 10)::numeric / 10)
  END,
  gs.duration / 60,
  300 + (p.rn % 800),
  CASE p.risk_level
    WHEN 'critical' THEN (0.6 + (p.rn % 35)::numeric / 100)
    WHEN 'high'     THEN (0.4 + (p.rn % 30)::numeric / 100)
    WHEN 'medium'   THEN (0.2 + (p.rn % 25)::numeric / 100)
    ELSE                 (0.05 + (p.rn % 15)::numeric / 100)
  END,
  CASE p.risk_level
    WHEN 'critical' THEN (0.5 + (p.rn % 40)::numeric / 100)
    WHEN 'high'     THEN (0.3 + (p.rn % 30)::numeric / 100)
    WHEN 'medium'   THEN (0.1 + (p.rn % 25)::numeric / 100)
    ELSE                 (0.02 + (p.rn % 10)::numeric / 100)
  END,
  (ARRAY['calm','focused','anxious','frustrated','euphoric','distressed'])[
    1 + CASE p.risk_level
      WHEN 'critical' THEN LEAST(5, 3 + (p.rn % 3))
      WHEN 'high'     THEN LEAST(5, 1 + (p.rn % 4))
      WHEN 'medium'   THEN (p.rn % 3)
      ELSE (p.rn % 2)
    END
  ],
  p.risk_level IN ('high', 'critical'),
  p.risk_level = 'critical' OR (p.risk_level = 'high' AND p.rn % 3 = 0),
  p.risk_level = 'critical' AND p.rn % 2 = 0,
  gs.start_time + ((gs.duration / 2) || ' seconds')::interval,
  gs.created_at,
  now(),
  LEAST(100, (gs.duration / 60) * 2)
FROM (
  SELECT sub.id, sub.casino_id, sub.risk_score, sub.risk_level, sub.rn
  FROM (
    SELECT p2.id, p2.casino_id, p2.risk_score, p2.risk_level,
           row_number() OVER (PARTITION BY p2.casino_id ORDER BY p2.risk_score DESC, p2.id) AS rn
    FROM players p2
    WHERE p2.risk_level IN ('critical','high','medium')
  ) sub
  WHERE sub.rn <= 600
  UNION ALL
  SELECT sub2.id, sub2.casino_id, sub2.risk_score, sub2.risk_level, sub2.rn
  FROM (
    SELECT p3.id, p3.casino_id, p3.risk_score, p3.risk_level,
           row_number() OVER (PARTITION BY p3.casino_id ORDER BY p3.id) AS rn
    FROM players p3
    WHERE p3.risk_level = 'low'
  ) sub2
  WHERE sub2.rn % 20 = 1
    AND sub2.rn <= 200
) p
JOIN LATERAL (
  SELECT gs2.id, gs2.start_time, gs2.duration, gs2.created_at
  FROM gaming_sessions gs2
  WHERE gs2.player_id = p.id
  ORDER BY gs2.start_time DESC
  LIMIT 1
) gs ON true
ON CONFLICT DO NOTHING;
