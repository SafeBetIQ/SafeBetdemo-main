
/*
  # Boost Live Active Sessions - Proportional to Player Count (v2)

  Adds significantly more is_active=true sessions so that each casino
  shows approximately 8-12% of its players as live (currently only ~2.5-3%).
  Uses only valid game_type values: slots, blackjack, roulette, poker, baccarat.
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
  NOW() - (random() * INTERVAL '4 hours'),
  NULL,
  floor(random()*240 + 5)::int,
  floor(random()*120 + 1)::int,
  round((random()*8000 + 50)::numeric, 2),
  round((random()*7500)::numeric, 2),
  round(((random()*7500) - (random()*8000 + 50))::numeric, 2),
  floor(random()*20)::int,
  true,
  NOW() - (random() * INTERVAL '4 hours')
FROM players p
WHERE random() < 0.075;
