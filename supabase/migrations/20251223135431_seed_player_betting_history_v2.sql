/*
  # Seed Player Betting History Data
  
  1. Purpose
    - Create realistic betting history for all players across all casinos
    - Ensure each casino has its own isolated betting data
    - Generate diverse betting patterns (wins, losses, different game types)
  
  2. Data Generated
    - Gaming sessions for active players
    - Individual bets within each session
    - Mix of outcomes: wins, losses, and pushes
    - Various game types: slots, blackjack, roulette, poker, baccarat
  
  3. Data Isolation
    - Each casino's betting data is isolated by casino_id
    - Player bets are linked to their respective casino
*/

-- First, create gaming sessions for each active player
DO $$
DECLARE
  player_record RECORD;
  session_record RECORD;
  current_session_id UUID;
  game_types TEXT[] := ARRAY['slots', 'blackjack', 'roulette', 'poker', 'baccarat'];
  selected_game TEXT;
  bet_outcomes TEXT[] := ARRAY['win', 'loss', 'push'];
  selected_outcome TEXT;
  bet_amount_value NUMERIC;
  win_amount_value NUMERIC;
  bet_count INTEGER;
  i INTEGER;
BEGIN
  -- Loop through each player
  FOR player_record IN 
    SELECT id, player_id, casino_id, risk_score
    FROM players
    WHERE is_active = true
  LOOP
    -- Create 1-3 gaming sessions per active player
    FOR session_num IN 1..FLOOR(RANDOM() * 3 + 1)::INTEGER LOOP
      selected_game := game_types[FLOOR(RANDOM() * array_length(game_types, 1) + 1)::INTEGER];
      
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
        is_active
      ) VALUES (
        player_record.id,
        player_record.casino_id,
        selected_game,
        NOW() - (INTERVAL '1 hour' * FLOOR(RANDOM() * 24)),
        CASE WHEN session_num = 1 THEN NULL ELSE NOW() - (INTERVAL '1 hour' * FLOOR(RANDOM() * 12)) END,
        FLOOR(RANDOM() * 120 + 15)::INTEGER,
        0,
        0,
        0,
        0,
        CASE WHEN session_num = 1 THEN true ELSE false END
      )
      RETURNING id INTO current_session_id;
      
      -- Create 5-20 bets per session
      bet_count := FLOOR(RANDOM() * 16 + 5)::INTEGER;
      
      FOR i IN 1..bet_count LOOP
        -- Determine bet amount based on risk score (higher risk = larger bets)
        IF player_record.risk_score >= 80 THEN
          bet_amount_value := FLOOR(RANDOM() * 1500 + 500)::NUMERIC;
        ELSIF player_record.risk_score >= 60 THEN
          bet_amount_value := FLOOR(RANDOM() * 800 + 200)::NUMERIC;
        ELSIF player_record.risk_score >= 40 THEN
          bet_amount_value := FLOOR(RANDOM() * 400 + 100)::NUMERIC;
        ELSE
          bet_amount_value := FLOOR(RANDOM() * 200 + 50)::NUMERIC;
        END IF;
        
        -- Determine outcome (weighted: 45% loss, 40% win, 15% push)
        IF RANDOM() < 0.45 THEN
          selected_outcome := 'loss';
          win_amount_value := 0;
        ELSIF RANDOM() < 0.85 THEN
          selected_outcome := 'win';
          -- Win amount varies by game type
          CASE selected_game
            WHEN 'slots' THEN
              win_amount_value := bet_amount_value * (1 + RANDOM() * 3);
            WHEN 'blackjack' THEN
              win_amount_value := bet_amount_value * 2;
            WHEN 'roulette' THEN
              win_amount_value := bet_amount_value * (1 + RANDOM() * 35);
            WHEN 'poker' THEN
              win_amount_value := bet_amount_value * (1 + RANDOM() * 5);
            WHEN 'baccarat' THEN
              win_amount_value := bet_amount_value * 2;
          END CASE;
        ELSE
          selected_outcome := 'push';
          win_amount_value := bet_amount_value;
        END IF;
        
        -- Insert the bet
        INSERT INTO player_bets (
          session_id,
          player_id,
          game_type,
          bet_amount,
          win_amount,
          outcome,
          timestamp
        ) VALUES (
          current_session_id,
          player_record.id,
          selected_game,
          bet_amount_value,
          win_amount_value,
          selected_outcome,
          NOW() - (INTERVAL '1 minute' * FLOOR(RANDOM() * 60))
        );
      END LOOP;
      
      -- Update session totals
      UPDATE gaming_sessions gs
      SET 
        total_bets = (SELECT COUNT(*) FROM player_bets pb WHERE pb.session_id = gs.id),
        total_wagered = (SELECT COALESCE(SUM(bet_amount), 0) FROM player_bets pb WHERE pb.session_id = gs.id),
        total_won = (SELECT COALESCE(SUM(win_amount), 0) FROM player_bets pb WHERE pb.session_id = gs.id),
        net_result = (SELECT COALESCE(SUM(win_amount - bet_amount), 0) FROM player_bets pb WHERE pb.session_id = gs.id)
      WHERE gs.id = current_session_id;
      
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Successfully seeded betting history for all players';
END $$;