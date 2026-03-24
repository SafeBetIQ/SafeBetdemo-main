
/*
  # Reseed Gaming Sessions with Current Dates (v2)

  Replaces all existing gaming sessions with fresh data spanning:
  - Last 90 days of historical completed sessions
  - Dense last-24-hour sessions for the "last 24h" filter
  - ~500 actively live sessions (is_active = true) for the "Active Now" KPI

  Valid game types: slots, blackjack, roulette, poker, baccarat
*/

DELETE FROM gaming_sessions;

-- Historical sessions: last 90 days
INSERT INTO gaming_sessions (
  id, player_id, casino_id, game_type,
  start_time, end_time, duration,
  total_bets, total_wagered, total_won, net_result,
  risk_score_change, is_active, created_at
)
SELECT
  gen_random_uuid(),
  p.id AS player_id,
  p.casino_id,
  (ARRAY['slots','blackjack','roulette','poker','baccarat'])[1 + floor(random()*5)::int] AS game_type,
  NOW() - (random() * INTERVAL '90 days') AS start_time,
  NOW() - (random() * INTERVAL '90 days') + (floor(random()*180 + 5) * INTERVAL '1 minute') AS end_time,
  floor(random()*180 + 5)::int AS duration,
  floor(random()*50 + 1)::int AS total_bets,
  round((random()*4500 + 50)::numeric, 2) AS total_wagered,
  round((random()*4000)::numeric, 2) AS total_won,
  round(((random()*4000) - (random()*4500 + 50))::numeric, 2) AS net_result,
  floor(random()*10 - 3)::int AS risk_score_change,
  false AS is_active,
  NOW() - (random() * INTERVAL '90 days') AS created_at
FROM players p
CROSS JOIN generate_series(1, 3) gs
WHERE random() < 0.5
LIMIT 60000;

-- Dense last-24-hour sessions
INSERT INTO gaming_sessions (
  id, player_id, casino_id, game_type,
  start_time, end_time, duration,
  total_bets, total_wagered, total_won, net_result,
  risk_score_change, is_active, created_at
)
SELECT
  gen_random_uuid(),
  p.id,
  p.casino_id,
  (ARRAY['slots','blackjack','roulette','poker','baccarat'])[1 + floor(random()*5)::int],
  NOW() - (random() * INTERVAL '24 hours'),
  NOW() - (random() * INTERVAL '24 hours') + (floor(random()*120 + 5) * INTERVAL '1 minute'),
  floor(random()*120 + 5)::int,
  floor(random()*30 + 1)::int,
  round((random()*2000 + 50)::numeric, 2),
  round((random()*1800)::numeric, 2),
  round(((random()*1800) - (random()*2000 + 50))::numeric, 2),
  floor(random()*8 - 2)::int,
  false,
  NOW() - (random() * INTERVAL '24 hours')
FROM players p
WHERE random() < 0.08
LIMIT 4000;

-- Active / live sessions (is_active = true, no end_time, started in last 4 hours)
INSERT INTO gaming_sessions (
  id, player_id, casino_id, game_type,
  start_time, end_time, duration,
  total_bets, total_wagered, total_won, net_result,
  risk_score_change, is_active, created_at
)
SELECT
  gen_random_uuid(),
  p.id,
  p.casino_id,
  (ARRAY['slots','blackjack','roulette','poker','baccarat'])[1 + floor(random()*5)::int],
  NOW() - (random() * INTERVAL '4 hours'),
  NULL,
  floor(random()*240 + 10)::int,
  floor(random()*60 + 1)::int,
  round((random()*3000 + 100)::numeric, 2),
  round((random()*2500)::numeric, 2),
  round(((random()*2500) - (random()*3000 + 100))::numeric, 2),
  floor(random()*12)::int,
  true,
  NOW() - (random() * INTERVAL '4 hours')
FROM players p
WHERE random() < 0.004
LIMIT 500;
