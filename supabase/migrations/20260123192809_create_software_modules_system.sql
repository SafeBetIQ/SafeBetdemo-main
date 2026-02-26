/*
  # Create Software Modules and Add-ons System

  ## Overview
  This migration creates a system for managing software modules/add-ons that can be assigned
  to individual casinos. This enables an upsell model where casinos only have access to
  the features they've purchased.

  ## New Tables
  
  ### `software_modules`
  Defines all available software modules/features in the platform
  - `id` (uuid, primary key)
  - `name` (text) - Module name (e.g., "Behavioral Risk Intelligence")
  - `slug` (text) - URL-safe identifier (e.g., "behavioral-risk")
  - `description` (text) - What the module does
  - `category` (text) - Module category (core, analytics, compliance, training)
  - `price_tier` (text) - Pricing level (included, standard, premium, enterprise)
  - `is_active` (boolean) - Whether module is available for purchase
  - `sort_order` (integer) - Display order
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `casino_modules`
  Tracks which modules each casino has access to
  - `id` (uuid, primary key)
  - `casino_id` (uuid, foreign key to users)
  - `module_id` (uuid, foreign key to software_modules)
  - `enabled_at` (timestamptz) - When the module was enabled
  - `enabled_by` (uuid, foreign key to users) - Super admin who enabled it
  - `expires_at` (timestamptz, nullable) - For trial or subscription expiry
  - `created_at` (timestamptz)

  ## Security
  - Super admins can manage all module assignments
  - Casino admins can only view their own modules (read-only)
  - Regular staff cannot access module information

  ## Indexes
  - Index on casino_id for fast lookups
  - Index on module_slug for quick checks
  - Unique constraint on (casino_id, module_id)
*/

-- Create software_modules table
CREATE TABLE IF NOT EXISTS software_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'core',
  price_tier text NOT NULL DEFAULT 'standard',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create casino_modules junction table
CREATE TABLE IF NOT EXISTS casino_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES software_modules(id) ON DELETE CASCADE,
  enabled_at timestamptz DEFAULT now(),
  enabled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(casino_id, module_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_software_modules_slug ON software_modules(slug);
CREATE INDEX IF NOT EXISTS idx_software_modules_category ON software_modules(category);
CREATE INDEX IF NOT EXISTS idx_software_modules_active ON software_modules(is_active);
CREATE INDEX IF NOT EXISTS idx_casino_modules_casino_id ON casino_modules(casino_id);
CREATE INDEX IF NOT EXISTS idx_casino_modules_module_id ON casino_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_casino_modules_enabled_by ON casino_modules(enabled_by);

-- Enable RLS
ALTER TABLE software_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_modules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for software_modules

-- Super admins can do everything with modules
CREATE POLICY "Super admins can manage software modules"
  ON software_modules FOR ALL
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

-- Casino admins and regulators can view active modules
CREATE POLICY "Casino admins and regulators can view active modules"
  ON software_modules FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('casino_admin', 'regulator')
    )
  );

-- RLS Policies for casino_modules

-- Super admins can manage all casino module assignments
CREATE POLICY "Super admins can manage casino modules"
  ON casino_modules FOR ALL
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

-- Casino admins can view their own modules
CREATE POLICY "Casino admins can view own modules"
  ON casino_modules FOR SELECT
  TO authenticated
  USING (
    casino_id = auth.uid()
    OR casino_id IN (
      SELECT casino_id FROM staff
      WHERE staff.auth_user_id = auth.uid()
    )
  );

-- Regulators can view all casino modules for oversight
CREATE POLICY "Regulators can view all casino modules"
  ON casino_modules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'regulator'
    )
  );

-- Create helper function to check if a casino has a specific module
CREATE OR REPLACE FUNCTION casino_has_module(p_casino_id uuid, p_module_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM casino_modules cm
    JOIN software_modules sm ON sm.id = cm.module_id
    WHERE cm.casino_id = p_casino_id
    AND sm.slug = p_module_slug
    AND sm.is_active = true
    AND (cm.expires_at IS NULL OR cm.expires_at > now())
  );
END;
$$;

-- Create function to get all modules for a casino
CREATE OR REPLACE FUNCTION get_casino_modules(p_casino_id uuid)
RETURNS TABLE (
  module_id uuid,
  name text,
  slug text,
  description text,
  category text,
  enabled_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    sm.name,
    sm.slug,
    sm.description,
    sm.category,
    cm.enabled_at,
    cm.expires_at
  FROM casino_modules cm
  JOIN software_modules sm ON sm.id = cm.module_id
  WHERE cm.casino_id = p_casino_id
  AND sm.is_active = true
  AND (cm.expires_at IS NULL OR cm.expires_at > now())
  ORDER BY sm.category, sm.sort_order, sm.name;
END;
$$;