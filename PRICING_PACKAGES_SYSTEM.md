# SafeBet IQ Pricing Packages System

## Overview
The pricing packages system allows super administrators to assign pre-configured feature bundles to casinos, streamlining module management and providing clear pricing tiers.

## Package Structure

### 1. Standard Package - $4,999/month ($49,990/year)
**Target:** Casinos getting started with AI-powered player protection

**Modules Included (9 total):**
- **Core (3):** Live Casino Dashboard, Player Management, Staff Management
- **Analytics (2):** Real-Time Analytics, Live Casino Feed
- **Compliance (3):** Compliance Audit System, Intervention History, Regulatory Reporting
- **Training (1):** Certification Tracking

**Key Features:**
- Live Casino Dashboard
- Player & Staff Management
- Real-Time Analytics
- Basic Compliance Reporting
- Certification Tracking
- Email Support

---

### 2. Enterprise Package - $9,999/month ($99,990/year)
**Target:** Advanced AI-powered risk detection with comprehensive training

**Modules Included (15 total):**
- **Everything in Standard PLUS:**
- **AI (2):** AI Monitoring Indicators, Predictive Analytics
- **Analytics (1 additional):** Behavioral Risk Intelligence
- **Training (3 additional):** Training Academy, Course Management, Staff Training Assignments

**Key Features:**
- Everything in Standard
- AI Monitoring & Predictive Analytics
- Behavioral Risk Intelligence
- Full Training Academy
- Staff Training Assignments
- Course Management
- Priority Support
- Dedicated Account Manager

---

### 3. Premium Package - $14,999/month ($149,990/year) ⭐ BEST VALUE
**Target:** Complete SafeBet IQ suite with cutting-edge features

**Modules Included (19 total - ALL MODULES):**
- **Everything in Enterprise PLUS:**
- **AI (1 additional):** SafePlay AI Risk Engine
- **Analytics (2 additional):** Cognitive Fatigue Monitoring, Persona Shift Detection
- **Compliance (1 additional):** ESG Reporting

**Key Features:**
- Everything in Enterprise
- SafePlay AI Risk Engine
- Cognitive Fatigue Monitoring
- Persona Shift Detection
- ESG Reporting & King IV Compliance
- WhatsApp Integration
- API Access
- 24/7 Premium Support
- Custom Integrations

---

## Upgrade Path

```
Standard → Enterprise → Premium
$4,999/mo   $9,999/mo    $14,999/mo

Standard:
✓ Essential features for responsible gaming
✓ Basic analytics and compliance
✓ Foundation for growth

Enterprise:
✓ Add AI-powered risk detection
✓ Full training academy
✓ Behavioral intelligence
✓ Priority support

Premium:
✓ Complete AI suite
✓ Advanced behavioral monitoring
✓ ESG reporting
✓ Custom integrations
```

---

## Module Distribution by Category

| Category   | Standard | Enterprise | Premium |
|------------|----------|------------|---------|
| Core       | 3        | 3          | 3       |
| Analytics  | 2        | 3          | 5       |
| Compliance | 3        | 3          | 4       |
| AI         | 0        | 2          | 3       |
| Training   | 1        | 4          | 4       |
| **Total**  | **9**    | **15**     | **19**  |

---

## Value Proposition by Package

### Standard Package ($4,999/month)
- **Best For:** Small to medium casinos starting their responsible gaming journey
- **Value:** Essential tools for compliance and player monitoring
- **ROI:** Basic risk reduction, compliance readiness

### Enterprise Package ($9,999/month)
- **Best For:** Growing casinos needing advanced risk detection
- **Value:** AI-powered insights + comprehensive staff training
- **ROI:** Significant risk reduction, improved staff competency, reduced incidents

### Premium Package ($14,999/month)
- **Best For:** Large casinos requiring complete oversight and ESG reporting
- **Value:** Complete platform with cutting-edge AI and behavioral science
- **ROI:** Maximum risk reduction, ESG compliance, industry-leading protection

---

## Database Schema

### Tables Created
1. **pricing_packages** - Package definitions and pricing
2. **package_modules** - Module inclusions for each package
3. **casino_packages** - Historical tracking of casino package assignments

### Key Features
- Super admin can assign packages with one click
- Automatic module provisioning based on package
- Historical tracking of package changes
- RLS policies ensure proper access control

---

## Admin Interface

### Two Management Modes

#### 1. Package View
- Visual cards for Standard, Enterprise, and Premium
- Clear pricing and feature lists
- One-click package assignment
- Module count and category badges
- Upgrade path guidance

#### 2. Individual Modules View
- Granular control over specific modules
- Search and filter capabilities
- Toggle individual modules on/off
- Enable/disable all modules bulk actions
- Organized by category

---

## Technical Implementation

### Migrations Created
1. `create_pricing_packages_system.sql` - Schema and RLS policies
2. `seed_pricing_packages_and_modules.sql` - Package definitions and module mappings
3. `seed_casino_package_assignments.sql` - Demo data for existing casinos

### Frontend Updates
- Enhanced `/admin/casino-modules` page with tabbed interface
- Package selection with visual pricing cards
- Real-time module count updates
- Responsive design for all screen sizes

---

## Usage Instructions

### For Super Admins

1. **Navigate to Casino Modules Management:**
   - Go to Admin Dashboard → Casino Software Modules

2. **Select a Casino:**
   - Click on a casino card to manage their access

3. **Choose Management Mode:**
   - **Package Tab:** Quick assignment of pre-configured tiers
   - **Modules Tab:** Fine-grained control over individual features

4. **Assign a Package:**
   - View package details and pricing
   - Click "Assign [Package Name]" button
   - All modules for that package are automatically enabled

5. **Customize (Optional):**
   - Switch to Modules tab for granular adjustments
   - Enable/disable specific features as needed

---

## Future Enhancements

### Potential Additions
- Add-on modules (extra features purchasable separately)
- Custom enterprise packages
- Trial periods with automatic conversion
- Package comparison tool
- Usage analytics per package
- Automatic billing integration
- Package downgrade/upgrade workflows
- Proration calculations for mid-cycle changes

---

## Summary

The pricing packages system provides a streamlined approach to managing casino software access while maintaining flexibility for custom configurations. The three-tier structure (Standard, Enterprise, Premium) aligns with industry best practices and provides clear upgrade paths for casinos as they grow their responsible gaming programs.
