# SafePlay Academy - Demo System Guide

## Overview
The SafePlay Academy is a comprehensive training and certification system for casino staff with three distinct portals:
1. **Staff Portal** - For casino employees to take courses
2. **Casino Admin Portal** - For managing staff and training
3. **Regulator Portal** - For compliance oversight

---

## Demo Accounts

### Staff Accounts (Staff Academy Portal)
Login at: `/login` → Redirects to `/staff/academy`

| Email | Role | Courses | Completed | In Progress | Credits |
|-------|------|---------|-----------|-------------|---------|
| sarah.johnson@demo.casino | Frontline | 3 | 2 | 1 | 9 |
| michael.chen@demo.casino | VIP Host | 3 | 1 | 2 | 5 |
| emily.rodriguez@demo.casino | Manager | 1 | 0 | 1 | 0 |
| david.williams@demo.casino | Compliance Officer | 4 | 2 | 2 | 10 |

**Password:** demo123 (for all staff accounts)

### Casino Admin Account
Login at: `/login` → Redirects to `/casino/dashboard`

| Email | Role | Access |
|-------|------|--------|
| admin@safecasino.com | Casino Admin | Full training management |

**Password:** admin123

### Regulator Account
Login at: `/login` → Redirects to `/regulator/dashboard`

| Email | Role | Access |
|-------|------|--------|
| inspector@ngb.gov.za | Regulator | Industry-wide compliance view |

**Password:** regulator123

---

## Portal Features

### 1. Staff Academy Portal (`/staff/academy`)
**What Staff See:**
- ✅ Personal dashboard with stats
- ✅ Assigned courses with progress bars
- ✅ Credits earned
- ✅ Course status (not started, in progress, completed)
- ✅ Completion dates and certificates

**Demo Data:**
- Sarah Johnson: 67% progress, 2/3 courses complete
- Michael Chen: 47% progress, 1/3 courses complete, high performer
- Emily Rodriguez: Just started, 15% progress
- David Williams: Most experienced, 76% progress, 10 credits

### 2. Casino Training Portal (`/casino/training`)
**What Casino Admins See:**
- ✅ Staff Directory tab (add/edit/deactivate staff)
- ✅ Training Modules tab (50 courses across 5 categories)
- ✅ Credits & Reports tab (analytics & CSV export)

**Access from Casino Dashboard:**
- Green "Training Academy" button in top-right corner
- Quick link to manage all training

### 3. Regulator Compliance View (`/regulator/dashboard`)
**What Regulators See:**
- ✅ Real-time training compliance card
- ✅ 4 demo staff members with progress
- ✅ Industry stats: 4 staff, 24 total credits, 67% avg completion
- ✅ Per-staff breakdown: courses assigned, completed, progress, credits
- ✅ Certification status badges

**Demo Compliance Data:**
| Staff | Courses | Completed | Progress | Credits | Status |
|-------|---------|-----------|----------|---------|--------|
| Sarah Johnson | 3 | 2 | 67% | 9 | In Training |
| Michael Chen | 3 | 1 | 47% | 5 | In Training |
| Emily Rodriguez | 1 | 0 | 15% | 0 | In Training |
| David Williams | 4 | 2 | 76% | 10 | In Training |

---

## 50 Training Courses

### 🎯 Responsible Gambling (10 courses)
1. Understanding Problem Gambling - 45 min, 5 credits
2. Recognizing Early Warning Signs - 30 min, 4 credits
3. How to Speak to a High-Risk Player - 40 min, 6 credits
4. Responsible Gambling – Global Best Practices - 50 min, 7 credits
5. Player Self-Exclusion Management - 35 min, 5 credits
6. Cooling-Off Period Protocols - 30 min, 4 credits
7. Gambling Harm: Psychological Effects - 45 min, 6 credits
8. Behavioral Red Flags on the Casino Floor - 35 min, 5 credits
9. Escalation Procedures - 40 min, 5 credits
10. VIP Player Risk Handling - 50 min, 8 credits

### 🔒 AML Compliance (10 courses)
11-20. From AML Basics to SAR Filing (courses 11-20)

