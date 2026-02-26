/*
  # Add Active Players and Gaming Sessions

  1. Purpose
    - Generate active gaming sessions for demo players
    - Mark high-risk players as currently active
    - Populate session data for Live Monitor display

  2. Changes
    - Update is_active status for high-risk players
    - Create active gaming sessions with realistic session data
    - Add session metrics (duration, bet count, win/loss)

  3. Data Generated
    - 15-20 active players across all casinos
    - Current gaming sessions with timestamps
    - Realistic betting patterns and session metrics
*/

-- Mark high-risk players as active for live monitoring
UPDATE players 
SET is_active = true,
    last_active = NOW()
WHERE risk_score >= 60
AND id IN (
  SELECT id FROM players 
  WHERE risk_score >= 60 
  ORDER BY RANDOM() 
  LIMIT 20
);

-- Also activate some medium-risk players for variety
UPDATE players 
SET is_active = true,
    last_active = NOW()
WHERE risk_score >= 40 AND risk_score < 60
AND id IN (
  SELECT id FROM players 
  WHERE risk_score >= 40 AND risk_score < 60
  ORDER BY RANDOM() 
  LIMIT 10
);

-- Create active gaming sessions for these players
DO $$
DECLARE
  player_record RECORD;
  session_start TIMESTAMPTZ;
  session_duration INTEGER;
  game_types TEXT[] := ARRAY['slots', 'blackjack', 'roulette', 'poker', 'baccarat'];
BEGIN
  FOR player_record IN 
    SELECT p.id, p.casino_id, p.risk_score
    FROM players p
    WHERE p.is_active = true
  LOOP
    -- Create a recent session start time (within last 3 hours)
    session_start := NOW() - (INTERVAL '1 minute' * FLOOR(RANDOM() * 180));
    session_duration := FLOOR(RANDOM() * 120 + 15)::INTEGER;
    
    INSERT INTO gaming_sessions (
      player_id,
      casino_id,
      game_type,
      start_time,
      end_time,
      duration,
      total_bets,
      total_wagered,
      total_won,
      net_result,
      risk_score_change,
      is_active,
      created_at
    ) VALUES (
      player_record.id,
      player_record.casino_id,
      game_types[FLOOR(RANDOM() * 5 + 1)],
      session_start,
      NULL, -- Still active
      session_duration,
      FLOOR(RANDOM() * 50 + 10)::INTEGER,
      FLOOR(RANDOM() * 5000 + 500)::NUMERIC,
      FLOOR(RANDOM() * 3000)::NUMERIC,
      FLOOR(RANDOM() * 2000 - 1000)::NUMERIC,
      FLOOR(RANDOM() * 20 - 5)::INTEGER,
      true,
      session_start
    );
  END LOOP;
END $$;
