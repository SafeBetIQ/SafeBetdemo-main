# SafeBet IQ Demo Credentials

This document contains all login credentials for testing the SafeBet IQ platform.

## Admin Accounts

### Super Admin
- **Email:** `superadmin@safebetiq.com`
- **Password:** `Super@2024!`
- **Access:** Full system access, all casinos, course management

### Casino Admins

#### Royal Palace Casino
- **Email:** `admin@royalpalace.safebetiq.com`
- **Password:** `Admin123!`
- **Access:** Royal Palace Casino dashboard, staff management, training assignments

#### Golden Dragon Gaming
- **Email:** `admin@goldendragon.safebetiq.com`
- **Password:** `Admin123!`
- **Access:** Golden Dragon Gaming dashboard, staff management, training assignments

#### Silver Star Resort
- **Email:** `admin@silverstar.safebetiq.com`
- **Password:** `Admin123!`
- **Access:** Silver Star Resort dashboard, staff management, training assignments

### Regulator Account
- **Email:** `regulator@ngb.gov.za`
- **Password:** `Regulator123!`
- **Access:** Compliance oversight, all casinos, audit reports

## Staff Accounts

### Default Password for All Staff
**Password:** `Staff123!`

### Staff Members by Casino

#### Royal Palace Casino Staff
1. **James Anderson** - `james.anderson@royalpalace.safebetiq.com`
2. **Patricia Martinez** - `patricia.martinez@royalpalace.safebetiq.com`
3. **Linda Brown** - `linda.brown@royalpalace.safebetiq.com`
4. **Robert Taylor** - `robert.taylor@royalpalace.safebetiq.com`

#### Golden Dragon Gaming Staff
1. **William Lee** - `william.lee@goldendragon.safebetiq.com`
2. **Jennifer Garcia** - `jennifer.garcia@goldendragon.safebetiq.com`
3. **Maria Lopez** - `maria.lopez@goldendragon.safebetiq.com`
4. **Charles Davis** - `charles.davis@goldendragon.safebetiq.com`
5. **Richard Wilson** - `richard.wilson@goldendragon.safebetiq.com`

#### Silver Star Resort Staff
1. **Sarah Johnson** - `sarah.johnson@silverstar.safebetiq.com`
2. **Michael Chen** - `michael.chen@silverstar.safebetiq.com`
3. **David Williams** - `david.williams@silverstar.safebetiq.com`
4. **Emily Rodriguez** - `emily.rodriguez@silverstar.safebetiq.com`

## Access Levels

### Super Admin Can Access:
- ✅ Course Management System (add/edit/delete courses)
- ✅ Assign courses to all casinos or specific casinos
- ✅ Assign courses to specific staff members
- ✅ User role management across all casinos
- ✅ System-wide analytics and reports
- ✅ All casino dashboards (view-only)

### Casino Admin Can Access:
- ✅ Casino dashboard (own casino only)
- ✅ Staff management (add/edit staff)
- ✅ Training assignments (assign courses to staff)
- ✅ Player monitoring and interventions
- ✅ Risk analytics for own casino
- ✅ ESG compliance reports
- ✅ Impersonate staff members (login as staff)

### Staff Can Access:
- ✅ Staff profile page
- ✅ Training academy
- ✅ Assigned courses
- ✅ Course progress tracking
- ✅ Certificates upon completion
- ✅ Quiz attempts and scores

### Regulator Can Access:
- ✅ Regulator dashboard
- ✅ All casino compliance reports
- ✅ Audit logs across all casinos
- ✅ Intervention history
- ✅ ESG scores and trends
- ✅ Training compliance metrics

## How to Test Staff Login

### Method 1: Direct Login
1. Go to `/login`
2. Enter staff email (e.g., `james.anderson@royalpalace.safebetiq.com`)
3. Enter password: `Staff123!`
4. You'll be redirected to `/staff/academy`

### Method 2: Casino Admin Impersonation
1. Login as casino admin
2. Go to `/casino/staff`
3. Find a staff member
4. Click "Login As" button
5. You'll be logged in as that staff member

## Viewing Staff Profile from Casino Dashboard

### As Casino Admin:
1. Login as casino admin
2. Navigate to "Staff Directory" (`/casino/staff`)
3. Find any staff member
4. Click "View Profile" button
5. You'll see the staff member's profile page with:
   - Personal information
   - Training progress
   - Completed courses
   - Certificates earned
   - Pending assignments

## Notes

- All passwords are for demo purposes only
- In production, staff should set their own secure passwords
- The system supports impersonation for testing and support purposes
- Login activity is tracked in the `login_activity` table
- Staff profiles are fully accessible from the casino dashboard

## Security Notes

⚠️ **Demo Environment Only**
- These credentials are for demonstration purposes
- In production, use individual secure passwords
- Enable 2FA for admin accounts
- Implement password rotation policies
- Use role-based access control (RBAC)
- Monitor login activity for suspicious behavior

## Support

If you encounter login issues:
1. Verify the email address is correct
2. Ensure you're using the correct password for the account type
3. Check that the account is marked as "active" in the database
4. Verify the staff member has an `auth_user_id` set in the staff table

## Database References

- **Users Table:** `public.users` (admin and regulator accounts)
- **Staff Table:** `public.staff` (staff accounts)
- **Auth Users:** `auth.users` (authentication entries)
- **Login Activity:** `public.login_activity` (tracks all logins)
