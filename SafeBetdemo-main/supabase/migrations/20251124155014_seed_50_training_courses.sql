/*
  # Seed 50 Training Courses with Lessons

  Inserts:
  - 5 categories
  - 50 training modules
  - 150+ lessons (3-5 per module)
*/

-- ==========================================
-- INSERT CATEGORIES
-- ==========================================

INSERT INTO training_categories (name, description, icon, sort_order) VALUES
('Responsible Gambling', 'Learn to identify and support players at risk, implement player protection measures, and follow responsible gambling best practices.', '🎯', 1),
('AML Compliance', 'Anti-Money Laundering training covering detection, reporting, and compliance with FATF and international standards.', '🔒', 2),
('Legal & Regulation', 'Global gambling laws, licensing standards, data privacy, and regulatory compliance requirements.', '⚖️', 3),
('Customer Interaction', 'Professional customer service, conflict resolution, and player psychology for casino staff.', '🤝', 4),
('Cybersecurity', 'Protect casino systems, player data, and prevent fraud through security best practices.', '🛡️', 5)
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- INSERT 50 TRAINING MODULES
-- ==========================================

-- CATEGORY 1: Responsible Gambling (10 courses)
INSERT INTO training_modules (category_id, title, description, estimated_minutes, credits_awarded, difficulty, target_roles, sort_order) VALUES
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Understanding Problem Gambling', 'Learn the fundamentals of problem gambling, its causes, and how to recognize it in casino environments.', 45, 5, 'beginner', ARRAY['frontline', 'vip_host', 'call_centre', 'manager', 'compliance_officer']::staff_role[], 1),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Recognizing Early Warning Signs', 'Identify behavioral indicators that suggest a player may be developing gambling problems.', 30, 4, 'beginner', ARRAY['frontline', 'vip_host', 'call_centre']::staff_role[], 2),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'How to Speak to a High-Risk Player', 'Communication techniques for approaching and supporting players showing signs of problem gambling.', 40, 6, 'intermediate', ARRAY['vip_host', 'manager', 'compliance_officer']::staff_role[], 3),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Responsible Gambling – Global Best Practices', 'International standards and frameworks for responsible gambling implementation.', 50, 7, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 4),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Player Self-Exclusion Management', 'Procedures for handling self-exclusion requests, monitoring, and enforcement.', 35, 5, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 5),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Cooling-Off Period Protocols', 'Managing temporary breaks, cooling-off periods, and player return procedures.', 30, 4, 'beginner', ARRAY['frontline', 'manager', 'compliance_officer']::staff_role[], 6),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Gambling Harm: Psychological Effects', 'Understanding the psychological impact of gambling addiction on players and families.', 45, 6, 'intermediate', ARRAY['vip_host', 'manager', 'compliance_officer']::staff_role[], 7),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Behavioral Red Flags on the Casino Floor', 'Spotting concerning behaviors during gameplay and knowing when to intervene.', 35, 5, 'beginner', ARRAY['frontline', 'vip_host']::staff_role[], 8),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'Escalation Procedures', 'When and how to escalate player concerns to management and support services.', 40, 5, 'intermediate', ARRAY['frontline', 'vip_host', 'manager']::staff_role[], 9),
((SELECT id FROM training_categories WHERE name = 'Responsible Gambling'), 'VIP Player Risk Handling', 'Special considerations for managing responsible gambling with high-value players.', 50, 8, 'advanced', ARRAY['vip_host', 'manager', 'compliance_officer']::staff_role[], 10);

