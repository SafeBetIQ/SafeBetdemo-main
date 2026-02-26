# WhatsApp Integration Guide

## Overview

Nova IQ wellbeing invitations can now be sent via WhatsApp using Twilio's WhatsApp Business API. This allows casinos to reach players directly on their phones with voluntary wellbeing check-in games.

## How It Works

When a casino sends a wellbeing game invitation:

1. **Edge Function Called**: `/functions/v1/send-wellbeing-invitation`
2. **Invitation Created**: System generates secure token and game URL
3. **WhatsApp Message Sent**: Via Twilio API (if credentials configured)
4. **Delivery Tracked**: Status saved as 'sent', 'simulated', 'failed', or 'error'

## Setup Instructions

### 1. Create Twilio Account

1. Go to [Twilio Console](https://console.twilio.com)
2. Sign up or log in
3. Navigate to **Messaging** > **Try it out** > **Send a WhatsApp message**

### 2. Get WhatsApp Sandbox Number

For testing:
1. In Twilio Console, go to **Messaging** > **Try it out** > **Send a WhatsApp message**
2. Follow instructions to join your WhatsApp sandbox
3. Send the provided code (e.g., "join <your-code>") to the Twilio number
4. Your sandbox number is displayed (format: `+14155238886`)

For production:
1. Apply for WhatsApp Business API access through Twilio
2. Get your approved WhatsApp sender number
3. Complete business verification process

### 3. Get Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com)
2. Find your **Account SID** and **Auth Token** on the dashboard
3. Note your WhatsApp number (sandbox or approved number)

### 4. Configure Environment Variables

Update your `.env` file with actual credentials:

```env
TWILIO_ACCOUNT_SID=your_actual_account_sid_here
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
TWILIO_WHATSAPP_NUMBER=+14155238886
```

**Important**: These variables must also be set in your Supabase project:
- Go to Supabase Dashboard > Project Settings > Edge Functions
- Add the three environment variables above

### 5. Test the Integration

1. Log in as a casino admin: `casino@safebetiq.com`
2. Navigate to **Wellbeing Games** page
3. Click **Send Test Invitation** on any game
4. Check the player's WhatsApp for the message

## Message Format

Players receive:

```
Hi [Player Name],

Take a quick 2-minute game to reflect on how you're playing.

[Game Description]

Play now: [Secure URL]

This is a voluntary wellbeing check-in to support responsible play.

SafeBet IQ
```

## Phone Number Format

Player phone numbers in the database should be in international format:
- ✅ Correct: `+27821234567` (South Africa)
- ✅ Correct: `+44712345678` (UK)
- ❌ Wrong: `0821234567` (missing country code)

The edge function automatically prefixes with `whatsapp:` for Twilio.

## Delivery Tracking

The system tracks delivery status in the `wellbeing_game_invitations` table:

- **sent**: Successfully delivered via Twilio
- **simulated**: Logged only (credentials not configured)
- **failed**: Twilio API returned error
- **error**: Exception during sending attempt
- **pending**: Not yet attempted

## Fallback Behavior

If Twilio credentials are not configured:
- Messages are **simulated** (logged to console only)
- System continues to work normally
- Delivery status is marked as 'simulated'
- No errors shown to users

## Costs

Twilio WhatsApp messaging costs vary by region:
- South Africa: ~$0.0047 per message
- Check current rates at [Twilio Pricing](https://www.twilio.com/whatsapp/pricing)

## South African WhatsApp Business Requirements

For production use in South Africa:
1. Register a WhatsApp Business Account
2. Verify your business with Meta
3. Get Twilio WhatsApp Business API access
4. Configure opt-in/opt-out flows per POPIA regulations
5. Store player consent for WhatsApp communications

## Monitoring

View delivery status in:
- **Casino Dashboard**: Wellbeing Games > Recent Sessions
- **Database**: Query `wellbeing_game_invitations` table
- **Twilio Console**: Message logs and delivery reports

## Troubleshooting

### Messages Not Sending

1. Check Twilio credentials in `.env` file
2. Verify credentials are set in Supabase Edge Functions settings
3. Check player phone numbers are in international format
4. Verify Twilio account has credit
5. Check WhatsApp sandbox is active (for testing)

### Player Not Receiving Messages

1. Verify player joined WhatsApp sandbox (testing only)
2. Check phone number format in database
3. Check Twilio console for delivery status
4. Verify player's WhatsApp is active
5. Check for opt-out status in Twilio

### Delivery Status Shows 'Simulated'

- Twilio credentials are not configured or invalid
- Set environment variables properly in Supabase

## Next Steps

After setup, you can:
1. Create automated campaigns (trigger-based sending)
2. Add email sending alongside WhatsApp
3. Implement opt-in/opt-out management
4. Add delivery webhooks from Twilio
5. Create scheduling for batch sends

## Support

For issues with:
- **Twilio Setup**: [Twilio Support](https://support.twilio.com)
- **SafeBet IQ Integration**: Contact your technical team
- **WhatsApp Business API**: [Meta Business Support](https://business.facebook.com/help)
