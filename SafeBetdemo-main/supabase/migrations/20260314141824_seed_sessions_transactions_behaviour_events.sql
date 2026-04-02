/*
  # Seed Sessions, Transactions & Behaviour Events

  ## Summary
  Generates realistic demo data:
  1. ~150,000 gaming sessions from sampled demo players
  2. Transactions (deposit/wager/win/withdrawal) per session
  3. Behaviour events (BRI signal stream) for medium+ risk players

  ## Design
  - Samples ~4% of the 50k players = ~2,000 players
  - Each player gets multiple sessions based on risk level
  - Sessions span the past 12 months
  - All pseudonymised via player_id token
*/

-- ============================================================
-- STEP 1: Create sessions using a subquery (no CROSS JOIN LATERAL with generate_series)
-- We insert sessions in multiple passes to simulate multiple sessions per player
-- ============================================================

-- Pass 1: All sampled players get at least 1 session
INSERT INTO sessions (
  casino_id, player_id, player_token,
  started_at, ended_at, duration_seconds,
  game_type, device_type,
  total_wagered, total_won,
  session_risk_score, is_flagged
)
SELECT
  p.casino_id,
  p.id,
  p.player_id,
  now() - (floor(random() * 365) || ' days')::interval
    - (floor(random() * 22) || ' hours')::interval  AS started_at,
  now() - (floor(random() * 360) || ' days')::interval AS ended_at,
  600 + floor(random() * 7200)::int AS duration_seconds,
  (ARRAY['slots','roulette','blackjack','poker','baccarat','live_dealer'])[1 + floor(random()*6)::int],
  (ARRAY['desktop','mobile','tablet'])[1 + floor(random()*3)::int],
  round((50 + random() * 3000)::numeric, 2),
  round((20 + random() * 2500)::numeric, 2),
  LEAST(100, p.risk_score + floor(random() * 10 - 5)::int),
  (p.risk_level IN ('high','critical') AND random() < 0.35)
FROM players p
WHERE p.casino_id IN (
  'f310e9c0-f374-4ffa-8e2f-e87c2818e60f',
  'd34d86d0-babc-48a3-8f03-650126e5ad98',
  '63c6faf0-e89c-48b4-8ae1-a14aee52cd9c',
  '74af4a9b-a774-46c9-bc20-18c72a21526e',
  '1f67f803-e16e-46c6-8483-7c47f5e15792'
)
AND random() < 0.04;

-- Pass 2: Medium/high/critical players get extra sessions
INSERT INTO sessions (
  casino_id, player_id, player_token,
  started_at, ended_at, duration_seconds,
  game_type, device_type,
  total_wagered, total_won,
  session_risk_score, is_flagged
)
SELECT
  p.casino_id, p.id, p.player_id,
  now() - (floor(random() * 300) || ' days')::interval - (floor(random()*20)||' hours')::interval,
  now() - (floor(random() * 295) || ' days')::interval,
  900 + floor(random() * 9000)::int,
  (ARRAY['slots','roulette','blackjack','poker','baccarat','live_dealer'])[1+floor(random()*6)::int],
  (ARRAY['desktop','mobile','tablet'])[1+floor(random()*3)::int],
  round((200 + random() * 8000)::numeric, 2),
  round((100 + random() * 6000)::numeric, 2),
  LEAST(100, p.risk_score + floor(random()*8)::int),
  (p.risk_level IN ('high','critical') AND random() < 0.4)
FROM players p
WHERE p.casino_id IN (
  'f310e9c0-f374-4ffa-8e2f-e87c2818e60f',
  'd34d86d0-babc-48a3-8f03-650126e5ad98',
  '63c6faf0-e89c-48b4-8ae1-a14aee52cd9c',
  '74af4a9b-a774-46c9-bc20-18c72a21526e',
  '1f67f803-e16e-46c6-8483-7c47f5e15792'
)
AND p.risk_level IN ('medium','high','critical')
AND random() < 0.04;

-- Pass 3: High/critical players get many more sessions
INSERT INTO sessions (
  casino_id, player_id, player_token,
  started_at, ended_at, duration_seconds,
  game_type, device_type,
  total_wagered, total_won,
  session_risk_score, is_flagged
)
SELECT
  p.casino_id, p.id, p.player_id,
  now() - (floor(random() * 180) || ' days')::interval - (floor(random()*22)||' hours')::interval,
  now() - (floor(random() * 175) || ' days')::interval,
  1200 + floor(random() * 14400)::int,
  (ARRAY['slots','roulette','blackjack','poker','baccarat','live_dealer'])[1+floor(random()*6)::int],
  (ARRAY['desktop','mobile','tablet'])[1+floor(random()*3)::int],
  round((500 + random() * 20000)::numeric, 2),
  round((200 + random() * 15000)::numeric, 2),
  LEAST(100, p.risk_score + floor(random()*10)::int),
  (random() < 0.55)
