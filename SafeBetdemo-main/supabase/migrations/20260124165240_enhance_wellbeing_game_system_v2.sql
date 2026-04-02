/*
  # Enhanced Wellbeing Game System V2

  ## Summary
  Comprehensive enhancement of the wellbeing game system to support advanced features,
  better analytics, and improved user experience.

  ## New Tables
  
  ### `wellbeing_game_telemetry_events`
  Detailed event tracking for behavioral analysis:
  - Mouse/touch movement patterns
  - Hover durations and patterns
  - Decision hesitation metrics
  - Card comparison behavior
  - Device and interaction context

  ### `wellbeing_game_badges`
  Achievement/insight badges system:
  - Badge definitions (types, criteria, descriptions)
  - Tracks user progress and unlocks
  - Supports gamification and replay value

  ### `wellbeing_game_insights`
  Personalized AI-generated insights:
  - Pattern recognition results
  - Risk trigger identification
  - Behavioral recommendations
  - Comparison to previous sessions

  ### `wellbeing_educational_resources`
  Responsible gaming educational content:
  - Articles, videos, and tips
  - Mapped to specific risk patterns
  - Support resources and helplines

  ## Modifications to Existing Tables

  ### `wellbeing_game_sessions`
  Added fields:
  - `mouse_movement_data` - Raw movement tracking
  - `hesitation_score` - Decision hesitation metric (0-100)
  - `consistency_score` - Pattern consistency metric (0-100)
  - `decision_speed_variance` - Impulsivity indicator
  - `risk_escalation_detected` - Boolean flag
  - `insights_generated` - Cached insights
  - `comparison_data` - Comparison to previous sessions

  ## Security
  - RLS enabled on all new tables
  - Casino staff can read their casino's data
  - Players can only access their own data
  - Regulators can access all data (audit purposes)

  ## Indexes
  - Performance indexes on frequently queried fields
  - Composite indexes for analytics queries
*/

-- Add new columns to wellbeing_game_sessions
ALTER TABLE wellbeing_game_sessions 
ADD COLUMN IF NOT EXISTS mouse_movement_data jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS hesitation_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS consistency_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS decision_speed_variance numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_escalation_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS insights_generated jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS comparison_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS device_info jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS accessibility_mode text;

-- Create wellbeing_game_telemetry_events table
CREATE TABLE IF NOT EXISTS wellbeing_game_telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES wellbeing_game_sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  
  event_type text NOT NULL,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  event_sequence integer NOT NULL,
  
  scenario_id integer,
  card_index integer,
  
  hover_duration_ms integer,
  mouse_position jsonb,
  scroll_position jsonb,
  device_orientation text,
  
  hesitation_detected boolean DEFAULT false,
  comparison_pattern jsonb,
  
  time_on_scenario_ms integer,
  cards_viewed integer,
  back_and_forth_count integer,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wellbeing_game_telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino staff can view their casino's telemetry"
  ON wellbeing_game_telemetry_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.casino_id = wellbeing_game_telemetry_events.casino_id
      AND staff.role IN ('manager', 'compliance_officer')
    )
  );

CREATE POLICY "Regulators can view all telemetry"
  ON wellbeing_game_telemetry_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'regulator'
    )
  );

-- Create wellbeing_game_badges table
CREATE TABLE IF NOT EXISTS wellbeing_game_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_type text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  criteria jsonb NOT NULL,
  tier text NOT NULL DEFAULT 'bronze',
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wellbeing_game_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badge definitions"
  ON wellbeing_game_badges FOR SELECT
  TO authenticated
  USING (true);

-- Create wellbeing_player_badges table (tracks which badges players earned)
CREATE TABLE IF NOT EXISTS wellbeing_player_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  badge_id uuid REFERENCES wellbeing_game_badges(id) ON DELETE CASCADE,
  session_id uuid REFERENCES wellbeing_game_sessions(id) ON DELETE SET NULL,
  
  earned_at timestamptz DEFAULT now(),
  
  UNIQUE(player_id, badge_id)
);

ALTER TABLE wellbeing_player_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino staff can view their casino's player badges"
  ON wellbeing_player_badges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.casino_id = wellbeing_player_badges.casino_id
      AND staff.role IN ('manager', 'compliance_officer')
    )
  );

-- Create wellbeing_game_insights table
CREATE TABLE IF NOT EXISTS wellbeing_game_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES wellbeing_game_sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  
  insight_type text NOT NULL,
  insight_category text NOT NULL,
  
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text,
  resources jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wellbeing_game_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino staff can view their casino's insights"
  ON wellbeing_game_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.casino_id = wellbeing_game_insights.casino_id
      AND staff.role IN ('manager', 'compliance_officer')
    )
  );

