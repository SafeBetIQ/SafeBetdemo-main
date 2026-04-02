/*
  # Seed King IV Principles and Outcomes
  
  Populates the King IV framework with all 17 principles and 4 outcomes,
  mapped to ESG categories with proper weightings.
  
  ## ESG Weighting Distribution
  - Environmental: 15%
  - Social: 55%
  - Governance: 30%
*/

-- Insert the 4 King IV Outcomes
INSERT INTO king_iv_outcomes (outcome_number, outcome_name, outcome_description, measurement_criteria) VALUES
(
  1,
  'Ethical Culture',
  'An organizational culture that cultivates responsible corporate citizenship, promotes an ethical culture, and demonstrates good corporate conduct',
  '["Leadership demonstrates ethical behavior", "Code of conduct actively enforced", "Whistleblowing mechanisms functional", "Ethical decision-making processes", "Values-driven culture evident"]'::jsonb
),
(
  2,
  'Good Performance',
  'Adequate and effective control of the organization, enabling it to prudently take risks in pursuit of sustainable growth',
  '["Risk management integrated into operations", "Performance targets achieved", "Strategic objectives met", "Resources optimally utilized", "Sustainable value creation demonstrated"]'::jsonb
),
(
  3,
  'Effective Control',
  'Trust and confidence of stakeholders and legitimacy in the eyes of society',
  '["Internal controls operating effectively", "Compliance frameworks functional", "Audit findings addressed", "Regulatory requirements met", "Risk appetite aligned with capacity"]'::jsonb
),
(
  4,
  'Legitimacy',
  'Legitimacy through transparent and accountable governance',
  '["Stakeholder trust maintained", "Transparency in reporting", "Accountability demonstrated", "Social license to operate", "Regulatory relationships strong"]'::jsonb
);

-- Insert the 17 King IV Principles with ESG Mapping

-- LEADERSHIP, ETHICS & CORPORATE CITIZENSHIP (Principles 1-3)
INSERT INTO king_iv_principles (
  principle_number, principle_title, principle_description, principle_category, 
  esg_category, esg_weighting, recommended_practices
) VALUES
(
  1,
  'The governing body should lead ethically and effectively',
  'Leadership based on ethical foundation, responsible corporate citizenship, and sustainable development',
  'leadership_ethics_citizenship',
  'governance',
  1.8,
  '["Establish ethical leadership framework", "Board charter defining ethical standards", "Regular ethics training for board", "Ethical culture assessment"]'::jsonb
),
(
  2,
  'The governing body should govern the ethics of the organization',
  'Setting the tone for ethical culture, monitoring ethical performance, ensuring ethical standards',
  'leadership_ethics_citizenship',
  'governance',
  1.8,
  '["Code of ethics approved by board", "Ethics officer appointed", "Ethics hotline operational", "Annual ethics report to board"]'::jsonb
),
(
  3,
  'The governing body should ensure responsible corporate citizenship',
  'Responsibility beyond financial performance including social, environmental, and economic impacts',
  'leadership_ethics_citizenship',
  'social',
  3.5,
  '["Corporate citizenship policy", "Community impact assessments", "Stakeholder engagement programs", "Responsible gambling initiatives"]'::jsonb
);

-- STRATEGY, PERFORMANCE & REPORTING (Principles 4-5)
INSERT INTO king_iv_principles (
  principle_number, principle_title, principle_description, principle_category, 
  esg_category, esg_weighting, recommended_practices
) VALUES
(
  4,
  'The governing body should appreciate that strategy, risk, performance and sustainability are inseparable',
  'Integrated thinking linking strategy, risk opportunities, performance, and sustainable development',
  'strategy_performance_reporting',
  'governance',
  1.8,
  '["Integrated strategy development", "Risk-opportunity assessments", "Sustainability integrated into strategy", "Regular strategy reviews"]'::jsonb
),
(
  5,
  'The governing body should ensure reports enable stakeholders to make informed assessments',
  'Transparent, accurate, complete, and reliable reporting to stakeholders',
  'strategy_performance_reporting',
  'governance',
  1.8,
  '["Integrated annual report", "Transparent disclosure practices", "Material matters identified", "Stakeholder-relevant reporting"]'::jsonb
);

