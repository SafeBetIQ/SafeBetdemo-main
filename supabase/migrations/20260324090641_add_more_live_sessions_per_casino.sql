
/*
  # Add More Live Active Sessions Per Casino

  Inserts a large number of additional is_active=true sessions so that
  each casino shows a meaningful number of live players (150-300+).
  Sessions started within the last 6 hours, no end_time.
*/

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
  NOW() - (random() * INTERVAL '6 hours'),
  NULL,
  floor(random()*360 + 5)::int,
  floor(random()*80 + 1)::int,
  round((random()*5000 + 50)::numeric, 2),
  round((random()*4500)::numeric, 2),
  round(((random()*4500) - (random()*5000 + 50))::numeric, 2),
  floor(random()*15)::int,
  true,
  NOW() - (random() * INTERVAL '6 hours')
FROM players p
WHERE random() < 0.025
LIMIT 3000;
