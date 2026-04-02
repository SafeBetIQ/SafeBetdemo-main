/*
  # Seed Software Modules

  ## Overview
  This migration seeds the available software modules that can be assigned to casinos.
  
  ## Module Categories
  - **core**: Essential platform features
  - **analytics**: Data analysis and reporting features
  - **compliance**: Regulatory and compliance tools
  - **training**: Staff training and education
  - **ai**: AI-powered features

  ## Price Tiers
  - **included**: Free with base platform
  - **standard**: Standard pricing tier
  - **premium**: Premium features
  - **enterprise**: Enterprise-level features
*/

-- Insert core modules
INSERT INTO software_modules (name, slug, description, category, price_tier, sort_order) VALUES
  ('Live Casino Dashboard', 'live-dashboard', 'Real-time monitoring of casino operations and player activity', 'core', 'included', 1),
  ('Player Management', 'player-management', 'Basic player tracking and session monitoring', 'core', 'included', 2),
  ('Staff Management', 'staff-management', 'Manage casino staff accounts and permissions', 'core', 'included', 3)
ON CONFLICT (slug) DO NOTHING;

-- Insert analytics modules
INSERT INTO software_modules (name, slug, description, category, price_tier, sort_order) VALUES
  ('Behavioral Risk Intelligence', 'behavioral-risk', 'AI-powered behavioral risk analysis and early intervention system', 'analytics', 'premium', 10),
  ('Real-Time Analytics', 'real-time-analytics', 'Advanced real-time data analytics and insights', 'analytics', 'standard', 11),
  ('Live Casino Feed', 'live-feed', 'Live streaming of player activity and risk scores', 'analytics', 'standard', 12),
  ('Cognitive Fatigue Monitoring', 'cognitive-fatigue', 'Track and analyze player cognitive fatigue indicators', 'analytics', 'premium', 13),
  ('Persona Shift Detection', 'persona-shift', 'AI detection of behavioral pattern changes', 'analytics', 'premium', 14)
ON CONFLICT (slug) DO NOTHING;

-- Insert compliance modules
INSERT INTO software_modules (name, slug, description, category, price_tier, sort_order) VALUES
  ('ESG Reporting', 'esg-reporting', 'Environmental, Social, and Governance compliance reporting', 'compliance', 'premium', 20),
  ('Compliance Audit System', 'compliance-audit', 'Automated compliance tracking and audit trail', 'compliance', 'standard', 21),
  ('Intervention History', 'intervention-history', 'Track all responsible gaming interventions', 'compliance', 'standard', 22),
  ('Regulatory Reporting', 'regulatory-reporting', 'Generate reports for regulatory bodies', 'compliance', 'standard', 23)
ON CONFLICT (slug) DO NOTHING;

-- Insert training modules
INSERT INTO software_modules (name, slug, description, category, price_tier, sort_order) VALUES
  ('Training Academy', 'training-academy', 'Comprehensive staff training and certification system', 'training', 'premium', 30),
  ('Course Management', 'course-management', 'Create and manage training courses', 'training', 'premium', 31),
  ('Staff Training Assignments', 'training-assignments', 'Assign and track mandatory staff training', 'training', 'premium', 32),
  ('Certification Tracking', 'certification-tracking', 'Track staff certifications and compliance', 'training', 'standard', 33)
ON CONFLICT (slug) DO NOTHING;

-- Insert AI modules
INSERT INTO software_modules (name, slug, description, category, price_tier, sort_order) VALUES
  ('SafePlay AI Risk Engine', 'safeplay-ai', 'Advanced AI risk prediction and intervention system', 'ai', 'enterprise', 40),
  ('AI Monitoring Indicators', 'ai-monitoring', 'Real-time AI monitoring of player behavior', 'ai', 'premium', 41),
  ('Predictive Analytics', 'predictive-analytics', 'Machine learning-based risk predictions', 'ai', 'enterprise', 42)
ON CONFLICT (slug) DO NOTHING;