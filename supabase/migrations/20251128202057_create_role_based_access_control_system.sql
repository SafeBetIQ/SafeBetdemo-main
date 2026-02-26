/*
  # Role-Based Access Control System for SafeBet IQ B2B Platform

  ## Overview
  This migration creates a comprehensive role-based access control system for SafeBet IQ,
  a strictly B2B AI Risk & Compliance Platform for internal casino operations teams.

  ## New User Roles
  This replaces the generic role system with specific internal roles:
  - SUPPORT: Basic alert viewing (Player Risk Score™ only)
  - COMPLIANCE: Player Risk Score™ + intervention logging
  - RISK_ANALYST: Full Behavioral Risk Intelligence™ dashboard access
  - EXECUTIVE: ESG Gambling Sustainability Score™ + financial reports
  - REGULATOR: Read-only access with CSV/PDF export capabilities

  ## Important Notes
  1. **NO PLAYER ACCESS**: Players NEVER access this system
  2. **Strictly B2B**: For compliance teams, risk analysts, executives, regulators ONLY
  3. **Anonymized Data**: All player identities are anonymized in demo mode
  4. **Legal Compliance**: All dashboards include mandatory disclaimers

  ## Changes
  1. New user_role enum with 5 specific internal roles
  2. Add user_role column to users table
  3. Add user_role column to staff table
  4. Create role_permissions table for granular access control
  5. Update RLS policies to enforce role-based access
*/

-- Create new enum for internal B2B roles
DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM (
    'SUPPORT',
    'COMPLIANCE', 
    'RISK_ANALYST',
    'EXECUTIVE',
    'REGULATOR'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add user_role column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'user_role'
  ) THEN
    ALTER TABLE users ADD COLUMN user_role user_role_type DEFAULT 'SUPPORT';
  END IF;
END $$;

-- Add user_role column to staff table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'user_role'
  ) THEN
    ALTER TABLE staff ADD COLUMN user_role user_role_type DEFAULT 'SUPPORT';
  END IF;
END $$;

-- Create role permissions table for granular access control
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role_type NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_export boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, module)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Seed role permissions
INSERT INTO role_permissions (role, module, can_view, can_edit, can_export, can_delete) VALUES
  -- SUPPORT: Basic alerts only
  ('SUPPORT', 'player_risk_score', true, false, false, false),
  ('SUPPORT', 'operational_alerts', true, false, false, false),
  
  -- COMPLIANCE: Risk score + intervention logging
  ('COMPLIANCE', 'player_risk_score', true, true, false, false),
  ('COMPLIANCE', 'interventions', true, true, false, false),
  ('COMPLIANCE', 'compliance_overview', true, false, true, false),
  
  -- RISK_ANALYST: Full BRI access
  ('RISK_ANALYST', 'player_risk_score', true, true, true, false),
  ('RISK_ANALYST', 'behavioral_risk_intelligence', true, true, true, false),
  ('RISK_ANALYST', 'interventions', true, true, true, false),
  ('RISK_ANALYST', 'demo_mode', true, false, true, false),
  
  -- EXECUTIVE: ESG + financial reports
  ('EXECUTIVE', 'esg_dashboard', true, false, true, false),
  ('EXECUTIVE', 'casino_comparison', true, false, true, false),
  ('EXECUTIVE', 'financial_reports', true, false, true, false),
  ('EXECUTIVE', 'demo_mode', true, false, true, false),
  
  -- REGULATOR: Read-only + export everything
  ('REGULATOR', 'player_risk_score', true, false, true, false),
  ('REGULATOR', 'behavioral_risk_intelligence', true, false, true, false),
  ('REGULATOR', 'esg_dashboard', true, false, true, false),
  ('REGULATOR', 'compliance_overview', true, false, true, false),
  ('REGULATOR', 'audit_logs', true, false, true, false),
  ('REGULATOR', 'demo_mode', true, false, true, false)
ON CONFLICT (role, module) DO NOTHING;

-- RLS policies for role_permissions
CREATE POLICY "All authenticated users can view role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Update existing users with default roles based on their current role
UPDATE users SET user_role = 'EXECUTIVE' WHERE role = 'super_admin';
UPDATE users SET user_role = 'RISK_ANALYST' WHERE role = 'casino_admin';
UPDATE users SET user_role = 'REGULATOR' WHERE role = 'regulator';

-- Update existing staff with default roles based on their role column
UPDATE staff SET user_role = 'COMPLIANCE' WHERE role::text LIKE '%manager%';
UPDATE staff SET user_role = 'RISK_ANALYST' WHERE role::text LIKE '%analyst%';
UPDATE staff SET user_role = 'SUPPORT' WHERE user_role IS NULL OR user_role = 'SUPPORT';

-- Create indexes for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_user_role ON users(user_role);
CREATE INDEX IF NOT EXISTS idx_staff_user_role ON staff(user_role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
