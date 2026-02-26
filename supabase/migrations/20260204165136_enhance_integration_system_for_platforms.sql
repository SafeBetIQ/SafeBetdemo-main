/*
  # Enhance Integration System for Casino Platforms

  1. Updates
    - Add missing columns to integration_providers
    - Create casino_integration_configs table
    - Create integration_webhook_configs table
    - Create integration_api_logs table
    - Create integration_sync_status table

  2. Security
    - RLS enabled on all tables
    - Casino-isolated configurations
    - Audit trail for all changes

  3. Supported Providers
    - WhatsApp/Twilio (messaging)
    - SOFTSWISS (casino platform)
    - Altenar (sports betting)
    - BET Software (casino platform)
    - Playtech PAM (player account management)
*/

-- Add missing columns to integration_providers if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'integration_providers' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE integration_providers ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'integration_providers' 
    AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE integration_providers ADD COLUMN logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'integration_providers' 
    AND column_name = 'documentation_url'
  ) THEN
    ALTER TABLE integration_providers ADD COLUMN documentation_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'integration_providers' 
    AND column_name = 'api_base_url'
  ) THEN
    ALTER TABLE integration_providers ADD COLUMN api_base_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'integration_providers' 
    AND column_name = 'provider_key'
  ) THEN
    ALTER TABLE integration_providers ADD COLUMN provider_key text UNIQUE;
  END IF;
END $$;

-- Casino Integration Configurations
CREATE TABLE IF NOT EXISTS casino_integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  credentials jsonb NOT NULL DEFAULT '{}',
  configuration jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  sync_status text DEFAULT 'pending',
  sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  UNIQUE(casino_id, provider_id)
);

-- Integration Webhook Configurations
CREATE TABLE IF NOT EXISTS integration_webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES casino_integration_configs(id) ON DELETE CASCADE,
  webhook_type text NOT NULL,
  webhook_url text NOT NULL,
  webhook_secret text,
  is_active boolean DEFAULT true,
  last_received_at timestamptz,
  total_received bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Integration API Call Logs
CREATE TABLE IF NOT EXISTS integration_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES casino_integration_configs(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  endpoint text NOT NULL,
  request_payload jsonb,
  response_status integer,
  response_payload jsonb,
  response_time_ms integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Integration Sync Status
CREATE TABLE IF NOT EXISTS integration_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES casino_integration_configs(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  last_sync_at timestamptz,
  records_synced integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  sync_duration_ms integer,
  status text DEFAULT 'idle',
  error_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(config_id, sync_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_casino_integration_configs_casino_id 
  ON casino_integration_configs(casino_id);
CREATE INDEX IF NOT EXISTS idx_casino_integration_configs_provider_id 
  ON casino_integration_configs(provider_id);
CREATE INDEX IF NOT EXISTS idx_casino_integration_configs_enabled 
  ON casino_integration_configs(is_enabled) WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_integration_webhook_configs_config_id 
  ON integration_webhook_configs(config_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_configs_active 
  ON integration_webhook_configs(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_integration_api_logs_config_id 
  ON integration_api_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_logs_created_at 
  ON integration_api_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_status_config_id 
  ON integration_sync_status(config_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_status_updated_at 
  ON integration_sync_status(updated_at DESC);

-- Enable RLS
ALTER TABLE casino_integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for casino_integration_configs
CREATE POLICY "Casino admins can manage own integrations"
  ON casino_integration_configs
  FOR ALL
  TO authenticated
  USING (
    casino_id IN (
      SELECT u.casino_id FROM users u
      WHERE u.id = (SELECT auth.uid())
      AND u.role = 'casino_admin'
    )
  )
  WITH CHECK (
    casino_id IN (
      SELECT u.casino_id FROM users u
      WHERE u.id = (SELECT auth.uid())
      AND u.role = 'casino_admin'
    )
  );

CREATE POLICY "Super admins can manage all integrations"
  ON casino_integration_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Regulators can view all integrations"
  ON casino_integration_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'regulator'
    )
  );

-- RLS Policies for integration_webhook_configs
CREATE POLICY "Casino admins can manage own webhook configs"
  ON integration_webhook_configs
  FOR ALL
  TO authenticated
  USING (
    config_id IN (
      SELECT cic.id FROM casino_integration_configs cic
      JOIN users u ON u.casino_id = cic.casino_id
      WHERE u.id = (SELECT auth.uid())
      AND u.role = 'casino_admin'
    )
  );

CREATE POLICY "Super admins can manage all webhook configs"
  ON integration_webhook_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'super_admin'
    )
  );

-- RLS Policies for integration_api_logs
CREATE POLICY "Casino admins can view own API logs"
  ON integration_api_logs
  FOR SELECT
  TO authenticated
  USING (
    config_id IN (
      SELECT cic.id FROM casino_integration_configs cic
      JOIN users u ON u.casino_id = cic.casino_id
      WHERE u.id = (SELECT auth.uid())
      AND u.role = 'casino_admin'
    )
  );

CREATE POLICY "Super admins can view all API logs"
  ON integration_api_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'super_admin'
    )
  );

-- RLS Policies for integration_sync_status
CREATE POLICY "Casino admins can view own sync status"
  ON integration_sync_status
  FOR SELECT
  TO authenticated
  USING (
    config_id IN (
      SELECT cic.id FROM casino_integration_configs cic
      JOIN users u ON u.casino_id = cic.casino_id
      WHERE u.id = (SELECT auth.uid())
      AND u.role = 'casino_admin'
    )
  );

CREATE POLICY "Super admins can view all sync status"
  ON integration_sync_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'super_admin'
    )
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_casino_integration_configs_updated_at ON casino_integration_configs;
CREATE TRIGGER update_casino_integration_configs_updated_at
  BEFORE UPDATE ON casino_integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

DROP TRIGGER IF EXISTS update_integration_sync_status_updated_at ON integration_sync_status;
CREATE TRIGGER update_integration_sync_status_updated_at
  BEFORE UPDATE ON integration_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();
