/*
  # Seed Operator Integrations for 5 Demo Casinos

  ## Summary
  - Adds Evolution Gaming provider to integration_providers
  - Seeds casino_integration_configs for 5 demo casinos × 5 providers
  - Adds operator_integrations rows (provider_type = 'casino_management')
*/

-- Add Evolution Gaming provider
INSERT INTO integration_providers (
  provider_name, provider_type, display_name, description,
  provider_key, is_active, api_base_url, webhook_support, required_fields
)
VALUES (
  'evolution', 'live_dealer', 'Evolution Gaming',
  'Live dealer gaming platform - world leader in live casino',
  'evolution', true, 'https://api.evolutiongaming.com/v1', true,
  '[{"key":"api_key","label":"API Key","type":"text","required":true},{"key":"casino_key","label":"Casino Key","type":"password","required":true},{"key":"environment","label":"Environment","type":"select","options":["production","staging"],"required":true}]'
)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_active    = EXCLUDED.is_active;

-- casino_integration_configs: demo skeleton for all 5 casinos × 5 providers
INSERT INTO casino_integration_configs (casino_id, provider_id, is_enabled, credentials, configuration)
SELECT
  c.id,
  p.id,
  false,
  jsonb_build_object(
    'environment', 'staging',
    'api_key', 'DEMO_' || upper(substr(md5(c.id::text || p.provider_key), 1, 16)),
    'note', 'Replace with real credentials to activate'
  ),
  jsonb_build_object('sync_frequency_minutes', 60, 'auto_sync', false)
FROM casinos c
JOIN integration_providers p ON p.provider_key IN ('softswiss','altenar','bet_software','playtech_pam','evolution')
WHERE c.license_number IN (
  'KZN-PGCB-2019-001','GT-PAGC-2018-004','GT-PAGC-2020-007',
  'WC-WCGRB-2021-003','GT-PAGC-2022-011'
)
ON CONFLICT (casino_id, provider_id) DO NOTHING;

-- operator_integrations rows: provider_type must be 'casino_management'
INSERT INTO operator_integrations (casino_id, provider_name, provider_type, status, config)
SELECT
  c.id,
  p.display_name,
  'casino_management',
  'pending',
  jsonb_build_object('provider_key', p.provider_key, 'note', 'Demo — add credentials to activate')
FROM casinos c
JOIN integration_providers p ON p.provider_key IN ('softswiss','altenar','bet_software','playtech_pam','evolution')
WHERE c.license_number IN (
  'KZN-PGCB-2019-001','GT-PAGC-2018-004','GT-PAGC-2020-007',
  'WC-WCGRB-2021-003','GT-PAGC-2022-011'
)
ON CONFLICT (casino_id, provider_name) DO NOTHING;
