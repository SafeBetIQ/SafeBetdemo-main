/*
  # Create Pricing Packages System for SafeBet IQ

  1. New Tables
    - `pricing_packages`
      - Package definitions (Standard, Enterprise, Premium)
      - Pricing information and features
    - `package_modules`
      - Maps which modules are included in each package
    - `casino_packages`
      - Tracks which package each casino is subscribed to
      - Historical tracking of package changes

  2. Package Structure
    - **Standard Package**: Core + Basic Analytics + Basic Compliance + Basic Training
    - **Enterprise Package**: Standard + Advanced AI + More Analytics + Advanced Compliance
    - **Premium Package**: Everything - Full AI suite, all features

  3. Security
    - Enable RLS on all tables
    - Super admins can manage all packages
    - Casino admins can view their package
    - Regulators can view all packages
*/

-- Create pricing packages table
CREATE TABLE IF NOT EXISTS pricing_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  price_monthly numeric(10,2),
  price_annual numeric(10,2),
  features jsonb DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create package modules junction table
CREATE TABLE IF NOT EXISTS package_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES pricing_packages(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES software_modules(id) ON DELETE CASCADE,
  is_included boolean DEFAULT true,
  is_addon boolean DEFAULT false,
  addon_price_monthly numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(package_id, module_id)
);

-- Create casino packages table
CREATE TABLE IF NOT EXISTS casino_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES pricing_packages(id),
  activated_at timestamptz DEFAULT now(),
  activated_by uuid REFERENCES users(id),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_package_modules_package ON package_modules(package_id);
CREATE INDEX IF NOT EXISTS idx_package_modules_module ON package_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_casino_packages_casino ON casino_packages(casino_id);
CREATE INDEX IF NOT EXISTS idx_casino_packages_package ON casino_packages(package_id);
CREATE INDEX IF NOT EXISTS idx_casino_packages_active ON casino_packages(casino_id, is_active);

-- Enable RLS
ALTER TABLE pricing_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pricing_packages
CREATE POLICY "Anyone can view active packages"
  ON pricing_packages FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins manage packages"
  ON pricing_packages FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'super_admin')
  WITH CHECK (get_current_user_role() = 'super_admin');

-- RLS Policies for package_modules
CREATE POLICY "Anyone can view package modules"
  ON package_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins manage package modules"
  ON package_modules FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'super_admin')
  WITH CHECK (get_current_user_role() = 'super_admin');

-- RLS Policies for casino_packages
CREATE POLICY "Super admins view all casino packages"
  ON casino_packages FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Regulators view all casino packages"
  ON casino_packages FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'regulator');

CREATE POLICY "Casino admins view own package"
  ON casino_packages FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'casino_admin' 
    AND EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.casino_id = casino_packages.casino_id
    )
  );

CREATE POLICY "Super admins manage casino packages"
  ON casino_packages FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'super_admin')
  WITH CHECK (get_current_user_role() = 'super_admin');
