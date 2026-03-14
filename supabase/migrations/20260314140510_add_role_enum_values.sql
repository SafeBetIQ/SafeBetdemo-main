/*
  # Add New Role Enum Values

  Adds national_regulator, provincial_regulator, and compliance_officer
  to the user_role enum type. These must be committed in their own transaction
  before being used in RLS policies or inserts.
*/

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'national_regulator';
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'provincial_regulator';
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'compliance_officer';
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN others THEN NULL;
END $$;
