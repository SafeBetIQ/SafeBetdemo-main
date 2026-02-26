# AWS Deployment Guide - SafeBet IQ

## Quick Fix for "Failed to Fetch" Error

The "failed to fetch" error during login is caused by missing environment variables. Follow these steps:

### 1. Set Environment Variables in AWS

#### For AWS Amplify:
1. Open AWS Amplify Console
2. Select your app
3. Go to **Environment Variables** in the left sidebar
4. Add these two variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://uexdjngogzunjxkpxwll.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleGRqbmdvZ3p1bmp4a3B4d2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODE4OTUsImV4cCI6MjA3OTQ1Nzg5NX0.-OSpm7VFAK8CM2_N80gqjCKRN_8d-5MwqnstYAPnpbo
```

4. Click **Save**
5. Redeploy your application

#### For AWS Elastic Beanstalk:
```bash
eb setenv NEXT_PUBLIC_SUPABASE_URL=https://uexdjngogzunjxkpxwll.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleGRqbmdvZ3p1bmp4a3B4d2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODE4OTUsImV4cCI6MjA3OTQ1Nzg5NX0.-OSpm7VFAK8CM2_N80gqjCKRN_8d-5MwqnstYAPnpbo
```

#### For AWS EC2:
Add to your `.env` file or export in your startup script:
```bash
export NEXT_PUBLIC_SUPABASE_URL=https://uexdjngogzunjxkpxwll.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleGRqbmdvZ3p1bmp4a3B4d2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODE4OTUsImV4cCI6MjA3OTQ1Nzg5NX0.-OSpm7VFAK8CM2_N80gqjCKRN_8d-5MwqnstYAPnpbo
```

### 2. Verify Supabase Configuration

**Note:** Supabase handles CORS automatically - you don't need to configure it manually. Your AWS domain will work once environment variables are set.

However, if you want to verify your Supabase project is active:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/uexdjngogzunjxkpxwll)
2. Check that your project status is "Active" (green dot)
3. Your project URL: `https://uexdjngogzunjxkpxwll.supabase.co`

### 3. Test Your Deployment

Visit: `https://your-aws-domain.com/health`

This health check page will verify:
- ✅ Environment variables are set correctly
- ✅ Supabase connection is working
- ✅ All systems operational

### 4. Test Login

Once the health check passes, try logging in with:

**Super Admin:**
- Email: `superadmin@safebetiq.com`
- Password: `Super@2024!`

**Casino Admin:**
- Email: `admin@royalpalace.safebetiq.com`
- Password: `Admin123!`

**Regulator:**
- Email: `regulator@ngb.gov.za`
- Password: `Regulator123!`

---

## Common Issues & Solutions

### Issue 1: "Supabase is not configured" Error
**Cause:** Environment variables not set in AWS
**Solution:** Follow Step 1 above to set environment variables

### Issue 2: "Network error: Unable to connect"
**Cause:** CORS not configured in Supabase
**Solution:** Follow Step 2 above to add your AWS domain to CORS

### Issue 3: Login works but redirects to blank page
**Cause:** Next.js routing issue in production
**Solution:** Ensure `next.config.js` has proper configuration:
```javascript
module.exports = {
  output: 'standalone', // For Docker/EC2
  // OR
  // Leave default for Amplify
}
```

### Issue 4: Environment variables set but still failing
**Cause:** Build cache or incomplete deployment
**Solution:**
1. Clear build cache in AWS
2. Trigger a fresh deployment
3. Verify variables with `/health` endpoint

---

## Build Commands (AWS Amplify)

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

---

## Support

If issues persist:
1. Check `/health` endpoint
2. Check AWS CloudWatch logs
3. Check browser console for errors
4. Verify Supabase project status at https://status.supabase.com/
