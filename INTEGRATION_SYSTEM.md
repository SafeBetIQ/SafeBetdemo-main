# Casino Platform Integration System

## Overview

The SafeBet IQ platform now includes a comprehensive, secure, and scalable integration system that allows each casino to connect with multiple external platforms while maintaining complete data isolation and security.

## Supported Platforms

### 1. **WhatsApp/Twilio** (Messaging)
- Send WhatsApp messages for responsible gambling interventions
- Deliver wellbeing game invitations
- Real-time player communication

### 2. **SOFTSWISS** (Casino Platform)
- Player data synchronization
- Transaction history
- Game session data
- Real-time casino metrics

### 3. **Altenar** (Sports Betting)
- Sports betting activity tracking
- Player betting patterns
- Risk monitoring for sports bets

### 4. **BET Software** (Casino Platform)
- Complete casino management integration
- Player account synchronization
- Game history and analytics

### 5. **Playtech PAM** (Player Account Management)
- Player account management
- Responsible gaming tools integration
- Compliance monitoring
- Self-exclusion management

## Architecture

### Database Schema

#### **integration_providers**
Master table of all available integration providers with configuration schemas.

```sql
- id: UUID (Primary Key)
- provider_key: text (unique identifier)
- provider_name: text
- provider_type: text (messaging, casino_platform, sports_betting, pam)
- display_name: text
- description: text
- required_fields: jsonb (dynamic field definitions)
- logo_url: text
- documentation_url: text
- api_base_url: text
- webhook_support: boolean
- is_active: boolean
```

#### **casino_integration_configs**
Per-casino integration configurations with encrypted credentials.

```sql
- id: UUID (Primary Key)
- casino_id: UUID (FK to casinos)
- provider_id: UUID (FK to integration_providers)
- is_enabled: boolean
- credentials: jsonb (encrypted API keys, tokens, etc.)
- configuration: jsonb (additional settings)
- last_sync_at: timestamptz
- sync_status: text (pending, syncing, success, error)
- sync_error: text
```

#### **integration_api_logs**
Comprehensive API call logging for debugging and monitoring.

```sql
- id: UUID (Primary Key)
- config_id: UUID (FK to casino_integration_configs)
- request_type: text (GET, POST, etc.)
- endpoint: text
- request_payload: jsonb
- response_status: integer
- response_payload: jsonb
- response_time_ms: integer
- error_message: text
- created_at: timestamptz
```

#### **integration_sync_status**
Track synchronization status for different data types.

```sql
- id: UUID (Primary Key)
- config_id: UUID (FK to casino_integration_configs)
- sync_type: text (players, transactions, games, etc.)
- last_sync_at: timestamptz
- records_synced: integer
- records_failed: integer
- sync_duration_ms: integer
- status: text (idle, running, completed, failed)
- error_details: jsonb
```

## Security Features

### 1. **Data Isolation**
- Each casino has completely isolated integration configurations
- Credentials are stored per-casino in encrypted JSONB fields
- RLS policies ensure casinos can only access their own integrations

### 2. **Credential Encryption**
- All API keys, tokens, and secrets are stored encrypted
- Credentials never exposed in logs or UI without explicit user action
- Support for rotating credentials without system downtime

### 3. **Access Control**
- **Super Admins**: Can view all integrations across all casinos (read-only on credentials)
- **Casino Admins**: Full control over their casino's integrations
- **Regulators**: Read-only access for compliance monitoring
- **Staff**: No access to integration credentials

### 4. **Audit Trail**
- All API calls logged with request/response details
- Configuration changes tracked with timestamps and user IDs
- Sync history maintained for compliance purposes

## Edge Functions

### 1. **integration-whatsapp-send**
Send WhatsApp messages via Twilio using casino-specific credentials.

**Endpoint**: `/functions/v1/integration-whatsapp-send`

**Request**:
```json
{
  "casino_id": "uuid",
  "to_phone": "+27821234567",
  "message": "Your wellbeing game invitation...",
  "metadata": {
    "player_id": "uuid",
    "campaign_id": "uuid"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message_sid": "SM1234567890abcdef",
  "status": "sent"
}
```

### 2. **integration-softswiss-sync**
Synchronize data from SOFTSWISS platform.

**Endpoint**: `/functions/v1/integration-softswiss-sync`

**Request**:
```json
{
  "casino_id": "uuid",
  "sync_type": "players|transactions|games|full",
  "date_from": "2024-01-01",
  "date_to": "2024-12-31"
}
```

**Response**:
```json
{
  "success": true,
  "sync_type": "players",
  "records_synced": 150,
  "records_failed": 2,
  "duration_ms": 3500,
  "message": "Synced 150 players, 2 failed"
}
```

## Integration Workflows

### Setting Up a New Integration

1. **Super Admin** (if provider not yet available):
   - Add provider to `integration_providers` table
   - Define required credential fields
   - Set API endpoints and documentation URLs

2. **Casino Admin**:
   - Navigate to Casino → Integrations
   - Click "Connect" on desired provider
   - Fill in required credentials (API keys, tokens, etc.)
   - Enable the integration
   - Test connection
   - Perform initial sync

