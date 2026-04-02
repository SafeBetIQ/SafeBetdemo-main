-- Test creating just one Guardian table
CREATE TABLE IF NOT EXISTS guardian_minor_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  risk_score decimal(6,3) NOT NULL DEFAULT 0.000 CHECK (risk_score >= 0.000 AND risk_score <= 100.000),
  risk_category text NOT NULL CHECK (risk_category IN ('Low', 'Medium', 'High', 'Critical')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guardian_minor_risk_scores ENABLE ROW LEVEL SECURITY;
