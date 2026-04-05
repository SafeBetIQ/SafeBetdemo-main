/*
  # Multi-Channel Intervention Dispatch Upgrade

  ## Changes
  1. Drop FK on intervention_delivery_queue.player_id → players(id)
     - Simulated / external player UUIDs don't exist in the players table.
     - Same root cause that was fixed for intervention_history and
       behavioral_risk_profiles in migration 20260404020000.

  2. Fix is_regulator() to include national_regulator and provincial_regulator
     - Original function only matched role = 'regulator'.
     - Downstream SELECT policies inherit this gap.

  3. Ensure intervention_delivery_queue has a regulator SELECT policy
     covering national_regulator.
*/

-- ── 1. Drop FK so simulated player UUIDs can be inserted ─────────────────────
ALTER TABLE intervention_delivery_queue
  DROP CONSTRAINT IF EXISTS intervention_delivery_queue_player_id_fkey;

-- ── 2. Widen is_regulator() to cover all regulator roles ─────────────────────
CREATE OR REPLACE FUNCTION is_regulator()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role IN ('regulator', 'national_regulator', 'provincial_regulator')
    FROM public.users
    WHERE id = auth.uid()
  );
END;
$$;

-- ── 3. Drop + recreate delivery-queue regulator SELECT policy ─────────────────
DROP POLICY IF EXISTS "Regulators view all delivery queue"
  ON intervention_delivery_queue;

CREATE POLICY "Regulators view all delivery queue"
  ON intervention_delivery_queue FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('regulator', 'national_regulator', 'provincial_regulator')
    )
  );

-- ── 4. Ensure REPLICA IDENTITY FULL on delivery queue (for realtime) ─────────
ALTER TABLE intervention_delivery_queue REPLICA IDENTITY FULL;
