/*
  # Add Individual Module Pricing in ZAR

  1. Changes to software_modules Table
    - Add `price_monthly` column for individual module pricing
    - Set South African Rand (ZAR) prices for each module

  2. Pricing Strategy
    - Core modules: R0 (included in all packages)
    - Standard tier: R8,000 - R12,000/month per module
    - Premium tier: R18,000 - R25,000/month per module
    - Enterprise/AI tier: R35,000 - R50,000/month per module
    
  3. Market Positioning
    - Individual modules priced at premium to encourage package purchases
    - Buying 3-4 modules individually costs more than Standard package
    - Encourages customers to upgrade to higher-tier packages
    
  4. Module Pricing Breakdown
    **Core (Included - R0)**
    - Live Casino Dashboard
    - Player Management
    - Staff Management
    
    **Standard Tier (R8,000 - R12,000)**
    - Real-Time Analytics: R10,000
    - Live Casino Feed: R8,000
    - Compliance Audit System: R12,000
    - Intervention History: R8,000
    - Regulatory Reporting: R10,000
    - Certification Tracking: R9,000
    
    **Premium Tier (R18,000 - R25,000)**
    - AI Monitoring Indicators: R22,000
    - Behavioral Risk Intelligence: R25,000
    - Cognitive Fatigue Monitoring: R20,000
    - Persona Shift Detection: R18,000
    - ESG Reporting: R23,000
    - Training Academy: R20,000
    - Course Management: R15,000
    - Staff Training Assignments: R12,000
    
    **Enterprise/AI Tier (R35,000 - R50,000)**
    - SafePlay AI Risk Engine: R50,000
    - Predictive Analytics: R35,000
*/

-- Add price_monthly column to software_modules
ALTER TABLE software_modules 
ADD COLUMN IF NOT EXISTS price_monthly numeric(10,2) DEFAULT 0;

-- Update pricing for all modules

-- CORE MODULES (Included - R0)
UPDATE software_modules SET price_monthly = 0 WHERE slug IN (
  'live-dashboard',
  'player-management', 
  'staff-management'
);

-- STANDARD TIER (R8,000 - R12,000)
UPDATE software_modules SET price_monthly = 10000.00 WHERE slug = 'real-time-analytics';
UPDATE software_modules SET price_monthly = 8000.00 WHERE slug = 'live-feed';
UPDATE software_modules SET price_monthly = 12000.00 WHERE slug = 'compliance-audit';
UPDATE software_modules SET price_monthly = 8000.00 WHERE slug = 'intervention-history';
UPDATE software_modules SET price_monthly = 10000.00 WHERE slug = 'regulatory-reporting';
UPDATE software_modules SET price_monthly = 9000.00 WHERE slug = 'certification-tracking';

-- PREMIUM TIER (R12,000 - R25,000)
UPDATE software_modules SET price_monthly = 22000.00 WHERE slug = 'ai-monitoring';
UPDATE software_modules SET price_monthly = 25000.00 WHERE slug = 'behavioral-risk';
UPDATE software_modules SET price_monthly = 20000.00 WHERE slug = 'cognitive-fatigue';
UPDATE software_modules SET price_monthly = 18000.00 WHERE slug = 'persona-shift';
UPDATE software_modules SET price_monthly = 23000.00 WHERE slug = 'esg-reporting';
UPDATE software_modules SET price_monthly = 20000.00 WHERE slug = 'training-academy';
UPDATE software_modules SET price_monthly = 15000.00 WHERE slug = 'course-management';
UPDATE software_modules SET price_monthly = 12000.00 WHERE slug = 'training-assignments';

-- ENTERPRISE/AI TIER (R35,000 - R50,000)
UPDATE software_modules SET price_monthly = 50000.00 WHERE slug = 'safeplay-ai';
UPDATE software_modules SET price_monthly = 35000.00 WHERE slug = 'predictive-analytics';

-- Create index on price for sorting
CREATE INDEX IF NOT EXISTS idx_software_modules_price ON software_modules(price_monthly);
