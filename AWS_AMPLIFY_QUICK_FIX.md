# AWS Amplify - Quick Fix for Login Issues

## The Problem
Getting "failed to fetch" when trying to login to Super Admin account.

## The Solution (2 Minutes)

### Step 1: Open AWS Amplify Console
1. Go to https://console.aws.amazon.com/amplify/
2. Click on your SafeBet IQ app

### Step 2: Add Environment Variables
1. In the left sidebar, click **"Environment variables"**
2. Click **"Manage variables"** button
3. Click **"Add variable"** twice to add these two variables:

**Variable 1:**
- Key: `NEXT_PUBLIC_SUPABASE_URL`
- Value: `https://uexdjngogzunjxkpxwll.supabase.co`

**Variable 2:**
- Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleGRqbmdvZ3p1bmp4a3B4d2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODE4OTUsImV4cCI6MjA3OTQ1Nzg5NX0.-OSpm7VFAK8CM2_N80gqjCKRN_8d-5MwqnstYAPnpbo`

4. Click **"Save"**

### Step 3: Redeploy
1. Go to **"Deployments"** in the left sidebar
2. Click **"Redeploy this version"** on the latest deployment
   - OR push a new commit to trigger automatic deployment

### Step 4: Test (Wait 3-5 minutes for deployment)

#### Test 1: Health Check
Visit: `https://[your-app-id].amplifyapp.com/health`

You should see:
- ✅ Supabase URL Configured: OK
- ✅ Supabase API Key Configured: OK
- ✅ Supabase Connection: OK

#### Test 2: Login
Visit: `https://[your-app-id].amplifyapp.com/login`

Try logging in with:
- Email: `superadmin@safebetiq.com`
- Password: `Super@2024!`

Should redirect you to `/admin` dashboard.

---

## Still Not Working?

### Check 1: Verify Variables Were Saved
1. Go back to **Environment variables** in Amplify
2. Confirm both variables are listed
3. Make sure there are no extra spaces in the values

### Check 2: Check Deployment Status
1. Go to **Deployments** tab
2. Wait until status shows "Deployed" (green)
3. Check deployment logs for any errors

### Check 3: Clear Browser Cache
1. Open your site in an Incognito/Private window
2. Or clear browser cache and cookies
3. Try login again

### Check 4: View Browser Console
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Try to login
4. Share any error messages you see

---

## Why This Happens

Next.js environment variables starting with `NEXT_PUBLIC_` must be set at **build time**, not runtime. When you deploy to AWS without setting these variables, the app tries to connect to `https://placeholder.supabase.co` which doesn't exist, causing the "failed to fetch" error.

---

## Next Steps After Fix

Once login works, you can access:

1. **Super Admin Dashboard** - Manage all casinos, users, courses
2. **Casino Admin Dashboard** - Monitor players, staff training
3. **Regulator Dashboard** - Compliance oversight
4. **Training Academy** - Staff certification courses

All demo credentials are on the login page.