-- GOVERNING STRUCTURES & DELEGATION (Principles 6-7)
INSERT INTO king_iv_principles (
  principle_number, principle_title, principle_description, principle_category, 
  esg_category, esg_weighting, recommended_practices
) VALUES
(
  6,
  'The governing body should serve as the focal point for corporate governance',
  'Primary accountability for governance, setting direction, approving policy, overseeing management',
  'governing_structures',
  'governance',
  1.8,
  '["Board structure defined", "Clear terms of reference", "Board effectiveness evaluations", "Regular board meetings documented"]'::jsonb
),
(
  7,
  'The governing body should comprise appropriate balance of knowledge, skills, diversity',
  'Competence, diversity of thought, independence, and objectivity in board composition',
  'governing_structures',
  'governance',
  1.8,
  '["Skills matrix maintained", "Diversity policy implemented", "Independence assessments", "Succession planning active"]'::jsonb
);

-- GOVERNANCE FUNCTIONAL AREAS (Principles 8-11)
INSERT INTO king_iv_principles (
  principle_number, principle_title, principle_description, principle_category, 
  esg_category, esg_weighting, recommended_practices
) VALUES
(
  8,
  'The governing body should ensure its arrangements for delegation foster effective leadership',
  'Clear delegation framework, role clarity, appropriate committee structures',
  'governance_functional_areas',
  'governance',
  1.8,
  '["Delegation of authority framework", "Committee charters approved", "Role definitions documented", "Reporting lines clear"]'::jsonb
),
(
  9,
  'The governing body should ensure evaluations of its own performance',
  'Regular assessment of board, committee, and individual member performance',
  'governance_functional_areas',
  'governance',
  1.8,
  '["Annual board evaluations", "Committee performance reviews", "Individual director assessments", "Action plans for improvement"]'::jsonb
),
(
  10,
  'The governing body should ensure an effective and independent audit committee',
  'Audit committee providing independent oversight of financial reporting, risk, and internal controls',
  'governance_functional_areas',
  'governance',
  1.8,
  '["Audit committee charter", "Independent members appointed", "Regular audit committee meetings", "External auditor relationships managed"]'::jsonb
),
(
  11,
  'The governing body should govern risk in a way that supports the organization',
  'Risk governance framework enabling informed risk-taking in pursuit of opportunities',
  'governance_functional_areas',
  'governance',
  1.8,
  '["Enterprise risk management framework", "Risk appetite statement", "Risk reporting to board", "Emerging risks monitored"]'::jsonb
);

-- STAKEHOLDER RELATIONSHIPS (Principles 12-17)
INSERT INTO king_iv_principles (
  principle_number, principle_title, principle_description, principle_category, 
  esg_category, esg_weighting, recommended_practices
) VALUES
(
  12,
  'The governing body should govern technology and information',
  'Technology and information governance supporting business resilience and sustainability',
  'stakeholder_relationships',
  'governance',
  1.8,
  '["IT governance framework", "Cybersecurity policies", "Data protection compliance", "Technology risk assessments"]'::jsonb
),
(
  13,
  'The governing body should govern compliance with laws, rules, codes and standards',
  'Compliance as integral to business sustainability and license to operate',
  'stakeholder_relationships',
  'governance',
  3.6,
  '["Compliance framework established", "Regulatory obligations tracked", "Compliance monitoring program", "Compliance culture promoted"]'::jsonb
),
(
  14,
  'The governing body should ensure remuneration is fair, responsible and transparent',
  'Remuneration policies aligned with strategy, creating value, and fairly distributed',
  'stakeholder_relationships',
  'governance',
  1.8,
  '["Remuneration policy approved", "Pay-for-performance alignment", "Remuneration disclosure", "Stakeholder feedback considered"]'::jsonb
),
(
  15,
  'The governing body should ensure assurance results in an adequate and effective control environment',
  'Combined assurance model providing coordinated approach to assurance activities',
  'stakeholder_relationships',
  'governance',
  1.8,
  '["Combined assurance framework", "Three lines of defense model", "Assurance coverage map", "Internal audit function effective"]'::jsonb
),
(
  16,
  'The governing body should govern stakeholder relationships appropriately',
  'Inclusive stakeholder approach balancing needs and expectations of material stakeholders',
  'stakeholder_relationships',
  'social',
  18.5,
  '["Stakeholder identification and prioritization", "Engagement mechanisms established", "Stakeholder concerns addressed", "Material issues identified through engagement"]'::jsonb
),
(
  17,
  'The governing body should assume responsibility for organizational performance and reporting',
  'Accountability for performance, integrated thinking, and reporting transparency',
  'stakeholder_relationships',
  'social',
  33.0,
  '["Performance monitoring frameworks", "KPIs aligned to strategy", "Regular performance reporting", "Integrated reporting practices", "Responsible gambling metrics tracked", "Player protection outcomes measured", "Employee competency demonstrated", "Community impact reported"]'::jsonb
);

-- Insert ESG Metric Mappings

