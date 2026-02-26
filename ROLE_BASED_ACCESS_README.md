# SafeBet IQ - Role-Based Access Control System

## Overview

SafeBet IQ is now a **strictly B2B AI Risk & Compliance Platform** for internal casino operations teams. This system provides world-class Behavioral Risk Intelligence™ and ESG Gambling Sustainability Score™ capabilities.

**CRITICAL:** Players DO NOT access this system. SafeBet IQ is for compliance teams, risk analysts, executives, and regulators ONLY.

---

## User Roles

### 1. SUPPORT
**Access Level:** Basic
- View Player Risk Score™
- View operational alerts
- **Cannot access:** BRI dashboards, ESG data, demo mode

**Use Case:** Front-line support staff monitoring basic alerts

---

### 2. COMPLIANCE
**Access Level:** Intermediate
- View Player Risk Score™
- Log intervention actions
- Export compliance reports
- **Cannot access:** Full BRI analytics, ESG dashboards, demo mode

**Use Case:** Compliance managers tracking interventions and regulatory requirements

---

### 3. RISK_ANALYST
**Access Level:** Advanced
- **Full Behavioral Risk Intelligence™ dashboard**
- All player risk analytics
- Intervention management with full history
- Demo mode access for presentations
- Export all BRI data (anonymized)

**Use Case:** Risk analysts performing in-depth behavioral analysis

**Components Available:**
- `CognitiveFatigueIndex` - Real-time cognitive performance tracking
- `ImpulseVsIntentionTable` - Decision-making pattern analysis
- `PersonaShiftChart` - Personality change detection
- `BehaviorTrendGraph` - Predictive risk forecasting

---

### 4. EXECUTIVE
**Access Level:** Strategic
- **ESG Gambling Sustainability Score™ dashboard**
- Casino comparison metrics
- Revenue stability reports
- Financial impact analysis
- Demo mode for investor presentations
- Export ESG reports (CSV/PDF)

**Use Case:** C-suite executives monitoring ethical performance and sustainability

**Components Available:**
- `ESGChart` - Complete ESG scoring breakdown
- `ESGScoreCard` - Real-time sustainability metrics
- `CasinoComparisonChart` - Multi-casino benchmarking

---

### 5. REGULATOR
**Access Level:** Audit
- **Read-only access to everything**
- Player Risk Score™ (anonymized)
- Behavioral Risk Intelligence™ (anonymized)
- ESG Sustainability Score™
- Compliance audit logs
- Export all data for regulatory filings
- Demo mode for government presentations

**Use Case:** Government regulators conducting audits and compliance reviews

---

## New Components

### Behavioral Risk Intelligence™ Components

1. **CognitiveFatigueIndex.tsx**
   - Tracks mental fatigue in real-time
   - Decision stability analysis
   - Reaction time monitoring
   - Session duration alerts

2. **ImpulseVsIntentionTable.tsx**
   - Impulse level scoring (0-100)
   - Intent alignment tracking
   - Pattern trend analysis
   - Critical decision flagging

3. **PersonaShiftChart.tsx** (already exists)
   - Personality type changes
   - Behavioral trajectory
   - Risk escalation prediction

4. **BehaviorTrendGraph.tsx** (already exists)
   - 7-day risk forecasting
   - Historical pattern analysis
   - Intervention effectiveness

### ESG Components

1. **ESGChart.tsx**
   - Player Wellbeing Index™
   - Casino Humanity Score™
   - Recovery Rate tracking
   - Responsible Marketing Score
   - Carbon Server Impact Score
   - Overall ESG Grade (A+ to F)

2. **ESGScoreCard.tsx** (already exists)
   - Real-time ESG metrics
   - Grade visualization
   - Compliance status

3. **CasinoComparisonChart.tsx**
   - Multi-casino benchmarking
   - Industry ranking
   - Performance comparisons

4. **InterventionHistoryTable.tsx**
   - Complete audit trail
   - Success rate tracking
   - Staff accountability
   - Export for compliance

### Access Control Components

1. **UserRoleGuard.tsx**
   - Role-based rendering
   - Module access control
   - Automatic fallback UI
   - Permission validation

2. **LegalDisclaimer** (in UserRoleGuard.tsx)
   - Mandatory disclaimer on all dashboards
   - Clarifies AI support vs automation
   - Human review requirement notice

---

## Demo Mode

### Purpose
Aggregate anonymized player data from ALL casinos for:
- Investor demonstrations
- Regulator presentations
- Casino pilot programs
- Industry research

### Demo Sync API

**Endpoint:** `/functions/v1/demo-sync-all-casinos`

**Access:** RISK_ANALYST and EXECUTIVE roles only

**Method:** POST

**Example:**
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/demo-sync-all-casinos`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  }
);
```

**Data Generated:**
- 50+ anonymized players per casino
- Behavioral insights with predictive analytics
- ESG scores with sustainability metrics
- All player IDs automatically anonymized (P_XXXXXXXX)

---

## Database Tables

