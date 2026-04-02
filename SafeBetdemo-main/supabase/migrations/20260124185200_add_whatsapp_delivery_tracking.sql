/*
  # Add WhatsApp Delivery Tracking

  1. Changes
    - Add `delivery_status` column to `wellbeing_game_invitations` table
    - Track whether messages were sent, simulated, or failed
    - Add index for filtering by delivery status
  
  2. New Columns
    - `delivery_status` (text) - Values: 'sent', 'simulated', 'failed', 'error', 'pending'
    - Used to track actual delivery of WhatsApp/email messages
  
  3. Notes
    - 'sent' = Successfully delivered via Twilio
    - 'simulated' = Logged only (no credentials configured)
    - 'failed' = Twilio returned error
    - 'error' = Exception during sending
    - 'pending' = Not yet attempted
*/

-- Add delivery_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wellbeing_game_invitations' AND column_name = 'delivery_status'
  ) THEN
    ALTER TABLE wellbeing_game_invitations 
    ADD COLUMN delivery_status text DEFAULT 'pending' 
    CHECK (delivery_status IN ('pending', 'sent', 'simulated', 'failed', 'error'));
  END IF;
END $$;

-- Add index for filtering by delivery status
CREATE INDEX IF NOT EXISTS idx_wellbeing_invitations_delivery_status 
ON wellbeing_game_invitations(delivery_status);

-- Update status check to include 'sent' value
ALTER TABLE wellbeing_game_invitations 
DROP CONSTRAINT IF EXISTS wellbeing_game_invitations_status_check;

ALTER TABLE wellbeing_game_invitations 
ADD CONSTRAINT wellbeing_game_invitations_status_check 
CHECK (status IN ('pending', 'sent', 'opened', 'completed', 'expired', 'abandoned'));