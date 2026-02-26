/*
  # Create Revenue Protection Intelligence (RPI) System

  ## Overview
  Translates player risk interventions into measurable casino revenue protection metrics.
  Converts AI risk monitoring into financial impact analytics.

  ## Tables Created
  1. **revenue_protection_events** - Individual protection events with financial impact
  2. **revenue_protection_monthly** - Aggregated monthly metrics per casino
  3. **revenue_protection_calculations** - Audit trail for calculation methodology

  ## Financial Metrics Tracked
  - Player Lifetime Value (LTV) Saved
  - Fraud Losses Prevented
  - Chargebacks/Disputes Avoided
  - VIP Retention Value
  - Extreme Loss Drop-off Reduction

  ## Security
  - Full RLS enabled on all tables
  - Casino staff can only view their own casino data
  - Super admins and regulators have full access
  - Audit logging for all calculations
*/

-- Revenue Protection Events Table
CREATE TABLE IF NOT EXISTS revenue_protection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'ltv_saved',
    'fraud_prevented',
    'chargeback_avoided',
    'vip_retained',
    'dropout_prevented'
  )),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  financial_impact_zar numeric(12, 2) NOT NULL DEFAULT 0,
  intervention_id uuid REFERENCES ai_intervention_recommendations(id) ON DELETE SET NULL,
  calculation_method text NOT NULL,
  calculation_details jsonb DEFAULT '{}',
  player_risk_before integer,
  player_risk_after integer,
  confidence_score numeric(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rpe_casino_date ON revenue_protection_events(casino_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_rpe_player ON revenue_protection_events(player_id);
CREATE INDEX IF NOT EXISTS idx_rpe_event_type ON revenue_protection_events(event_type);
CREATE INDEX IF NOT EXISTS idx_rpe_created_at ON revenue_protection_events(created_at DESC);

-- Revenue Protection Monthly Aggregates
CREATE TABLE IF NOT EXISTS revenue_protection_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  month date NOT NULL,
  ltv_saved_zar numeric(12, 2) DEFAULT 0,
  fraud_prevented_zar numeric(12, 2) DEFAULT 0,
  chargebacks_avoided_zar numeric(12, 2) DEFAULT 0,
  vip_retained_zar numeric(12, 2) DEFAULT 0,
  dropout_prevented_zar numeric(12, 2) DEFAULT 0,
  total_protected_zar numeric(12, 2) GENERATED ALWAYS AS (
    ltv_saved_zar + fraud_prevented_zar + chargebacks_avoided_zar + 
    vip_retained_zar + dropout_prevented_zar
  ) STORED,
  events_count integer DEFAULT 0,
  players_protected_count integer DEFAULT 0,
  roi_multiple numeric(8, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(casino_id, month)
);

CREATE INDEX IF NOT EXISTS idx_rpm_casino_month ON revenue_protection_monthly(casino_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_rpm_total_protected ON revenue_protection_monthly(total_protected_zar DESC);

-- Revenue Protection Calculation Metadata
CREATE TABLE IF NOT EXISTS revenue_protection_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  calculation_type text NOT NULL,
  input_parameters jsonb NOT NULL,
  output_value numeric(12, 2) NOT NULL,
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  methodology text NOT NULL,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rpc_casino ON revenue_protection_calculations(casino_id);
CREATE INDEX IF NOT EXISTS idx_rpc_date ON revenue_protection_calculations(calculation_date DESC);

-- Enable RLS
ALTER TABLE revenue_protection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_protection_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_protection_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for revenue_protection_events
CREATE POLICY "Super admins access all protection events"
  ON revenue_protection_events FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
  ));

CREATE POLICY "Casino staff view own protection events"
  ON revenue_protection_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff 
    WHERE staff.auth_user_id = auth.uid() 
    AND staff.casino_id = revenue_protection_events.casino_id
  ));

CREATE POLICY "Regulators view all protection events"
  ON revenue_protection_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator'
  ));

-- RLS Policies for revenue_protection_monthly
CREATE POLICY "Super admins access all monthly metrics"
  ON revenue_protection_monthly FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
  ));

CREATE POLICY "Casino staff view own monthly metrics"
  ON revenue_protection_monthly FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff 
    WHERE staff.auth_user_id = auth.uid() 
    AND staff.casino_id = revenue_protection_monthly.casino_id
  ));

