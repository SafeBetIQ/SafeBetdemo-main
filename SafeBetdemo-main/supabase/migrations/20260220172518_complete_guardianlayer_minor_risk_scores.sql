-- Complete guardian_minor_risk_scores with all columns
ALTER TABLE guardian_minor_risk_scores
  ADD COLUMN IF NOT EXISTS risk_trend text DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS risk_change_delta decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS betting_velocity_score decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS reaction_time_score decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS micro_bet_frequency decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS session_anomaly_score decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS school_hour_activity_flag boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS game_switch_impulsivity decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS loss_chasing_score decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS device_mismatch_score decimal(6,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS calculated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
