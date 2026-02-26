/*
  # Performance Optimization - Add Missing Indexes

  1. Indexes Added
    - `gaming_sessions` table:
      - `idx_gaming_sessions_player_id_start_time` - For player session history queries
      - `idx_gaming_sessions_casino_id_start_time` - For casino session reports
      - `idx_gaming_sessions_is_active` - For active session queries
    
    - `player_bets` table:
      - `idx_player_bets_player_id_timestamp` - For player betting history
      - `idx_player_bets_session_id` - For session bet aggregation
    
    - `interventions` table:
      - `idx_interventions_player_id_created_at` - For player intervention history
      - `idx_interventions_casino_id_created_at` - For casino intervention reports
      - `idx_interventions_status` - For pending intervention queries
    
    - `compliance_audit_logs` table:
      - `idx_compliance_audit_logs_casino_id_timestamp` - For compliance reports
      - `idx_compliance_audit_logs_player_id_timestamp` - For player audit trails
      - `idx_compliance_audit_logs_risk_level` - For risk level filtering
    
    - `demo_behavioral_insights` table:
      - `idx_demo_behavioral_insights_player_id` - For player behavioral queries
      - `idx_demo_behavioral_insights_casino_id` - For casino insights aggregation
    
    - `demo_esg_scores` table:
      - `idx_demo_esg_scores_casino_id` - For casino ESG reports
    
    - `behavioral_risk_profiles` table:
      - `idx_behavioral_risk_profiles_player_id` - For player risk tracking
      - `idx_behavioral_risk_profiles_casino_id_analyzed_at` - For casino risk reports
    
    - `intervention_history` table:
      - `idx_intervention_history_player_id_triggered_at` - For player intervention tracking
      - `idx_intervention_history_casino_id_triggered_at` - For casino intervention analytics

  2. Impact
    - Significant query performance improvement for dashboard loads
    - Faster report generation
    - Reduced database CPU usage
    - Better scalability for large datasets
*/

-- Gaming sessions indexes
CREATE INDEX IF NOT EXISTS idx_gaming_sessions_player_id_start_time 
ON gaming_sessions(player_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_gaming_sessions_casino_id_start_time 
ON gaming_sessions(casino_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_gaming_sessions_is_active 
ON gaming_sessions(is_active) WHERE is_active = true;

-- Player bets indexes
CREATE INDEX IF NOT EXISTS idx_player_bets_player_id_timestamp 
ON player_bets(player_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_player_bets_session_id 
ON player_bets(session_id);

-- Interventions indexes
CREATE INDEX IF NOT EXISTS idx_interventions_player_id_created_at 
ON interventions(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interventions_casino_id_created_at 
ON interventions(casino_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interventions_status 
ON interventions(status);

-- Compliance audit logs indexes
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_casino_id_timestamp 
ON compliance_audit_logs(casino_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_player_id_timestamp 
ON compliance_audit_logs(player_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_risk_level 
ON compliance_audit_logs(risk_level);

-- Demo behavioral insights indexes
CREATE INDEX IF NOT EXISTS idx_demo_behavioral_insights_player_id 
ON demo_behavioral_insights(player_id);

CREATE INDEX IF NOT EXISTS idx_demo_behavioral_insights_casino_id 
ON demo_behavioral_insights(casino_id);

-- Demo ESG scores indexes
CREATE INDEX IF NOT EXISTS idx_demo_esg_scores_casino_id 
ON demo_esg_scores(casino_id);

-- Behavioral risk profiles indexes
CREATE INDEX IF NOT EXISTS idx_behavioral_risk_profiles_player_id 
ON behavioral_risk_profiles(player_id);

CREATE INDEX IF NOT EXISTS idx_behavioral_risk_profiles_casino_id_analyzed_at 
ON behavioral_risk_profiles(casino_id, analyzed_at DESC);

-- Intervention history indexes
CREATE INDEX IF NOT EXISTS idx_intervention_history_player_id_triggered_at 
ON intervention_history(player_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_intervention_history_casino_id_triggered_at 
ON intervention_history(casino_id, triggered_at DESC);
