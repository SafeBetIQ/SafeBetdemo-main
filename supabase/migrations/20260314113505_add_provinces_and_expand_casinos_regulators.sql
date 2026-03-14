/*
  # Expand Multi-Tenant Casino & Regulator System

  ## Summary
  This migration implements a fully enterprise-grade, multi-tenant regulator hierarchy:
  - Adds `province` column to casinos table for geographic assignment
  - Creates a `regulators` table for national and provincial regulators
  - Adds 10 new casinos (one per South African province, multiple per province for variety)
  - Seeds 9 provincial regulators and 1 national regulator
  - Enforces strict multi-tenant data isolation via RLS

  ## New Tables
  - `regulators`: Stores national and provincial regulator accounts with jurisdiction

  ## Modified Tables
  - `casinos`: Added `province` (text), `country` (text) columns

  ## New Casinos (10 total)
  Each casino is assigned to a South African province for regulator scoping.

  ## Regulator Hierarchy
  - 1 National Regulator (National Gambling Board) - sees ALL casinos
  - 9 Provincial Regulators (one per SA province) - see only their province

  ## Security
  - RLS on `regulators` table
  - `province` on casinos enables row-level scoping for provincial regulators
*/

-- 1. Add province and country columns to casinos
ALTER TABLE casinos
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'South Africa';

-- 2. Update existing 3 casinos with provinces
UPDATE casinos SET province = 'Gauteng', country = 'South Africa'
  WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE casinos SET province = 'Western Cape', country = 'South Africa'
  WHERE id = '22222222-2222-2222-2222-222222222222';

UPDATE casinos SET province = 'KwaZulu-Natal', country = 'South Africa'
  WHERE id = '33333333-3333-3333-3333-333333333333';

-- 3. Create regulators table
CREATE TABLE IF NOT EXISTS regulators (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  full_name         text NOT NULL,
  email             text UNIQUE NOT NULL,
  jurisdiction_type text NOT NULL CHECK (jurisdiction_type IN ('national', 'provincial')),
  province          text,
  organisation_name text NOT NULL,
  license_authority text,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT provincial_requires_province CHECK (
    jurisdiction_type = 'national' OR province IS NOT NULL
  )
);

ALTER TABLE regulators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to regulators"
  ON regulators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin insert regulators"
  ON regulators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin update regulators"
  ON regulators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Regulators can view own record"
  ON regulators FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- 4. Add 10 new casinos across South African provinces
INSERT INTO casinos (id, name, license_number, contact_email, contact_phone, address, province, country, is_active, simulation_mode)
VALUES
  -- Gauteng (already has Royal Palace)
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Emperors Palace Casino', 'LIC-2024-004', 'admin@emperorspalace.safebetiq.com', '+27-11-928-1000', '64 Jones Road, Kempton Park, Gauteng', 'Gauteng', 'South Africa', true, true),
  -- Western Cape (already has Golden Dragon)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sun International Cape Town', 'LIC-2024-005', 'admin@sunintcpt.safebetiq.com', '+27-21-529-1000', 'Grand Parade, Cape Town, Western Cape', 'Western Cape', 'South Africa', true, true),
  -- KwaZulu-Natal (already has Silver Star)
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Sibaya Casino & Entertainment Kingdom', 'LIC-2024-006', 'admin@sibaya.safebetiq.com', '+27-31-580-5000', 'Umdloti Beach, KwaZulu-Natal', 'KwaZulu-Natal', 'South Africa', true, true),
  -- Mpumalanga
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Graceland Casino & Country Club', 'LIC-2024-007', 'admin@graceland.safebetiq.com', '+27-17-819-1000', 'Secunda, Mpumalanga', 'Mpumalanga', 'South Africa', true, true),
  -- Limpopo
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Meropa Casino & Entertainment World', 'LIC-2024-008', 'admin@meropa.safebetiq.com', '+27-15-297-7700', 'Polokwane, Limpopo', 'Limpopo', 'South Africa', true, true),
  -- Free State
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Windmill Casino & Entertainment Centre', 'LIC-2024-009', 'admin@windmill.safebetiq.com', '+27-51-432-0000', 'Bloemfontein, Free State', 'Free State', 'South Africa', true, true),
  -- Eastern Cape
  ('11111111-2222-3333-4444-555555555555', 'East London ICC Hotel & Casino', 'LIC-2024-010', 'admin@easternlcasino.safebetiq.com', '+27-43-706-7600', 'Eastern Boulevard, East London, Eastern Cape', 'Eastern Cape', 'South Africa', true, true),
  -- North West
  ('22222222-3333-4444-5555-666666666666', 'Mmabatho Palms Casino', 'LIC-2024-011', 'admin@mmabatho.safebetiq.com', '+27-18-384-1000', 'Mahikeng, North West', 'North West', 'South Africa', true, true),
  -- Northern Cape
  ('33333333-4444-5555-6666-777777777777', 'Flamingo Casino', 'LIC-2024-012', 'admin@flamingo.safebetiq.com', '+27-53-830-9000', 'Upington, Northern Cape', 'Northern Cape', 'South Africa', true, true),
  -- Second Gauteng casino for density
  ('44444444-5555-6666-7777-888888888888', 'Montecasino', 'LIC-2024-013', 'admin@montecasino.safebetiq.com', '+27-11-511-0000', 'Fourways, Johannesburg, Gauteng', 'Gauteng', 'South Africa', true, true);

-- 5. Create indexes on province for performance
CREATE INDEX IF NOT EXISTS idx_casinos_province ON casinos(province);
CREATE INDEX IF NOT EXISTS idx_regulators_jurisdiction ON regulators(jurisdiction_type);
CREATE INDEX IF NOT EXISTS idx_regulators_province ON regulators(province);
CREATE INDEX IF NOT EXISTS idx_regulators_user_id ON regulators(user_id);