CREATE POLICY "Regulators view all monthly metrics"
  ON revenue_protection_monthly FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator'
  ));

-- RLS Policies for revenue_protection_calculations
CREATE POLICY "Super admins access all calculations"
  ON revenue_protection_calculations FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
  ));

CREATE POLICY "Casino staff view own calculations"
  ON revenue_protection_calculations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff 
    WHERE staff.auth_user_id = auth.uid() 
    AND staff.casino_id = revenue_protection_calculations.casino_id
  ));

CREATE POLICY "Regulators view all calculations"
  ON revenue_protection_calculations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator'
  ));

-- Function to update monthly aggregates
CREATE OR REPLACE FUNCTION update_revenue_protection_monthly()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO revenue_protection_monthly (
    casino_id,
    month,
    ltv_saved_zar,
    fraud_prevented_zar,
    chargebacks_avoided_zar,
    vip_retained_zar,
    dropout_prevented_zar,
    events_count,
    players_protected_count
  )
  VALUES (
    NEW.casino_id,
    DATE_TRUNC('month', NEW.event_date)::date,
    CASE WHEN NEW.event_type = 'ltv_saved' THEN NEW.financial_impact_zar ELSE 0 END,
    CASE WHEN NEW.event_type = 'fraud_prevented' THEN NEW.financial_impact_zar ELSE 0 END,
    CASE WHEN NEW.event_type = 'chargeback_avoided' THEN NEW.financial_impact_zar ELSE 0 END,
    CASE WHEN NEW.event_type = 'vip_retained' THEN NEW.financial_impact_zar ELSE 0 END,
    CASE WHEN NEW.event_type = 'dropout_prevented' THEN NEW.financial_impact_zar ELSE 0 END,
    1,
    1
  )
  ON CONFLICT (casino_id, month) DO UPDATE SET
    ltv_saved_zar = revenue_protection_monthly.ltv_saved_zar + 
      CASE WHEN NEW.event_type = 'ltv_saved' THEN NEW.financial_impact_zar ELSE 0 END,
    fraud_prevented_zar = revenue_protection_monthly.fraud_prevented_zar + 
      CASE WHEN NEW.event_type = 'fraud_prevented' THEN NEW.financial_impact_zar ELSE 0 END,
    chargebacks_avoided_zar = revenue_protection_monthly.chargebacks_avoided_zar + 
      CASE WHEN NEW.event_type = 'chargeback_avoided' THEN NEW.financial_impact_zar ELSE 0 END,
    vip_retained_zar = revenue_protection_monthly.vip_retained_zar + 
      CASE WHEN NEW.event_type = 'vip_retained' THEN NEW.financial_impact_zar ELSE 0 END,
    dropout_prevented_zar = revenue_protection_monthly.dropout_prevented_zar + 
      CASE WHEN NEW.event_type = 'dropout_prevented' THEN NEW.financial_impact_zar ELSE 0 END,
    events_count = revenue_protection_monthly.events_count + 1,
    players_protected_count = (
      SELECT COUNT(DISTINCT player_id) 
      FROM revenue_protection_events 
      WHERE casino_id = NEW.casino_id 
      AND DATE_TRUNC('month', event_date) = DATE_TRUNC('month', NEW.event_date)
    ),
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update monthly aggregates
CREATE TRIGGER update_monthly_aggregates_trigger
  AFTER INSERT ON revenue_protection_events
  FOR EACH ROW
  EXECUTE FUNCTION update_revenue_protection_monthly();

-- Function to calculate ROI
CREATE OR REPLACE FUNCTION calculate_rpi_roi(
  p_casino_id uuid,
  p_month date
) RETURNS numeric AS $$
DECLARE
  v_total_protected numeric;
  v_platform_cost numeric;
  v_roi numeric;
BEGIN
  SELECT total_protected_zar INTO v_total_protected
  FROM revenue_protection_monthly
  WHERE casino_id = p_casino_id AND month = p_month;
  
  -- Estimate platform cost (configurable per casino)
  v_platform_cost := 50000; -- Base monthly cost R50,000
  
  IF v_total_protected IS NULL OR v_total_protected = 0 THEN
    RETURN 0;
  END IF;
  
  v_roi := v_total_protected / v_platform_cost;
  
  RETURN ROUND(v_roi, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
