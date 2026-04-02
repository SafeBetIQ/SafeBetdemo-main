/*
  # Create Players and Gaming Sessions Tables

  1. New Tables
    - `players` - Casino player profiles with South African data
    - `gaming_sessions` - Active and historical gaming sessions
    - `player_bets` - Individual bet transactions

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS player_bets CASCADE;
DROP TABLE IF EXISTS gaming_sessions CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Create players table
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  player_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  id_number text,
  province text,
  risk_score integer DEFAULT 0,
  risk_level text DEFAULT 'low',
  total_wagered numeric DEFAULT 0,
  total_won numeric DEFAULT 0,
  session_count integer DEFAULT 0,
  avg_session_duration integer DEFAULT 0,
  is_active boolean DEFAULT true,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_risk_score CHECK (risk_score >= 0 AND risk_score <= 100),
  CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);

-- Create gaming_sessions table
CREATE TABLE gaming_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  duration integer DEFAULT 0,
  total_bets integer DEFAULT 0,
  total_wagered numeric DEFAULT 0,
  total_won numeric DEFAULT 0,
  net_result numeric DEFAULT 0,
  risk_score_change integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_game_type CHECK (game_type IN ('slots', 'blackjack', 'roulette', 'poker', 'baccarat'))
);

-- Create player_bets table
CREATE TABLE player_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES gaming_sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  bet_amount numeric NOT NULL,
  win_amount numeric DEFAULT 0,
  outcome text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_outcome CHECK (outcome IN ('win', 'loss', 'push'))
);

-- Create indexes
CREATE INDEX idx_players_casino_id ON players(casino_id);
CREATE INDEX idx_players_risk_level ON players(risk_level);
CREATE INDEX idx_players_is_active ON players(is_active);
CREATE INDEX idx_gaming_sessions_player_id ON gaming_sessions(player_id);
CREATE INDEX idx_gaming_sessions_casino_id ON gaming_sessions(casino_id);
CREATE INDEX idx_gaming_sessions_is_active ON gaming_sessions(is_active);
CREATE INDEX idx_player_bets_session_id ON player_bets(session_id);
CREATE INDEX idx_player_bets_player_id ON player_bets(player_id);
CREATE INDEX idx_player_bets_timestamp ON player_bets(timestamp DESC);

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_bets ENABLE ROW LEVEL SECURITY;

-- Players policies
CREATE POLICY "Users can view players in their casino"
  ON players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR users.role = 'regulator'
        OR (users.role = 'casino_admin' AND users.casino_id = players.casino_id)
      )
    )
  );

CREATE POLICY "Casino admins can insert players"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'casino_admin' AND users.casino_id = players.casino_id)
      )
    )
  );

CREATE POLICY "Casino admins can update players"
  ON players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'casino_admin' AND users.casino_id = players.casino_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'casino_admin' AND users.casino_id = players.casino_id)
      )
    )
  );

-- Gaming sessions policies
CREATE POLICY "Users can view sessions"
  ON gaming_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR users.role = 'regulator'
        OR (users.role = 'casino_admin' AND users.casino_id = gaming_sessions.casino_id)
      )
    )
  );

CREATE POLICY "Casino admins can insert sessions"
  ON gaming_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'casino_admin' AND users.casino_id = gaming_sessions.casino_id)
      )
    )
  );

CREATE POLICY "Casino admins can update sessions"
  ON gaming_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'casino_admin' AND users.casino_id = gaming_sessions.casino_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'casino_admin' AND users.casino_id = gaming_sessions.casino_id)
      )
    )
  );

-- Player bets policies
CREATE POLICY "Users can view bets"
  ON player_bets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN gaming_sessions gs ON gs.id = player_bets.session_id
      WHERE u.id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR u.role = 'regulator'
        OR (u.role = 'casino_admin' AND u.casino_id = gs.casino_id)
      )
    )
  );

CREATE POLICY "Casino admins can insert bets"
  ON player_bets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN gaming_sessions gs ON gs.id = player_bets.session_id
      WHERE u.id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR (u.role = 'casino_admin' AND u.casino_id = gs.casino_id)
      )
    )
  );