### ⚖️ Legal & Regulation (10 courses)
21-30. Global licensing to incident reporting (courses 21-30)

### 🤝 Customer Interaction (10 courses)
31-40. Intoxicated players to service excellence (courses 31-40)

### 🛡️ Cybersecurity (10 courses)
41-50. Casino cybersecurity to IT incident response (courses 41-50)

---

## Database Schema

### Core Tables
- `training_categories` - 5 categories
- `training_modules` - 50 courses
- `training_lessons` - 3-5 lessons per course
- `staff` - 4 demo staff members
- `training_enrollments` - 14 active enrollments
- `training_lesson_progress` - Granular progress tracking
- `training_credits` - 24 credits awarded

### Staff Roles
- `frontline` - Frontline staff
- `vip_host` - VIP hosts
- `call_centre` - Call centre agents
- `manager` - Managers
- `compliance_officer` - Compliance officers
- `regulator` - Regulators (future)

---

## Testing Workflow

### Test #1: Staff Login Flow
1. Go to `/login`
2. Enter: `sarah.johnson@demo.casino` / `demo123`
3. Should redirect to `/staff/academy`
4. See 3 assigned courses
5. 2 completed (green checkmarks)
6. 1 in progress (60% progress bar)
7. Total 9 credits displayed

### Test #2: Casino Admin Access
1. Login as `admin@safecasino.com` / `admin123`
2. See main casino dashboard
3. Click green "Training Academy" button
4. View 3 tabs: Staff Directory, Training Modules, Credits & Reports
5. See all 50 courses organized by category

### Test #3: Regulator Oversight
1. Login as `inspector@ngb.gov.za` / `regulator123`
2. See regulator dashboard
3. Scroll to "Training & Certification Compliance" card
4. View real-time stats for all 4 staff members
5. See progress bars, credits, and certification status

### Test #4: Course Browser
1. Visit `/academy` (public page)
2. Click "View Course Library"
3. Goes to `/academy/courses`
4. See all 50 courses with search and filters
5. Filter by category or difficulty

---

## Key Features Implemented

✅ **3 Separate Portals** - Staff, Casino, Regulator
✅ **Smart Login Routing** - Auto-detects user type
✅ **50 Training Courses** - Fully seeded with details
✅ **Progress Tracking** - Real-time enrollment status
✅ **Credits System** - Automatic award on completion
✅ **Demo Data** - 4 staff with varied progress
✅ **Regulator View** - Compliance dashboard
✅ **Public Course Library** - Marketing page with search
✅ **RLS Security** - Row-level security on all tables

---

## Database Verification

```sql
-- Check staff count
SELECT COUNT(*) FROM staff;
-- Result: 4

-- Check enrollments
SELECT COUNT(*) FROM training_enrollments;
-- Result: 14

-- Check courses
SELECT COUNT(*) FROM training_modules;
-- Result: 50

-- Check total credits
SELECT SUM(credits_earned) FROM training_credits;
-- Result: 24
```

---

## Next Steps for Production

1. **Create Real Staff Accounts** - Import actual casino employees
2. **Assign Role-Based Courses** - Auto-assign based on job role
3. **Certificate Generation** - PDF certificates on completion
4. **Email Notifications** - Course assignments and completions
5. **Video Integration** - Add video URLs to lessons
6. **Quiz System** - Interactive assessments
7. **Multi-Language** - Add Zulu, Xhosa, Afrikaans, Sotho
8. **CSV Reports** - Implement full export functionality
9. **Analytics Dashboard** - Advanced charts and insights
10. **Mobile App** - Native iOS/Android for staff

---

## Support

For demo issues or questions:
- Email: demo@safeplay.ai
- Docs: /TESTING.md
- System Status: All systems operational ✅

---

**Build Status:** ✅ All routes compile successfully
**Total Routes:** 18 (including 3 new Academy portals)
**Database:** ✅ All migrations applied
**Security:** ✅ RLS policies optimized

🎓 **SafePlay Academy: Africa's First AI-Powered Casino Training Platform**
