
/*
  # Seed Gaming Sessions for All 18 Casinos (v2)

  ## Summary
  Creates ~5 gaming sessions per active player across all casinos.
  Uses only valid game types: slots, blackjack, roulette, poker, baccarat.
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
  (ARRAY['slots','blackjack','roulette','poker','baccarat'])[1 + ((rn + s.n) % 5)],
  now() - ((s.n * 3 + (rn % 30)) || ' days')::interval - ((rn % 20) || ' hours')::interval,
  now() - ((s.n * 3 + (rn % 30)) || ' days')::interval - ((rn % 20) || ' hours')::interval
    + (((p.avg_session_duration * 60) + (s.n % 3600)) || ' seconds')::interval,
  (p.avg_session_duration * 60) + (s.n % 3600),
  5 + (s.n % 40),
  (50 + (s.n % 2000))::numeric,
  ((50 + (s.n % 2000)) * (0.3 + (s.n % 60)::numeric / 100))::numeric,
  ((50 + (s.n % 2000)) * (0.3 + (s.n % 60)::numeric / 100) - (50 + (s.n % 2000)))::numeric,
  CASE WHEN (s.n % 10) < 2 THEN (5 + s.n % 20) WHEN (s.n % 10) < 4 THEN -(2 + s.n % 10) ELSE 0 END,
  false,
  now() - ((s.n * 3) || ' days')::interval
FROM (
  SELECT id, casino_id, avg_session_duration, is_active,
         (row_number() OVER (PARTITION BY casino_id ORDER BY id))::int AS rn
  FROM players
  WHERE is_active = true
) p
CROSS JOIN (SELECT generate_series(1, 5) AS n) s
ON CONFLICT DO NOTHING;