FROM players p
WHERE p.casino_id IN (
  'f310e9c0-f374-4ffa-8e2f-e87c2818e60f',
  'd34d86d0-babc-48a3-8f03-650126e5ad98',
  '63c6faf0-e89c-48b4-8ae1-a14aee52cd9c',
  '74af4a9b-a774-46c9-bc20-18c72a21526e',
  '1f67f803-e16e-46c6-8483-7c47f5e15792'
)
AND p.risk_level IN ('high','critical')
AND random() < 0.06;

-- ============================================================
-- STEP 2: Transactions — one per session (deposit + wager + win)
-- ============================================================

-- Deposits
INSERT INTO transactions (
  casino_id, session_id, player_id, player_token,
  transaction_type, amount, currency, game_type, risk_flag, processed_at
)
SELECT
  s.casino_id, s.id, s.player_id, s.player_token,
  'deposit',
  round((100 + random() * 3000)::numeric, 2),
  'ZAR', s.game_type,
  (s.session_risk_score > 70 AND random() < 0.3),
  s.started_at + '30 seconds'::interval
FROM sessions s
WHERE random() < 0.75;

-- Wagers
INSERT INTO transactions (
  casino_id, session_id, player_id, player_token,
  transaction_type, amount, currency, game_type, risk_flag, processed_at
)
SELECT
  s.casino_id, s.id, s.player_id, s.player_token,
  'wager',
  round((20 + random() * 1500)::numeric, 2),
  'ZAR', s.game_type,
  (s.session_risk_score > 65 AND random() < 0.2),
  s.started_at + (floor(random() * GREATEST(s.duration_seconds/2, 60)) || ' seconds')::interval
FROM sessions s;

-- Wins
INSERT INTO transactions (
  casino_id, session_id, player_id, player_token,
  transaction_type, amount, currency, game_type, risk_flag, processed_at
)
SELECT
  s.casino_id, s.id, s.player_id, s.player_token,
  'win',
  round((5 + random() * s.total_won)::numeric, 2),
  'ZAR', s.game_type,
  false,
  s.started_at + (floor(random() * GREATEST(s.duration_seconds, 120)) || ' seconds')::interval
FROM sessions s
WHERE random() < 0.65;

-- Withdrawals
INSERT INTO transactions (
  casino_id, session_id, player_id, player_token,
  transaction_type, amount, currency, game_type, risk_flag, processed_at
)
SELECT
  s.casino_id, s.id, s.player_id, s.player_token,
  'withdrawal',
  round((50 + random() * 2000)::numeric, 2),
  'ZAR', s.game_type,
  (s.session_risk_score > 80 AND random() < 0.15),
  s.started_at + (s.duration_seconds || ' seconds')::interval
FROM sessions s
WHERE random() < 0.25;

-- ============================================================
-- STEP 3: Behaviour Events for medium/high/critical risk players
-- ============================================================
INSERT INTO behaviour_events (
  casino_id, session_id, player_id, player_token,
  event_type, signal_score, severity,
  event_data, model_version, flagged_for_review, recorded_at
)
SELECT
  s.casino_id, s.id, s.player_id, s.player_token,
  (ARRAY[
    'loss_chasing','velocity_spike','deposit_escalation','session_extension',
    'rapid_bet_sequence','unusual_hour_activity','bet_size_escalation','multi_game_switching',
    'withdrawal_reversal','consecutive_losses','chasing_jackpot','erratic_bet_pattern'
  ])[1 + floor(random()*12)::int] AS event_type,
  CASE p.risk_level
    WHEN 'medium'   THEN 30 + floor(random()*29)::int
    WHEN 'high'     THEN 60 + floor(random()*24)::int
    WHEN 'critical' THEN 80 + floor(random()*19)::int
    ELSE 15
  END AS signal_score,
  p.risk_level AS severity,
  jsonb_build_object(
    'session_duration_mins', round((s.duration_seconds/60.0)::numeric,1),
    'total_wagered', s.total_wagered,
    'net_result', round((s.total_won - s.total_wagered)::numeric, 2),
    'risk_score', p.risk_score,
    'model', 'bri-2.1'
  ),
  'bri-2.1',
  (p.risk_level IN ('high','critical') AND random() < 0.5),
  s.started_at + (floor(random() * GREATEST(s.duration_seconds, 120)) || ' seconds')::interval
FROM sessions s
JOIN players p ON p.id = s.player_id
WHERE p.risk_level IN ('medium','high','critical')
  AND random() < 0.55;