### demo_players
Anonymized aggregate player data with:
- Risk scores and BRI scores
- Session metrics
- Betting patterns
- Persona classifications

### demo_behavioral_insights
Behavioral Risk Intelligence™ data:
- Impulse levels
- Cognitive fatigue index
- Personality shifts
- Predicted escalation
- Intervention recommendations

### demo_esg_scores
ESG Gambling Sustainability Score™:
- Player wellbeing metrics
- Casino humanity scores
- Recovery rates
- Marketing ethics
- Carbon footprint
- Final ESG grade (A+ to F)

### role_permissions
Granular module access control:
- Role-based permissions
- View/Edit/Export/Delete flags
- Module-level restrictions

---

## Export Functionality

### Available Exports (CSV Format)

1. **BRI Data Export**
```typescript
import { exportBRIData } from '@/lib/exportUtils';

exportBRIData(briRecords, casinoName);
```

2. **ESG Report Export**
```typescript
import { exportESGData } from '@/lib/exportUtils';

exportESGData(esgRecords);
```

3. **Intervention History Export**
```typescript
import { exportInterventionHistory } from '@/lib/exportUtils';

exportInterventionHistory(interventions, casinoName);
```

4. **Compliance Audit Report**
```typescript
import { exportComplianceAuditReport } from '@/lib/exportUtils';

exportComplianceAuditReport(casinoData, interventions, briData, esgData);
```

**All exports automatically:**
- Anonymize player IDs
- Include timestamps
- Format for regulatory compliance
- Add metadata headers

---

## Test Users

### Super Admin (EXECUTIVE Role)
- **Email:** admin@safeplayai.com
- **Password:** password123
- **Access:** ESG dashboards, demo mode, casino comparison

### Casino Admin (RISK_ANALYST Role)
- **Email:** admin@royalpalace.com
- **Password:** password123
- **Access:** Full BRI dashboard, interventions, player analytics

### Regulator (REGULATOR Role)
- **Email:** regulator@ncg.gov.za
- **Password:** password123
- **Access:** Read-only everything, full export capabilities

---

## Legal & Ethical Compliance

### Mandatory Disclaimer
Every dashboard displays:

> "SafeBet IQ is strictly an internal AI compliance support tool. It does not automate decisions or contact players directly. All suggested actions require human review. This system is for internal use by compliance teams, risk analysts, executives, and regulators only."

### Data Anonymization
- All player IDs converted to P_XXXXXXXX format
- No real identity ever stored in demo mode
- Export functions automatically anonymize
- Compliance with POPIA and GDPR

### No Player Access
- Players NEVER see this system
- No player-facing UIs
- Strictly B2B internal platform
- Enterprise SaaS + GovTech architecture

---

## Component Usage Examples

### Protected Content with UserRoleGuard
```tsx
import { UserRoleGuard } from '@/components/UserRoleGuard';

<UserRoleGuard allowedRoles={['RISK_ANALYST', 'REGULATOR']}>
  <BehavioralRiskDashboard />
</UserRoleGuard>
```

### Module-Based Access
```tsx
import { ModuleAccess } from '@/components/UserRoleGuard';

<ModuleAccess module="behavioral_risk_intelligence">
  <CognitiveFatigueIndex {...props} />
</ModuleAccess>
```

### Check Access in Code
```tsx
import { useHasAccess } from '@/components/UserRoleGuard';

const hasESGAccess = useHasAccess('esg_dashboard');

if (hasESGAccess) {
  // Show ESG features
}
```

### Legal Disclaimer
```tsx
import { LegalDisclaimer } from '@/components/UserRoleGuard';

<LegalDisclaimer />
```

---

## Architecture

### Modular Design
```
/modules/
  /behavioral-risk-intelligence/
    - CognitiveFatigueIndex.tsx
    - ImpulseVsIntentionTable.tsx
    - PersonaShiftChart.tsx

  /esg-scoring/
    - ESGChart.tsx
    - CasinoComparisonChart.tsx
    - ESGScoreCard.tsx

  /demo-mode/
    - DemoSyncButton.tsx
    - AnonymizedPlayerTable.tsx
```

### Future-Proof
Designed to extend to:
- Banking (transaction risk intelligence)
- Insurance (claims behavior analysis)
- Healthcare (patient compliance monitoring)
- HR (employee wellness tracking)
- Trading (investor risk profiling)

---

## Next Steps

1. **Run Demo Sync:**
   - Login as RISK_ANALYST
   - Call `/functions/v1/demo-sync-all-casinos`
   - Generates realistic demo data

2. **Test Role Access:**
   - Login as each role type
   - Verify access restrictions work
   - Test export functionality

3. **Generate Reports:**
   - Use export functions
   - Verify anonymization
   - Test regulatory audit exports

4. **Deploy to Production:**
   - Enable RLS policies
   - Configure production secrets
   - Set up monitoring

---

## Support

For technical support or role access issues, contact the platform administrator.

**REMEMBER:** This is a B2B compliance platform. Players never access this system.