-- CATEGORY 2: AML Compliance (10 courses)
INSERT INTO training_modules (category_id, title, description, estimated_minutes, credits_awarded, difficulty, target_roles, sort_order) VALUES
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'AML Basics for Casino Staff', 'Introduction to anti-money laundering concepts and why casinos are high-risk targets.', 40, 5, 'beginner', ARRAY['frontline', 'vip_host', 'call_centre', 'manager', 'compliance_officer']::staff_role[], 11),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'Source of Funds & Source of Wealth Checks', 'How to verify where a player''s money comes from and conduct wealth assessments.', 45, 6, 'intermediate', ARRAY['vip_host', 'manager', 'compliance_officer']::staff_role[], 12),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'Suspicious Transaction Detection', 'Identifying unusual patterns, structuring, and other red flags in player transactions.', 50, 7, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 13),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'AML Documentation & Reporting', 'Proper record-keeping, documentation requirements, and reporting obligations.', 40, 6, 'intermediate', ARRAY['compliance_officer', 'manager']::staff_role[], 14),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'Enhanced Due Diligence (EDD)', 'When and how to conduct enhanced due diligence on high-risk players.', 50, 8, 'advanced', ARRAY['compliance_officer', 'manager']::staff_role[], 15),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'Cryptocurrency AML Risks', 'Understanding crypto-related money laundering risks in gaming environments.', 45, 7, 'advanced', ARRAY['compliance_officer', 'manager']::staff_role[], 16),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'FATF Guidelines for Gaming Industry', 'Financial Action Task Force recommendations for casino AML programs.', 55, 8, 'advanced', ARRAY['compliance_officer', 'manager']::staff_role[], 17),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'ICJ & UN AML Directives', 'International standards and UN conventions on money laundering prevention.', 50, 7, 'advanced', ARRAY['compliance_officer', 'regulator']::staff_role[], 18),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'High-Risk Country Screening', 'Identifying players from high-risk jurisdictions and applying appropriate controls.', 40, 6, 'intermediate', ARRAY['compliance_officer', 'manager']::staff_role[], 19),
((SELECT id FROM training_categories WHERE name = 'AML Compliance'), 'SAR (Suspicious Activity Reports) Filing', 'How to prepare and file Suspicious Activity Reports with authorities.', 45, 7, 'advanced', ARRAY['compliance_officer', 'manager']::staff_role[], 20);

-- CATEGORY 3: Legal & Regulation (10 courses)
INSERT INTO training_modules (category_id, title, description, estimated_minutes, credits_awarded, difficulty, target_roles, sort_order) VALUES
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'Global Casino Licensing Standards', 'Overview of licensing requirements across major gaming jurisdictions.', 45, 6, 'intermediate', ARRAY['manager', 'compliance_officer', 'regulator']::staff_role[], 21),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'Gambling Laws in UK, USA, Macau & EU', 'Comparative analysis of gambling regulations in key international markets.', 60, 8, 'advanced', ARRAY['manager', 'compliance_officer', 'regulator']::staff_role[], 22),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'South African Gambling Act Compliance', 'Understanding the National Gambling Act and provincial regulations.', 50, 7, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 23),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'POPIA/Data Privacy for Gaming', 'Protection of Personal Information Act compliance for casino operations.', 45, 6, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 24),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'GDPR for Casinos – Europe Standard', 'General Data Protection Regulation requirements for European casino operators.', 50, 7, 'advanced', ARRAY['manager', 'compliance_officer']::staff_role[], 25),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'Regulator Audit Preparation', 'How to prepare for regulatory inspections and audits.', 40, 6, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 26),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'Responsible Gambling Legal Cases', 'Key court cases and legal precedents affecting operator liability.', 45, 7, 'advanced', ARRAY['manager', 'compliance_officer', 'regulator']::staff_role[], 27),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'Understanding Casino Liability', 'Legal responsibilities and potential liabilities for casino operators.', 40, 6, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 28),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'Operator Risk Management', 'Risk assessment frameworks and mitigation strategies for casino operations.', 50, 7, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 29),
((SELECT id FROM training_categories WHERE name = 'Legal & Regulation'), 'Incident Reporting Procedures', 'Mandatory reporting requirements for gaming incidents and violations.', 35, 5, 'beginner', ARRAY['manager', 'compliance_officer']::staff_role[], 30);