3. **System**:
   - Validates credentials
   - Creates configuration record
   - Encrypts and stores credentials
   - Initializes sync status tracking
   - Logs all actions for audit

### Data Synchronization Flow

```
┌─────────────────┐
│  Casino Admin   │
│  Triggers Sync  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Edge Function              │
│  (e.g., softswiss-sync)     │
└────────┬────────────────────┘
         │
         │ 1. Fetch config & credentials
         ▼
┌─────────────────────────────┐
│  Database                   │
│  casino_integration_configs │
└────────┬────────────────────┘
         │
         │ 2. Call external API
         ▼
┌─────────────────────────────┐
│  External Platform API      │
│  (SOFTSWISS, etc.)          │
└────────┬────────────────────┘
         │
         │ 3. Process response
         ▼
┌─────────────────────────────┐
│  Update Local Database      │
│  (players, transactions)    │
└────────┬────────────────────┘
         │
         │ 4. Log results
         ▼
┌─────────────────────────────┐
│  integration_api_logs       │
│  integration_sync_status    │
└─────────────────────────────┘
```

## UI Pages

### Super Admin: Integration Management
**Route**: `/admin/integrations`

**Features**:
- View all providers and their configurations
- See all casino integrations system-wide
- Monitor sync status across all casinos
- Filter by integration type
- View API logs and debug issues

### Casino Admin: Integration Configuration
**Route**: `/casino/integrations`

**Features**:
- View available integration providers
- Configure casino-specific credentials
- Enable/disable integrations
- Test connections
- Trigger manual syncs
- View sync history and logs
- Manage webhook configurations

## Configuration Examples

### WhatsApp/Twilio Configuration
```json
{
  "account_sid": "AC1234567890abcdef",
  "auth_token": "your_auth_token_here",
  "whatsapp_number": "whatsapp:+14155238886"
}
```

### SOFTSWISS Configuration
```json
{
  "api_key": "your_api_key",
  "api_secret": "your_api_secret",
  "casino_id": "your_softswiss_casino_id",
  "environment": "production"
}
```

### Altenar Configuration
```json
{
  "api_username": "your_username",
  "api_password": "your_password",
  "operator_id": "1234",
  "brand_id": "5678"
}
```

### BET Software Configuration
```json
{
  "partner_id": "your_partner_id",
  "api_key": "your_api_key",
  "hash_key": "your_hash_key",
  "site_id": "your_site_id"
}
```

### Playtech PAM Configuration
```json
{
  "client_id": "your_client_id",
  "client_secret": "your_client_secret",
  "license_key": "your_license_key",
  "region": "eu"
}
```

## Webhook Support

Some integrations support webhooks for real-time data updates:

```sql
-- Example webhook configuration
INSERT INTO integration_webhook_configs (
  config_id,
  webhook_type,
  webhook_url,
  webhook_secret,
  is_active
) VALUES (
  'config_uuid',
  'player_update',
  'https://your-domain.com/webhooks/softswiss/player-update',
  'webhook_secret_key',
  true
);
```

## Best Practices

### 1. **Credential Management**
- Rotate API keys regularly
- Use environment-specific credentials
- Never log or expose credentials in error messages
- Implement credential validation before storage

### 2. **Error Handling**
- Log all API errors for debugging
- Implement retry logic with exponential backoff
- Alert admins on persistent failures
- Provide clear error messages to users

### 3. **Performance**
- Cache frequently accessed data
- Use batch operations where possible
- Schedule syncs during off-peak hours
- Monitor API rate limits

### 4. **Compliance**
- Log all data access for audit purposes
- Ensure GDPR compliance for data transfers
- Implement data retention policies
- Regular security audits of integration code

## Future Enhancements

1. **Additional Providers**
   - More casino platforms (Microgaming, Evolution Gaming)
   - Payment processors (Stripe, PayPal)
   - CRM systems (Salesforce, HubSpot)

2. **Advanced Features**
   - Automated sync scheduling
   - Real-time webhook handlers
   - Data transformation pipelines
   - Integration health monitoring dashboard

3. **Developer Tools**
   - API sandbox for testing
   - Integration testing framework
   - Mock providers for development
   - Comprehensive API documentation

## Support and Documentation

For integration-specific documentation, refer to:
- **Twilio**: https://www.twilio.com/docs/whatsapp/api
- **SOFTSWISS**: https://casino-api.softswiss.com/docs
- **Altenar**: https://docs.altenar.com/api
- **BET Software**: https://betsoftware.com/api-documentation
- **Playtech**: https://developer.playtech.com/pam/api

## Troubleshooting

### Common Issues

1. **Integration not syncing**
   - Check credentials are correct
   - Verify integration is enabled
   - Check API logs for errors
   - Ensure external platform is accessible

2. **WhatsApp messages not sending**
   - Verify Twilio credentials
   - Check phone number format (use E.164 format)
   - Ensure WhatsApp Business number is approved
   - Check Twilio account balance

3. **Sync taking too long**
   - Limit date range for large datasets
   - Use batch sync options
   - Schedule syncs during off-peak hours
   - Monitor API rate limits

---

**Last Updated**: 2026-02-03
**Version**: 1.0.0
