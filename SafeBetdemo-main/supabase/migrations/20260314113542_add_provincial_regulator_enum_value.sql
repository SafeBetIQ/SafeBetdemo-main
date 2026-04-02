/*
  # Add provincial_regulator to user_role enum

  This must be a separate migration from usage of the new enum value,
  as PostgreSQL requires the enum addition to be committed before use.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'provincial_regulator'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'provincial_regulator';
  END IF;
END $$;
