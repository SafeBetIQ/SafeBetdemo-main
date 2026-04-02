/*
  # Seed Compliance Controls

  ## Summary
  Seeds a representative set of controls for all 4 frameworks
  across all active casinos. Controls start as 'not_assessed'
  so operators can work through them.

  ### Control counts per framework
  - ISO 27001:  24 controls (Annex A key controls)
  - SOC 2:      16 controls (Trust Services Criteria)
  - GDPR:       12 controls (key GDPR obligations)
  - POPIA:      10 controls (POPIA conditions)
*/

DO $$
DECLARE
  fw_iso  uuid;
  fw_soc  uuid;
  fw_gdpr uuid;
  fw_pop  uuid;
  c       record;
BEGIN
  SELECT id INTO fw_iso  FROM compliance_frameworks WHERE code = 'ISO27001';
  SELECT id INTO fw_soc  FROM compliance_frameworks WHERE code = 'SOC2';
  SELECT id INTO fw_gdpr FROM compliance_frameworks WHERE code = 'GDPR';
  SELECT id INTO fw_pop  FROM compliance_frameworks WHERE code = 'POPIA';

  FOR c IN SELECT id FROM casinos WHERE is_active = true LOOP

    -- ── ISO 27001 CONTROLS ──────────────────────────────────
    INSERT INTO compliance_controls (framework_id, casino_id, control_id, control_name, category, description, risk_level, status)
    VALUES
      (fw_iso, c.id, 'A.5.1',  'Information Security Policies',           'Organisational Controls',   'Policies for information security defined and approved by management', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.5.2',  'Information Security Roles',              'Organisational Controls',   'All information security responsibilities defined and allocated', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.6.1',  'Screening',                               'People Controls',           'Background verification checks on all candidates', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.6.3',  'Information Security Awareness Training', 'People Controls',           'Employees trained on security policies and procedures', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.7.1',  'Physical Security Perimeters',            'Physical Controls',         'Physical security perimeters defined and implemented', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.8.1',  'User Endpoint Devices',                   'Technology Controls',       'Management of user endpoint devices', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.8.2',  'Privileged Access Rights',                'Technology Controls',       'Privileged access rights allocated and restricted', 'critical', 'not_assessed'),
      (fw_iso, c.id, 'A.8.3',  'Information Access Restriction',          'Technology Controls',       'Access to information and application system functions restricted', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.5',  'Secure Authentication',                   'Technology Controls',       'Secure authentication technologies and procedures implemented', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.7',  'Protection Against Malware',              'Technology Controls',       'Protection against malware implemented and supported by user awareness', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.10', 'Information Deletion',                    'Technology Controls',       'Information stored on systems deleted when no longer required', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.8.11', 'Data Masking',                            'Technology Controls',       'Data masking used in accordance with access control policy and business/legal requirements', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.12', 'Data Leakage Prevention',                 'Technology Controls',       'Data leakage prevention measures applied to systems and networks', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.15', 'Logging',                                 'Technology Controls',       'Logs produced, stored, protected and analysed', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.16', 'Monitoring Activities',                   'Technology Controls',       'Networks, systems and applications monitored for anomalous behaviour', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.20', 'Networks Security',                       'Technology Controls',       'Networks and network devices secured, managed and controlled', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.21', 'Security of Network Services',            'Technology Controls',       'Security mechanisms, service levels and requirements of network services identified', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.8.24', 'Use of Cryptography',                     'Technology Controls',       'Rules for use of cryptography defined and implemented', 'critical', 'not_assessed'),
      (fw_iso, c.id, 'A.8.25', 'Secure Development Lifecycle',            'Technology Controls',       'Rules for secure development established and applied', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.28', 'Secure Coding',                           'Technology Controls',       'Secure coding principles applied to software development', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.8.32', 'Change Management',                       'Technology Controls',       'Changes to information processing facilities and systems subject to change management procedures', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.5.23', 'Information Security for Cloud Services', 'Organisational Controls',   'Processes for acquisition, use, management and exit of cloud services', 'high', 'not_assessed'),
      (fw_iso, c.id, 'A.5.29', 'Information Security During Disruption',  'Organisational Controls',   'Information security maintained during disruption', 'medium', 'not_assessed'),
      (fw_iso, c.id, 'A.5.34', 'Privacy and PII Protection',              'Organisational Controls',   'Privacy and protection of PII maintained as required by legislation', 'critical', 'not_assessed')
    ON CONFLICT DO NOTHING;

    -- ── SOC 2 CONTROLS ──────────────────────────────────────
    INSERT INTO compliance_controls (framework_id, casino_id, control_id, control_name, category, description, risk_level, status)
    VALUES
      (fw_soc, c.id, 'CC1.1', 'COSO Principle 1 — Commitment to Integrity',    'Control Environment',    'Management demonstrates commitment to integrity and ethical values', 'medium', 'not_assessed'),
      (fw_soc, c.id, 'CC2.1', 'COSO Principle 6 — Objectives',                 'Communication',          'Organisational objectives communicated to support risk assessment', 'medium', 'not_assessed'),
      (fw_soc, c.id, 'CC3.1', 'COSO Principle 6 — Risk Identification',        'Risk Assessment',        'Risks to achievement of objectives are identified and analysed', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC4.1', 'COSO Principle 16 — Ongoing Evaluations',       'Monitoring Activities',  'Ongoing and separate evaluations used to assess internal controls', 'medium', 'not_assessed'),
      (fw_soc, c.id, 'CC5.1', 'COSO Principle 10 — Control Selection',         'Control Activities',     'Control activities selected and developed to mitigate risks', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC6.1', 'Logical Access — Restriction',                  'Logical Access',         'Logical access security software, infrastructure, and architectures implemented', 'critical', 'not_assessed'),
      (fw_soc, c.id, 'CC6.2', 'Logical Access — Prior to Registration',        'Logical Access',         'Prior to issuing system credentials and granting system access, entity registers authorised users', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC6.3', 'Logical Access — Role-Based',                   'Logical Access',         'Role-based access controls used to restrict access to data and systems', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC6.6', 'Logical Access — External Threats',             'Logical Access',         'Measures implemented to prevent external threats from accessing systems', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC6.7', 'Logical Access — Transmission Encryption',      'Logical Access',         'Transmission of data encrypted in transit', 'critical', 'not_assessed'),
      (fw_soc, c.id, 'CC7.1', 'System Operations — Vulnerabilities',           'System Operations',      'Vulnerabilities in system components detected and monitored', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC7.2', 'System Operations — Anomaly Detection',         'System Operations',      'System components monitored to detect and protect against security threats', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC7.3', 'Incident Response — Evaluation',                'Incident Response',      'Security events evaluated to determine if they constitute incidents', 'high', 'not_assessed'),
      (fw_soc, c.id, 'CC8.1', 'Change Management — Infrastructure',            'Change Management',      'Changes to infrastructure, data, software and procedures managed', 'medium', 'not_assessed'),
      (fw_soc, c.id, 'CC9.1', 'Risk Mitigation — Vendor Management',           'Risk Mitigation',        'Risks from vendors and business partners identified and managed', 'medium', 'not_assessed'),
      (fw_soc, c.id, 'P1.1',  'Privacy — Notice',                              'Privacy',                'Notice provided to data subjects about data collection and use', 'high', 'not_assessed')
    ON CONFLICT DO NOTHING;

    -- ── GDPR CONTROLS ────────────────────────────────────────
    INSERT INTO compliance_controls (framework_id, casino_id, control_id, control_name, category, description, risk_level, status)
    VALUES
      (fw_gdpr, c.id, 'GDPR-5',   'Principles of Processing',               'Lawfulness',         'Personal data processed lawfully, fairly and transparently', 'critical', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-6',   'Lawful Basis for Processing',            'Lawfulness',         'At least one lawful basis identified for each processing activity', 'critical', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-7',   'Consent Management',                     'Consent',            'Consent obtained, recorded and withdrawal mechanisms provided', 'high', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-12',  'Transparent Information',                'Data Subject Rights','Clear privacy information provided to data subjects', 'high', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-15',  'Right of Access',                        'Data Subject Rights','Procedures for handling subject access requests within 30 days', 'high', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-17',  'Right to Erasure',                       'Data Subject Rights','Right to erasure (right to be forgotten) procedures implemented', 'high', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-20',  'Right to Data Portability',              'Data Subject Rights','Data portability procedures in place', 'medium', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-25',  'Data Protection by Design',              'Technical Measures', 'Privacy by design and by default implemented in systems', 'critical', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-30',  'Records of Processing Activities',       'Accountability',     'ROPA maintained for all processing activities', 'high', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-32',  'Security of Processing',                 'Technical Measures', 'Appropriate technical and organisational measures for data security', 'critical', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-33',  'Breach Notification — Supervisory Authority', 'Breach',        'Data breaches notified to supervisory authority within 72 hours', 'critical', 'not_assessed'),
      (fw_gdpr, c.id, 'GDPR-35',  'Data Protection Impact Assessment',      'Accountability',     'DPIAs conducted for high-risk processing activities', 'high', 'not_assessed')
    ON CONFLICT DO NOTHING;

    -- ── POPIA CONTROLS ────────────────────────────────────────
    INSERT INTO compliance_controls (framework_id, casino_id, control_id, control_name, category, description, risk_level, status)
    VALUES
      (fw_pop, c.id, 'POPIA-4',  'Accountability',                          'Accountability',     'Information Officer appointed and registered with Information Regulator', 'critical', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-8',  'Lawful Processing',                       'Processing Grounds', 'Personal information only processed with data subject consent or other grounds', 'critical', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-9',  'Purpose Specification',                   'Processing Grounds', 'Personal information collected for specific, explicitly defined purpose', 'high', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-10', 'Further Processing Limitation',           'Processing Grounds', 'Further processing compatible with the purpose of original collection', 'high', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-11', 'Information Quality',                     'Data Quality',       'Reasonable steps to ensure completeness, accuracy and currency of information', 'medium', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-13', 'Openness',                                'Transparency',       'Data subjects informed of purpose of collection and identity of responsible party', 'high', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-14', 'Security Safeguards',                     'Security',           'Reasonable technical and organisational security measures implemented', 'critical', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-19', 'Right of Access',                         'Data Subject Rights','Procedures for handling requests for access to personal information', 'high', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-22', 'Objection to Processing',                 'Data Subject Rights','Ability to object to processing of personal information', 'medium', 'not_assessed'),
      (fw_pop, c.id, 'POPIA-24', 'Complaints to Information Regulator',     'Accountability',     'Mechanism in place for data subjects to lodge complaints with Information Regulator', 'medium', 'not_assessed')
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;