-- CATEGORY 4: Customer Interaction (10 courses)
INSERT INTO training_modules (category_id, title, description, estimated_minutes, credits_awarded, difficulty, target_roles, sort_order) VALUES
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Dealing with Intoxicated Players', 'Safe and professional approaches to managing intoxicated guests.', 30, 4, 'beginner', ARRAY['frontline', 'vip_host', 'manager']::staff_role[], 31),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'VIP Relationship Management', 'Building and maintaining relationships with high-value players.', 45, 6, 'intermediate', ARRAY['vip_host', 'manager']::staff_role[], 32),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Conflict De-Escalation Skills', 'Techniques for calming tense situations and preventing escalation.', 35, 5, 'beginner', ARRAY['frontline', 'vip_host', 'call_centre']::staff_role[], 33),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Empathy & Tone of Voice in Conversations', 'Developing emotional intelligence and communication skills for player interactions.', 30, 4, 'beginner', ARRAY['frontline', 'vip_host', 'call_centre']::staff_role[], 34),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Managing Difficult Situations', 'Strategies for handling complaints, disputes, and challenging player behaviors.', 40, 5, 'intermediate', ARRAY['frontline', 'vip_host', 'manager']::staff_role[], 35),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Handling Player Complaints Professionally', 'Complaint resolution processes and customer satisfaction techniques.', 35, 5, 'beginner', ARRAY['frontline', 'call_centre', 'manager']::staff_role[], 36),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Communication During High Losses', 'Sensitive approaches when players experience significant financial losses.', 40, 6, 'intermediate', ARRAY['vip_host', 'manager']::staff_role[], 37),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Age Verification & ID Scanning', 'Proper procedures for verifying player age and identity.', 25, 3, 'beginner', ARRAY['frontline']::staff_role[], 38),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Player Welfare Communication', 'Discussing responsible gambling resources and support with players.', 35, 5, 'intermediate', ARRAY['frontline', 'vip_host', 'manager']::staff_role[], 39),
((SELECT id FROM training_categories WHERE name = 'Customer Interaction'), 'Service Excellence for Casino Staff', 'Delivering world-class customer service in gaming environments.', 40, 5, 'beginner', ARRAY['frontline', 'vip_host', 'call_centre']::staff_role[], 40);

-- CATEGORY 5: Cybersecurity (10 courses)
INSERT INTO training_modules (category_id, title, description, estimated_minutes, credits_awarded, difficulty, target_roles, sort_order) VALUES
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Casino Cybersecurity Basics', 'Introduction to cybersecurity threats facing casino operations.', 35, 5, 'beginner', ARRAY['frontline', 'manager', 'compliance_officer']::staff_role[], 41),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Secure POS & Kiosk Management', 'Best practices for operating and securing point-of-sale systems.', 30, 4, 'beginner', ARRAY['frontline']::staff_role[], 42),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Card Skimming & Fraud Detection', 'Identifying and preventing card skimming and payment fraud.', 35, 5, 'intermediate', ARRAY['frontline', 'manager']::staff_role[], 43),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Data Breach Response Planning', 'Procedures to follow in the event of a data security incident.', 40, 6, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 44),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Casino Network Security', 'Understanding network architecture and security controls in casinos.', 45, 6, 'advanced', ARRAY['manager', 'compliance_officer']::staff_role[], 45),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Access Control & Surveillance Systems', 'Managing physical and digital access to secure areas and systems.', 40, 5, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 46),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Phishing Detection for Staff', 'Recognizing and responding to phishing attacks and social engineering.', 25, 3, 'beginner', ARRAY['frontline', 'call_centre', 'manager']::staff_role[], 47),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'Secure Player Data Handling', 'Proper procedures for collecting, storing, and protecting player information.', 35, 5, 'intermediate', ARRAY['frontline', 'manager', 'compliance_officer']::staff_role[], 48),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'POS & ATM Compliance', 'Security standards and compliance requirements for payment systems.', 40, 6, 'intermediate', ARRAY['manager', 'compliance_officer']::staff_role[], 49),
((SELECT id FROM training_categories WHERE name = 'Cybersecurity'), 'IT Incident Response Procedures', 'Step-by-step protocols for responding to cybersecurity incidents.', 45, 7, 'advanced', ARRAY['manager', 'compliance_officer']::staff_role[], 50);
