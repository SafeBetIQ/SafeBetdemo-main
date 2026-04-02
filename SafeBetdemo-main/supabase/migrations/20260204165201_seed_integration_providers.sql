/*
  # Seed Integration Providers

  1. Providers Added
    - WhatsApp/Twilio (messaging)
    - SOFTSWISS (casino platform)
    - Altenar (sports betting)
    - BET Software (casino platform)
    - Playtech PAM (player account management)

  2. Configuration Details
    - Required credentials for each provider
    - API endpoints and documentation
    - Webhook support configuration
*/

-- Clear existing providers and insert comprehensive set
DELETE FROM integration_providers;

-- WhatsApp/Twilio
INSERT INTO integration_providers (
  provider_key,
  provider_name,
  provider_type,
  display_name,
  description,
  required_fields,
  logo_url,
  documentation_url,
  api_base_url,
  webhook_support,
  is_active
) VALUES (
  'twilio_whatsapp',
  'twilio_whatsapp',
  'messaging',
  'WhatsApp Business (via Twilio)',
  'Send WhatsApp messages to players for responsible gambling interventions and wellbeing game invitations',
  '[
    {"name": "account_sid", "label": "Account SID", "type": "text", "required": true},
    {"name": "auth_token", "label": "Auth Token", "type": "password", "required": true},
    {"name": "whatsapp_number", "label": "WhatsApp Business Number", "type": "tel", "required": true, "placeholder": "whatsapp:+1234567890"}
  ]'::jsonb,
  'https://www.twilio.com/brand/logo/red',
  'https://www.twilio.com/docs/whatsapp/api',
  'https://api.twilio.com/2010-04-01',
  true,
  true
);

-- SOFTSWISS
INSERT INTO integration_providers (
  provider_key,
  provider_name,
  provider_type,
  display_name,
  description,
  required_fields,
  logo_url,
  documentation_url,
  api_base_url,
  webhook_support,
  is_active
) VALUES (
  'softswiss',
  'softswiss',
  'casino_platform',
  'SOFTSWISS Casino Platform',
  'Integrate with SOFTSWISS platform for player data, transactions, and game history synchronization',
  '[
    {"name": "api_key", "label": "API Key", "type": "password", "required": true},
    {"name": "api_secret", "label": "API Secret", "type": "password", "required": true},
    {"name": "casino_id", "label": "Casino ID", "type": "text", "required": true},
    {"name": "environment", "label": "Environment", "type": "select", "options": ["production", "staging"], "required": true}
  ]'::jsonb,
  'https://www.softswiss.com/wp-content/themes/softswiss/assets/img/logo.svg',
  'https://casino-api.softswiss.com/docs',
  'https://casino-api.softswiss.com/v1',
  true,
  true
);

-- Altenar
INSERT INTO integration_providers (
  provider_key,
  provider_name,
  provider_type,
  display_name,
  description,
  required_fields,
  logo_url,
  documentation_url,
  api_base_url,
  webhook_support,
  is_active
) VALUES (
  'altenar',
  'altenar',
  'sports_betting',
  'Altenar Sports Betting',
  'Integrate with Altenar sportsbook for betting data, player activity, and risk monitoring',
  '[
    {"name": "api_username", "label": "API Username", "type": "text", "required": true},
    {"name": "api_password", "label": "API Password", "type": "password", "required": true},
    {"name": "operator_id", "label": "Operator ID", "type": "text", "required": true},
    {"name": "brand_id", "label": "Brand ID", "type": "text", "required": true}
  ]'::jsonb,
  'https://www.altenar.com/wp-content/uploads/2021/03/altenar-logo.svg',
  'https://docs.altenar.com/api',
  'https://api.altenar.com',
  true,
  true
);

-- BET Software
INSERT INTO integration_providers (
  provider_key,
  provider_name,
  provider_type,
  display_name,
  description,
  required_fields,
  logo_url,
  documentation_url,
  api_base_url,
  webhook_support,
  is_active
) VALUES (
  'bet_software',
  'bet_software',
  'casino_platform',
  'BET Software Platform',
  'Integrate with BET Software for complete casino management including player accounts and game data',
  '[
    {"name": "partner_id", "label": "Partner ID", "type": "text", "required": true},
    {"name": "api_key", "label": "API Key", "type": "password", "required": true},
    {"name": "hash_key", "label": "Hash Key", "type": "password", "required": true},
    {"name": "site_id", "label": "Site ID", "type": "text", "required": true}
  ]'::jsonb,
  'https://www.betsoftware.com/images/logo.png',
  'https://betsoftware.com/api-documentation',
  'https://api.betsoftware.com/v2',
  true,
  true
);

-- Playtech PAM
INSERT INTO integration_providers (
  provider_key,
  provider_name,
  provider_type,
  display_name,
  description,
  required_fields,
  logo_url,
  documentation_url,
  api_base_url,
  webhook_support,
  is_active
) VALUES (
  'playtech_pam',
  'playtech_pam',
  'pam',
  'Playtech PAM (Player Account Management)',
  'Integrate with Playtech PAM for player account management, responsible gaming tools, and compliance monitoring',
  '[
    {"name": "client_id", "label": "Client ID", "type": "text", "required": true},
    {"name": "client_secret", "label": "Client Secret", "type": "password", "required": true},
    {"name": "license_key", "label": "License Key", "type": "password", "required": true},
    {"name": "region", "label": "Region", "type": "select", "options": ["eu", "us", "asia", "africa"], "required": true}
  ]'::jsonb,
  'https://www.playtech.com/wp-content/themes/playtech/assets/img/logo.svg',
  'https://developer.playtech.com/pam/api',
  'https://pam-api.playtech.com/v3',
  true,
  true
);
