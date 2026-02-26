/*
  # Drop and Recreate GuardianLayer Tables

  Drop existing guardian tables and recreate with correct schema
*/

-- Drop existing tables
DROP TABLE IF EXISTS guardian_device_intelligence CASCADE;
DROP TABLE IF EXISTS guardian_identity_drift CASCADE;
DROP TABLE IF EXISTS guardian_school_hour_flags CASCADE;
DROP TABLE IF EXISTS guardian_intervention_signals CASCADE;
DROP TABLE IF EXISTS guardian_operator_risk_summary CASCADE;
DROP TABLE IF EXISTS guardian_province_risk_summary CASCADE;

-- Device Intelligence Table
CREATE TABLE guardian_device_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  casino_id uuid NOT NULL,
  ip_address text,
  ip_consistency_score decimal(6,3) DEFAULT 1.000,
  login_pattern_cluster text,
  session_overlap_detected boolean DEFAULT false,
  behavioral_fingerprint jsonb,
  fingerprint_shift_score decimal(6,3) DEFAULT 0.000,
  shared_device_probability decimal(6,3) DEFAULT 0.000,
  device_identity_shift_score decimal(6,3) DEFAULT 0.000,
  linked_accounts_count integer DEFAULT 0,
  high_risk_device boolean DEFAULT false,
  repeat_flagged boolean DEFAULT false,
  device_reuse_frequency integer DEFAULT 0,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Identity Drift Table
CREATE TABLE guardian_identity_drift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  device_id text NOT NULL,
  casino_id uuid NOT NULL,
  drift_score decimal(6,3) DEFAULT 0.000,
  behavioral_signature_change boolean DEFAULT false,
  time_of_day_shift boolean DEFAULT false,
  stake_size_shift boolean DEFAULT false,
  gameplay_pattern_deviation boolean DEFAULT false,
  drift_threshold_exceeded boolean DEFAULT false,
  drift_spike_detected boolean DEFAULT false,
  repeat_drift_flag boolean DEFAULT false,
  cross_account_similarity_score decimal(6,3) DEFAULT 0.000,
  intervention_recommended boolean DEFAULT false,
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- School Hour Flags Table
CREATE TABLE guardian_school_hour_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  casino_id uuid NOT NULL,
  session_start timestamptz NOT NULL,
  session_end timestamptz,
  is_school_hours boolean DEFAULT false,
  is_weekday boolean DEFAULT false,
  province text,
  geo_latitude decimal(10,6),
  geo_longitude decimal(10,6),
  within_school_zone boolean DEFAULT false,
  school_hour_activity_ratio decimal(6,3) DEFAULT 0.000,
  risk_multiplier decimal(6,3) DEFAULT 1.000,
  created_at timestamptz DEFAULT now()
);

-- Intervention Signals Table
CREATE TABLE guardian_intervention_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  casino_id uuid NOT NULL,
  signal_type text NOT NULL,
  trigger_reason text NOT NULL,
  risk_score decimal(6,3) DEFAULT 0.000,
  casino_response_status text DEFAULT 'pending',
  response_time_minutes integer,
  action_taken text,
  escalation_stage integer DEFAULT 1,
  resolution_outcome text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Operator Risk Summary Table
CREATE TABLE guardian_operator_risk_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  summary_date date DEFAULT CURRENT_DATE,
  underage_suspicion_rate decimal(6,3) DEFAULT 0.000,
  device_risk_index decimal(6,3) DEFAULT 0.000,
  average_response_time_minutes decimal(8,3) DEFAULT 0.000,
  escalation_compliance_percent decimal(6,3) DEFAULT 0.000,
  total_minor_risk_alerts integer DEFAULT 0,
  total_identity_drift_alerts integer DEFAULT 0,
  total_device_shifts integer DEFAULT 0,
  total_interventions integer DEFAULT 0,
  interventions_resolved integer DEFAULT 0,
  interventions_pending integer DEFAULT 0,
  national_risk_ranking integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Province Risk Summary Table
