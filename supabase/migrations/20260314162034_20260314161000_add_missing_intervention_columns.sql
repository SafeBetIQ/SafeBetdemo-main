/*
  # Add missing columns to player_protection_interventions

  ## Summary
  Several frontend components reference `dispatch_status` and `triggered_at` on the
  `player_protection_interventions` table, but these columns do not exist.
  This migration adds them with sensible defaults derived from existing columns,
  so all dashboards and components work correctly without code changes.

  ## Changes
  - `player_protection_interventions`:
    - Add `dispatch_status` (text) — defaults to 'sent', with values: pending, sent, delivered, failed
    - Add `triggered_at` (timestamptz) — defaults to `created_at` value
    - Add `risk_score_at_trigger` (numeric) — defaults to `risk_score`
    - Add `intervention_successful` (boolean) — derived from `outcome`
    - Add `auto_triggered` (boolean) — defaults to true
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_protection_interventions' AND column_name='dispatch_status') THEN
    ALTER TABLE player_protection_interventions ADD COLUMN dispatch_status text DEFAULT 'sent'
      CHECK (dispatch_status IN ('pending','sent','delivered','failed'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_protection_interventions' AND column_name='triggered_at') THEN
    ALTER TABLE player_protection_interventions ADD COLUMN triggered_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_protection_interventions' AND column_name='risk_score_at_trigger') THEN
    ALTER TABLE player_protection_interventions ADD COLUMN risk_score_at_trigger numeric;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_protection_interventions' AND column_name='intervention_successful') THEN
    ALTER TABLE player_protection_interventions ADD COLUMN intervention_successful boolean DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_protection_interventions' AND column_name='auto_triggered') THEN
    ALTER TABLE player_protection_interventions ADD COLUMN auto_triggered boolean DEFAULT true;
  END IF;
END $$;

UPDATE player_protection_interventions
SET
  triggered_at = COALESCE(triggered_at, created_at),
  risk_score_at_trigger = COALESCE(risk_score_at_trigger, risk_score),
  dispatch_status = COALESCE(dispatch_status,
    CASE
      WHEN outcome = 'successful' THEN 'delivered'
      WHEN outcome = 'failed' THEN 'failed'
      WHEN outcome IS NULL THEN 'pending'
      ELSE 'sent'
    END
  ),
  intervention_successful = COALESCE(intervention_successful, outcome = 'successful');

CREATE INDEX IF NOT EXISTS idx_ppi_triggered_at ON player_protection_interventions(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppi_dispatch_status ON player_protection_interventions(dispatch_status);
CREATE INDEX IF NOT EXISTS idx_ppi_casino_triggered ON player_protection_interventions(casino_id, triggered_at DESC);
