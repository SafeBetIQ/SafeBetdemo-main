/*
  # Add Comprehensive Gaming Sessions and Betting Data
  
  Generates realistic gaming activity for all casinos:
  
  1. **Gaming Sessions**
     - 200-400 sessions per casino over last 90 days
     - Realistic duration, bet counts, win/loss patterns
     - Distributed across different times and days
  
  2. **Player Bets**
     - 10-60 bets per session
     - Varied bet amounts (R50-R550)
     - 45% win rate (casino edge)
     - Realistic payout multipliers
  
  3. **Financial Tracking**
     - Total wagered per session
     - Total won per session
     - Net result calculations
     - Risk score adjustments based on losses
*/

-- Generate comprehensive gaming sessions
DO $$
DECLARE
  v_casino RECORD;
  v_player RECORD;
  v_session_id UUID;
  v_session_start TIMESTAMP;
  v_session_duration INT;
  v_total_wagered NUMERIC;
  v_total_won NUMERIC;
  v_bet_count INT;
  v_days_ago INT;
  v_game_types TEXT[] := ARRAY['slots', 'blackjack', 'roulette', 'poker', 'baccarat'];
  v_game_type TEXT;
  v_bet_amount NUMERIC;
  v_win_amount NUMERIC;
  v_outcome TEXT;
  v_sessions_created INT := 0;
  v_bets_created INT := 0;
BEGIN
  -- Loop through each casino
  FOR v_casino IN SELECT id, name FROM casinos ORDER BY name LOOP
    -- Generate sessions for random players (200-300 sessions per casino)
    FOR v_player IN 
      SELECT id 
      FROM players 
      WHERE casino_id = v_casino.id 
      ORDER BY RANDOM() 
      LIMIT 100
    LOOP
      -- Each player gets 2-5 sessions over the past 90 days
      FOR i IN 1..(2 + floor(random() * 4)::int) LOOP
        v_days_ago := floor(random() * 90)::int;
        v_session_start := NOW() - (v_days_ago || ' days')::interval - (floor(random() * 24)::int || ' hours')::interval;
        v_session_duration := 15 + floor(random() * 180)::int; -- 15-195 minutes
        v_game_type := v_game_types[1 + floor(random() * array_length(v_game_types, 1))::int];
        
        -- Create session ID
        v_session_id := gen_random_uuid();
        v_total_wagered := 0;
        v_total_won := 0;
        v_bet_count := 10 + floor(random() * 50)::int; -- 10-60 bets per session
        
        -- Insert gaming session first (with placeholder values)
        INSERT INTO gaming_sessions (
          id, player_id, casino_id, game_type,
          start_time, end_time, duration,
          total_bets, total_wagered, total_won, net_result,
          risk_score_change, is_active, created_at
        ) VALUES (
          v_session_id, v_player.id, v_casino.id, v_game_type,
          v_session_start,
          v_session_start + (v_session_duration || ' minutes')::interval,
          v_session_duration,
          v_bet_count, 0, 0, 0, 0, false,
          v_session_start
        );
        
        v_sessions_created := v_sessions_created + 1;
        
        -- Generate bets for this session
        FOR j IN 1..v_bet_count LOOP
          v_bet_amount := (50 + random() * 500)::numeric(10,2); -- R50 - R550 per bet
          
          -- Win probability: 45% chance (casino edge)
          IF random() < 0.45 THEN
            v_outcome := 'win';
            v_win_amount := (v_bet_amount * (1.5 + random() * 1.5))::numeric(10,2); -- 1.5x - 3x payout
          ELSE
            v_outcome := 'loss';
            v_win_amount := 0;
          END IF;
          
          v_total_wagered := v_total_wagered + v_bet_amount;
          v_total_won := v_total_won + v_win_amount;
          
          -- Insert bet
          INSERT INTO player_bets (
            id, session_id, player_id, game_type,
            bet_amount, win_amount, outcome,
            timestamp, created_at
          ) VALUES (
            gen_random_uuid(), v_session_id, v_player.id, v_game_type,
            v_bet_amount, v_win_amount, v_outcome,
            v_session_start + (j * (v_session_duration / v_bet_count)::int || ' seconds')::interval,
            v_session_start
          );
          
          v_bets_created := v_bets_created + 1;
        END LOOP;
        
        -- Update gaming session with actual totals
        UPDATE gaming_sessions
        SET 
          total_wagered = v_total_wagered,
          total_won = v_total_won,
          net_result = v_total_won - v_total_wagered,
          risk_score_change = CASE 
            WHEN (v_total_won - v_total_wagered) < -2000 THEN 5 + floor(random() * 10)::int
            WHEN (v_total_won - v_total_wagered) < -1000 THEN 2 + floor(random() * 5)::int
            ELSE floor(random() * 3)::int
          END
        WHERE id = v_session_id;
      END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Generated gaming data for casino: %', v_casino.name;
  END LOOP;
  
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'GAMING DATA GENERATION COMPLETE';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Total gaming sessions created: %', v_sessions_created;
  RAISE NOTICE 'Total player bets created: %', v_bets_created;
  RAISE NOTICE '==================================================';
END $$;

-- Display summary per casino
DO $$
DECLARE
  v_casino RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'CASINO-BY-CASINO SUMMARY:';
  RAISE NOTICE '==================================================';
  
  FOR v_casino IN 
    SELECT 
      c.name,
      COUNT(DISTINCT gs.id) as sessions,
      COUNT(DISTINCT pb.id) as bets,
      SUM(gs.total_wagered) as total_wagered,
      SUM(gs.total_won) as total_won,
      SUM(gs.net_result) as net_result
    FROM casinos c
    LEFT JOIN gaming_sessions gs ON c.id = gs.casino_id
    LEFT JOIN player_bets pb ON gs.id = pb.session_id
    GROUP BY c.id, c.name
    ORDER BY c.name
  LOOP
    RAISE NOTICE '%:', v_casino.name;
    RAISE NOTICE '  Sessions: %, Bets: %', v_casino.sessions, v_casino.bets;
    RAISE NOTICE '  Wagered: R%, Won: R%, Net: R%', 
      COALESCE(ROUND(v_casino.total_wagered), 0),
      COALESCE(ROUND(v_casino.total_won), 0),
      COALESCE(ROUND(v_casino.net_result), 0);
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '==================================================';
END $$;