CREATE TABLE guardian_province_risk_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province text NOT NULL,
  summary_date date DEFAULT CURRENT_DATE,
  province_risk_index decimal(6,3) DEFAULT 0.000,
  school_hour_risk_score decimal(6,3) DEFAULT 0.000,
  total_flagged_sessions integer DEFAULT 0,
  total_operators integer DEFAULT 0,
  high_risk_operators integer DEFAULT 0,
  average_operator_response_time decimal(8,3) DEFAULT 0.000,
  compliance_rate decimal(6,3) DEFAULT 0.000,
  school_holiday_comparison decimal(6,3) DEFAULT 0.000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add Foreign Key Constraints
ALTER TABLE guardian_device_intelligence ADD CONSTRAINT guardian_device_intelligence_casino_id_fkey FOREIGN KEY (casino_id) REFERENCES casinos(id) ON DELETE CASCADE;
ALTER TABLE guardian_identity_drift ADD CONSTRAINT guardian_identity_drift_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE guardian_identity_drift ADD CONSTRAINT guardian_identity_drift_casino_id_fkey FOREIGN KEY (casino_id) REFERENCES casinos(id) ON DELETE CASCADE;
ALTER TABLE guardian_school_hour_flags ADD CONSTRAINT guardian_school_hour_flags_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE guardian_school_hour_flags ADD CONSTRAINT guardian_school_hour_flags_casino_id_fkey FOREIGN KEY (casino_id) REFERENCES casinos(id) ON DELETE CASCADE;
ALTER TABLE guardian_intervention_signals ADD CONSTRAINT guardian_intervention_signals_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE guardian_intervention_signals ADD CONSTRAINT guardian_intervention_signals_casino_id_fkey FOREIGN KEY (casino_id) REFERENCES casinos(id) ON DELETE CASCADE;
ALTER TABLE guardian_operator_risk_summary ADD CONSTRAINT guardian_operator_risk_summary_casino_id_fkey FOREIGN KEY (casino_id) REFERENCES casinos(id) ON DELETE CASCADE;

-- Add Unique Constraints
ALTER TABLE guardian_operator_risk_summary ADD CONSTRAINT guardian_operator_risk_summary_casino_id_summary_date_key UNIQUE(casino_id, summary_date);
ALTER TABLE guardian_province_risk_summary ADD CONSTRAINT guardian_province_risk_summary_province_summary_date_key UNIQUE(province, summary_date);

-- Indexes
CREATE INDEX idx_guardian_device_device_id ON guardian_device_intelligence(device_id);
CREATE INDEX idx_guardian_device_casino ON guardian_device_intelligence(casino_id);
CREATE INDEX idx_guardian_device_high_risk ON guardian_device_intelligence(high_risk_device);

CREATE INDEX idx_guardian_drift_player ON guardian_identity_drift(player_id);
CREATE INDEX idx_guardian_drift_device ON guardian_identity_drift(device_id);
CREATE INDEX idx_guardian_drift_casino ON guardian_identity_drift(casino_id);
CREATE INDEX idx_guardian_drift_detected ON guardian_identity_drift(detected_at DESC);

CREATE INDEX idx_guardian_school_player ON guardian_school_hour_flags(player_id);
CREATE INDEX idx_guardian_school_casino ON guardian_school_hour_flags(casino_id);
CREATE INDEX idx_guardian_school_province ON guardian_school_hour_flags(province);
CREATE INDEX idx_guardian_school_session ON guardian_school_hour_flags(session_start DESC);

CREATE INDEX idx_guardian_signals_player ON guardian_intervention_signals(player_id);
CREATE INDEX idx_guardian_signals_casino ON guardian_intervention_signals(casino_id);
CREATE INDEX idx_guardian_signals_status ON guardian_intervention_signals(casino_response_status);
CREATE INDEX idx_guardian_signals_created ON guardian_intervention_signals(created_at DESC);

CREATE INDEX idx_guardian_operator_casino ON guardian_operator_risk_summary(casino_id);
CREATE INDEX idx_guardian_operator_date ON guardian_operator_risk_summary(summary_date DESC);

CREATE INDEX idx_guardian_province_province ON guardian_province_risk_summary(province);
CREATE INDEX idx_guardian_province_date ON guardian_province_risk_summary(summary_date DESC);

-- Enable RLS
ALTER TABLE guardian_device_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_identity_drift ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_school_hour_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_intervention_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_operator_risk_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_province_risk_summary ENABLE ROW LEVEL SECURITY;
