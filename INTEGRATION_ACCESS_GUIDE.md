# How to Access the Integration System

## For Casino Admins

### Step 1: Login
Login with your casino admin credentials (e.g., `admin@royalpalace.safebetiq.com`)

### Step 2: Navigate to Integrations
In the left sidebar, look for the **Settings** section at the bottom. Click on **Integrations**.

**Path**: `/casino/integrations`

### What You'll See

1. **Your Configured Integrations** (if any exist)
   - WhatsApp/Twilio integration example (already configured for Royal Palace Casino)
   - Status indicators (Active, Error, Pending)
   - Last sync information
   - Buttons to:
     - Test Connection
     - Sync Now
     - Configure

2. **Available Integrations** (platforms you can connect)
   - WhatsApp Business (via Twilio)
   - SOFTSWISS Casino Platform
   - Altenar Sports Betting
   - BET Software Platform
   - Playtech PAM

### Step 3: Configure an Integration

1. Click **Connect** on any available integration
2. Fill in the required credentials:
   - For WhatsApp: Account SID, Auth Token, WhatsApp Number
   - For SOFTSWISS: API Key, API Secret, Casino ID, Environment
   - For Altenar: API Username, Password, Operator ID, Brand ID
   - For BET Software: Partner ID, API Key, Hash Key, Site ID
   - For Playtech PAM: Client ID, Client Secret, License Key, Region
3. Toggle **Enable Integration** to activate
4. Click **Save Configuration**

### Step 4: Test & Sync

1. Click **Test Connection** to verify credentials
2. Click **Sync Now** to synchronize data from the platform
3. Monitor the sync status and logs

## For Super Admins

### Access Point
**Path**: `/admin/integrations`

### What You Can Do

1. **View All Integrations** across all casinos
2. **Manage Integration Providers** (add/edit/disable providers)
3. **Monitor System-Wide** sync status and API logs
4. **Filter by Type**: Messaging, Casino Platform, Sports Betting, PAM
5. **Debug Issues** across all casino integrations

## Navigation Structure

```
Settings (in sidebar)
├── Profile (for staff)
├── Staff Management (casino admin)
├── Integrations ← YOU ARE HERE
│   ├── Casino Admin → /casino/integrations
│   └── Super Admin → /admin/integrations
├── Module Management (super admin)
├── User Management (super admin)
└── ESG Management (super admin)
```

## Demo Integration

A demo WhatsApp integration has been created for **Royal Palace Casino**:
- Provider: WhatsApp Business (via Twilio)
- Status: Enabled
- Credentials: Demo values (for testing UI only)

## Troubleshooting

### Can't see Integrations link?
- Make sure you're logged in as `casino_admin` or `super_admin`
- Check that you're on a dashboard page (not the public site)
- The link should appear in the **Settings** section at the bottom of the sidebar

### Page loads but shows no data?
- Check your user has a `casino_id` assigned
- Verify you have the correct role (`casino_admin` or `super_admin`)
- Check browser console for any RLS policy errors

### Can't save configuration?
- Ensure all required fields are filled in (marked with *)
- Check that the credentials format is correct
- Verify you're logged in with the correct role

## Security Notes

- All credentials are encrypted in the database
- Each casino can only see their own integrations
- Credentials are hidden by default (click eye icon to reveal)
- All API calls are logged for audit purposes
- RLS policies ensure complete data isolation

## Next Steps

1. Get real credentials from your platform providers
2. Configure each integration with production credentials
3. Test connections to verify setup
4. Enable integrations to start syncing
5. Set up automated sync schedules (coming soon)

---

**Need Help?**
Contact support or check the main [INTEGRATION_SYSTEM.md](./INTEGRATION_SYSTEM.md) for detailed technical documentation.
