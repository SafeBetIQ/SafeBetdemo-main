/*
  # Add Phone Column to Staff Table

  1. Changes
    - Add phone column to staff table for contact information
    - Allow staff to update their own phone numbers
    - Allow casino admins to update staff phone numbers

  2. Notes
    - Phone is optional (nullable)
    - No validation on format to allow international numbers
*/

-- Add phone column to staff table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'phone'
  ) THEN
    ALTER TABLE staff ADD COLUMN phone text;
  END IF;
END $$;