-- Environmental Metrics (15% total)
INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Operational Energy Efficiency',
  'Monitoring and reduction of energy consumption in casino operations (indirect ESG impact)',
  'environmental',
  id,
  ARRAY[(SELECT id FROM king_iv_outcomes WHERE outcome_number = 2)]::uuid[],
  'Monthly energy consumption tracking (kWh)',
  '["Energy bills", "Consumption logs", "Year-over-year comparison"]'::jsonb,
  'renewable_energy_kwh / (renewable_energy_kwh + total_energy_kwh) * 100'
FROM king_iv_principles WHERE principle_number = 4;

-- Social Metrics (55% total) - Player Protection & Staff Competency
INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Player Protection Intervention Rate',
  'Percentage of at-risk players identified and engaged through AI-driven interventions',
  'social',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 1),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 3),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 4)
  ]::uuid[],
  'AI risk detection + intervention tracking',
  '["Intervention logs", "Player risk scores", "Follow-up records", "Outcome documentation"]'::jsonb,
  '(interventions_performed / high_risk_players_identified) * 100'
FROM king_iv_principles WHERE principle_number = 17;

INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Employee RG Training Completion Rate',
  'Percentage of staff completing accredited responsible gambling training programs',
  'social',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 1),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 2)
  ]::uuid[],
  'Training records from SARGF-accredited programs',
  '["Training certificates", "Completion records", "Assessment scores", "Renewal tracking"]'::jsonb,
  '(employees_trained / total_staff) * 100'
FROM king_iv_principles WHERE principle_number = 17;

INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Self-Exclusion Program Effectiveness',
  'Compliance rate and support provided for self-exclusion participants',
  'social',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 3),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 4)
  ]::uuid[],
  'Self-exclusion registry tracking + counseling completion',
  '["Self-exclusion records", "Counseling session logs", "Reinstatement assessments", "Breach monitoring"]'::jsonb,
  '(counseling_sessions_completed / counseling_sessions_required) * 100'
FROM king_iv_principles WHERE principle_number = 16;

INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'NRGP Financial Contribution Compliance',
  'Contribution to National Responsible Gambling Programme as percentage of revenue',
  'social',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 1),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 4)
  ]::uuid[],
  'Financial contributions tracking against regulatory requirements',
  '["Payment receipts", "NRGP confirmation", "Revenue records", "Contribution certificates"]'::jsonb,
  'nrgp_contribution_amount / total_revenue * 100'
FROM king_iv_principles WHERE principle_number = 3;

-- Governance Metrics (30% total)
INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Regulatory Compliance Rate',
  'Percentage of regulatory requirements met and audits passed',
  'governance',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 3),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 4)
  ]::uuid[],
  'Audit results + regulatory submissions tracking',
  '["Audit reports", "Compliance certificates", "Regulatory correspondence", "Issue resolution records"]'::jsonb,
  '(compliance_audits_passed / (compliance_audits_passed + regulatory_violations)) * 100'
FROM king_iv_principles WHERE principle_number = 13;

INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Risk Identification Timeliness',
  'Speed and accuracy of AI-driven risk detection (measured in hours from trigger to identification)',
  'governance',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 2),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 3)
  ]::uuid[],
  'System logs tracking risk detection latency',
  '["AI detection logs", "Timestamp records", "Alert generation logs", "Response time metrics"]'::jsonb,
  'AVG(detection_timestamp - trigger_timestamp)'
FROM king_iv_principles WHERE principle_number = 11;

INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Audit Trail Completeness',
  'Percentage of compliance actions with complete, time-stamped audit evidence',
  'governance',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 3),
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 4)
  ]::uuid[],
  'Audit log analysis + evidence verification',
  '["System audit logs", "Evidence documents", "Timestamp verification", "Chain of custody records"]'::jsonb,
  '(actions_with_complete_evidence / total_compliance_actions) * 100'
FROM king_iv_principles WHERE principle_number = 15;

INSERT INTO esg_king_iv_mapping (
  esg_metric_name, esg_metric_description, esg_category, king_iv_principle_id,
  king_iv_outcome_ids, measurement_method, evidence_requirements, calculation_formula
)
SELECT 
  'Transparency in ESG Reporting',
  'Completeness and timeliness of ESG reports submitted to regulators and stakeholders',
  'governance',
  id,
  ARRAY[
    (SELECT id FROM king_iv_outcomes WHERE outcome_number = 4)
  ]::uuid[],
  'Report submission tracking + content completeness assessment',
  '["Submitted reports", "Regulator acknowledgments", "Stakeholder feedback", "Disclosure checklists"]'::jsonb,
  '(reports_submitted_on_time / total_required_reports) * 100'
FROM king_iv_principles WHERE principle_number = 5;