-- Create wellbeing_educational_resources table
CREATE TABLE IF NOT EXISTS wellbeing_educational_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL,
  category text NOT NULL,
  
  title text NOT NULL,
  description text NOT NULL,
  content text,
  url text,
  
  risk_patterns text[] DEFAULT ARRAY[]::text[],
  severity_level text[] DEFAULT ARRAY['info', 'warning', 'concern'],
  
  language text DEFAULT 'en',
  country_code text DEFAULT 'ZA',
  active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wellbeing_educational_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active educational resources"
  ON wellbeing_educational_resources FOR SELECT
  TO authenticated
  USING (active = true);

-- Seed badge definitions
INSERT INTO wellbeing_game_badges (badge_type, name, description, icon, criteria, tier) VALUES
  ('self_aware', 'Self-Aware Player', 'Completed your first wellbeing assessment', 'Brain', '{"sessions_completed": 1}'::jsonb, 'bronze'),
  ('balanced_start', 'Balanced Beginning', 'Made 6+ safe choices in first session', 'Shield', '{"safe_choices_min": 6, "first_session": true}'::jsonb, 'bronze'),
  ('risk_manager', 'Risk Manager', 'Avoided all high-risk choices in a session', 'Target', '{"very_risky_choices": 0}'::jsonb, 'silver'),
  ('improvement_seeker', 'Improvement Seeker', 'Completed 3 sessions', 'TrendingUp', '{"sessions_completed": 3}'::jsonb, 'silver'),
  ('consistent_control', 'Consistent Control', 'Maintained 70+ balance score across 3 sessions', 'CheckCircle', '{"min_balance": 70, "sessions": 3}'::jsonb, 'gold'),
  ('wellbeing_champion', 'Wellbeing Champion', '10 sessions with average 80+ balance score', 'Trophy', '{"sessions": 10, "avg_balance": 80}'::jsonb, 'platinum')
ON CONFLICT DO NOTHING;

-- Seed educational resources
INSERT INTO wellbeing_educational_resources (resource_type, category, title, description, content, risk_patterns, severity_level) VALUES
  (
    'article',
    'responsible_gaming',
    'Understanding Winning Streaks',
    'Learn why winning streaks can be the most dangerous time for players',
    'Winning streaks create a false sense of control and invincibility. Research shows that players are most likely to make large, risky bets after a series of wins. This is when setting limits becomes most important.',
    ARRAY['winning_streak', 'risk_escalation'],
    ARRAY['info', 'warning']
  ),
  (
    'article',
    'loss_chasing',
    'The Loss Chasing Trap',
    'Why trying to win back losses rarely works',
    'Loss chasing is one of the most common patterns in problem gambling. When down, players often increase bets to recover losses quickly. This rarely works because each bet is independent - past losses don''t make future wins more likely.',
    ARRAY['loss_chasing', 'emotional_play'],
    ARRAY['warning', 'concern']
  ),
  (
    'tip',
    'practical_strategy',
    'The 50% Win Rule',
    'A simple strategy to protect your winnings',
    'When you''re up 50% or more from your starting amount, immediately set aside your original stake plus half your profit. This guarantees you walk away a winner no matter what happens next.',
    ARRAY['winning_streak'],
    ARRAY['info']
  ),
  (
    'helpline',
    'support',
    'National Responsible Gambling Programme (South Africa)',
    '24/7 support for gambling concerns',
    'Free, confidential support available 24/7. Call 0800 006 008 or visit www.responsiblegambling.co.za',
    ARRAY['loss_chasing', 'emotional_play', 'budget_violation', 'time_management'],
    ARRAY['concern']
  ),
  (
    'tool',
    'self_assessment',
    'Self-Exclusion Options',
    'Take a break when you need it',
    'Self-exclusion allows you to take a break from gambling for a set period. Contact your casino or visit www.nrgp.org.za to learn about self-exclusion options.',
    ARRAY['loss_chasing', 'emotional_play'],
    ARRAY['warning', 'concern']
  )
ON CONFLICT DO NOTHING;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON wellbeing_game_telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_player ON wellbeing_game_telemetry_events(player_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_casino ON wellbeing_game_telemetry_events(casino_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_type_timestamp ON wellbeing_game_telemetry_events(event_type, event_timestamp);

CREATE INDEX IF NOT EXISTS idx_player_badges_player ON wellbeing_player_badges(player_id);
CREATE INDEX IF NOT EXISTS idx_player_badges_earned ON wellbeing_player_badges(earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_insights_session ON wellbeing_game_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_player ON wellbeing_game_insights(player_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON wellbeing_game_insights(insight_type, insight_category);

CREATE INDEX IF NOT EXISTS idx_sessions_player_completed ON wellbeing_game_sessions(player_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_casino_completed ON wellbeing_game_sessions(casino_id, completed_at DESC) WHERE completed_at IS NOT NULL;
