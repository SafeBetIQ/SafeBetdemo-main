/*
  # Create Behavioral Risk Profiles from Existing Players

  1. Data Created
    - Behavioral risk profiles for all existing players
    - Based on current risk scores from players table
    - Includes analyzed_at timestamps for tracking
    - Provides foundation for intervention history

  2. Purpose
    - Support intervention tracking system
    - Enable historical risk analysis
    - Provide data for intervention effectiveness tracking
*/

-- Create behavioral risk profiles for all players that don't have one
INSERT INTO behavioral_risk_profiles (
  player_id,
  casino_id,
  risk_score,
  risk_level,
  analyzed_at,
  created_at,
  updated_at
)
SELECT 
  p.id,
  p.casino_id,
  COALESCE(p.risk_score, 0),
  CASE
    WHEN COALESCE(p.risk_score, 0) >= 80 THEN 'critical'
    WHEN COALESCE(p.risk_score, 0) >= 70 THEN 'high'
    WHEN COALESCE(p.risk_score, 0) >= 40 THEN 'moderate'
    ELSE 'low'
  END,
  COALESCE(p.last_active, p.created_at, now()),
  now(),
  now()
FROM players p
WHERE NOT EXISTS (
  SELECT 1 FROM behavioral_risk_profiles brp 
  WHERE brp.player_id = p.id
);
