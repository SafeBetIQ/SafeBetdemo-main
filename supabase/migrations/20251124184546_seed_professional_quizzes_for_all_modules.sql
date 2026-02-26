/*
  # Seed Professional Quizzes for All Training Modules

  1. Purpose
    - Create quizzes for all 50 training modules
    - 10-15 professional questions per quiz
    - Mix of multiple choice and scenario-based questions
    - Real-world casino industry content
    - 80% passmark requirement
    
  2. Question Types
    - Multiple choice (regulatory, procedural, theoretical)
    - Scenario-based (practical application)
    - True/False (policy and compliance)
*/

-- Create quiz for each module
INSERT INTO module_quizzes (module_id, title, description, pass_percentage, time_limit_minutes, shuffle_questions, show_correct_answers)
SELECT 
  id,
  title || ' Assessment',
  'Comprehensive assessment covering all key concepts from ' || title || '. You must achieve 80% to pass and receive your certificate.',
  80,
  30,
  true,
  true
FROM training_modules
ON CONFLICT (module_id) DO NOTHING;

-- Now create professional questions for each quiz
-- Sample for AML Basics module
DO $$
DECLARE
  v_quiz_id UUID;
  v_module_id UUID;
BEGIN
  -- Get AML Basics module
  SELECT id INTO v_module_id FROM training_modules WHERE title = 'AML Basics for Casino Staff' LIMIT 1;
  SELECT id INTO v_quiz_id FROM module_quizzes WHERE module_id = v_module_id LIMIT 1;
  
  IF v_quiz_id IS NOT NULL THEN
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order) VALUES
    (v_quiz_id, 'Under the Financial Intelligence Centre Act (FICA), what is the cash transaction threshold requiring customer identification in South African casinos?', 'multiple_choice', 
    '["R10,000", "R25,000", "R50,000", "R100,000"]', 'R25,000',
    'FICA Regulations require mandatory customer due diligence for single cash transactions of R25,000 or more in casino operations.', 1, 1),
    
    (v_quiz_id, 'Which stage of money laundering involves introducing illegal funds into the financial system?', 'multiple_choice',
    '["Placement", "Layering", "Integration", "Structuring"]', 'Placement',
    'Placement is the first stage where criminals introduce illegal funds into the legitimate financial system, often through casinos via cash purchases of chips.', 1, 2),
    
    (v_quiz_id, 'A customer purchases R24,000 in chips at three different cashiers within 30 minutes. This behavior is known as:', 'multiple_choice',
    '["Layering", "Structuring", "Integration", "Placement"]', 'Structuring',
    'Structuring (or smurfing) involves breaking large transactions into smaller amounts below reporting thresholds to avoid detection. This is a serious red flag.', 1, 3),
    
    (v_quiz_id, 'SCENARIO: A customer buys R100,000 in chips, plays roulette for 15 minutes with minimum bets, loses R2,500, then cashes out and requests a casino cheque. What should you do?', 'scenario_based',
    '["Process the transaction normally", "Report to supervisor immediately as suspicious", "Request additional identification", "Refuse the transaction"]', 'Report to supervisor immediately as suspicious',
    'This is classic money laundering behavior - large cash in, minimal play, cash out to cheque. The customer is essentially exchanging cash for a ''clean'' financial instrument. This must be reported immediately.', 2, 4),
    
    (v_quiz_id, 'What is the maximum penalty for non-compliance with FICA in South Africa?', 'multiple_choice',
    '["R1 million fine", "R5 million fine or 5 years imprisonment", "R10 million fine or 15 years imprisonment", "R50 million fine"]', 'R10 million fine or 15 years imprisonment',
    'FICA violations carry severe penalties including fines up to R10 million and/or imprisonment up to 15 years, emphasizing the critical importance of compliance.', 1, 5),
    
    (v_quiz_id, 'Which document is NOT acceptable as primary identification for FICA verification?', 'multiple_choice',
    '["Valid South African ID book", "Valid passport", "Expired drivers license", "Valid smart ID card"]', 'Expired drivers license',
    'All identification documents must be current and valid. Expired documents do not meet FICA verification requirements.', 1, 6),
    
    (v_quiz_id, 'SCENARIO: Three young men arrive together, each buys R24,000 in chips separately, play briefly, then cash out requesting cheques. All provide IDs showing the same address. Your action?', 'scenario_based',
    '["Process normally - they are separate customers", "Report as highly suspicious - multiple red flags present", "Request manager approval only", "Only report if they return"]', 'Report as highly suspicious - multiple red flags present',
    'Multiple red flags: structuring (3 x R24k), coordinated behavior, same address (possible nominees), minimal play, immediate cash-out to cheques. This requires immediate reporting to supervisor and likely an STR filing.', 2, 7),
    
    (v_quiz_id, 'When completing a Suspicious Transaction Report (STR), you should:', 'multiple_choice',
    '["Include your suspicions and conclusions", "Only report objective facts and observations", "Discuss it with the customer first", "Wait to gather more evidence"]', 'Only report objective facts and observations',
    'STRs should contain objective facts, observations, dates, times, and amounts. Do not include subjective conclusions. Never discuss suspicions with the customer (tipping off) and report immediately - do not wait.', 1, 8),
    
    (v_quiz_id, 'Customer Due Diligence (CDD) under FICA includes all of the following EXCEPT:', 'multiple_choice',
    '["Verifying customer identity", "Understanding the nature of business relationship", "Monitoring customer transactions", "Investigating customer employment history"]', 'Investigating customer employment history',
    'CDD includes identity verification, understanding the business relationship, and ongoing monitoring. Detailed employment investigations are not required unless specific red flags emerge.', 1, 9),
    
    (v_quiz_id, 'A customer from a FATF-listed high-risk jurisdiction wants to conduct a R40,000 transaction. You should:', 'multiple_choice',
    '["Refuse the transaction", "Apply Enhanced Due Diligence procedures", "Process normally with standard CDD", "Request a manager to handle"]', 'Apply Enhanced Due Diligence procedures',
    'Customers from FATF high-risk jurisdictions require Enhanced Due Diligence (EDD), which includes additional verification, source of funds inquiry, and closer monitoring. The transaction can proceed with proper EDD.', 1, 10),
    
    (v_quiz_id, 'The primary purpose of the Financial Intelligence Centre (FIC) in South Africa is to:', 'multiple_choice',
    '["Prosecute money launderers", "Identify, prevent, and combat money laundering and terrorism financing", "Regulate casino operations", "Provide banking services"]', 'Identify, prevent, and combat money laundering and terrorism financing',
    'The FIC is responsible for identifying proceeds of crime, combating money laundering, and preventing terrorism financing through the collection and analysis of financial intelligence.', 1, 11),
    
    (v_quiz_id, 'SCENARIO: A regular customer who typically plays R500 slot machines arrives with R150,000 cash and wants to buy chips. The customer seems nervous and keeps checking the entrance. What is your response?', 'scenario_based',
    '["Process transaction - they are a regular customer", "Complete full CDD and report unusual behavior to supervisor", "Refuse transaction due to nervous behavior", "Ask customer why they are nervous"]', 'Complete full CDD and report unusual behavior to supervisor',
    'Even regular customers require CDD for transactions over R25,000. The unusual amount (far exceeding normal play), nervous behavior, and surveillance awareness are red flags requiring supervisor notification while completing proper procedures.', 2, 12);
  END IF;
END $$;

-- Generate quizzes for all other modules with professional content
DO $$
DECLARE
  quiz_record RECORD;
  question_num INTEGER;
BEGIN
  FOR quiz_record IN 
    SELECT mq.id as quiz_id, tm.title, tm.difficulty, tc.name as category
    FROM module_quizzes mq
    JOIN training_modules tm ON tm.id = mq.module_id
    JOIN training_categories tc ON tc.id = tm.category_id
    WHERE NOT EXISTS (SELECT 1 FROM quiz_questions WHERE quiz_id = mq.id)
    ORDER BY tm.title
  LOOP
    question_num := 1;
    
    -- Question 1: Regulatory/Compliance
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'Which South African legislation primarily governs ' || quiz_record.title || ' in casino operations?',
      'multiple_choice',
      '["National Gambling Act No. 7 of 2004", "Companies Act", "Labour Relations Act", "Consumer Protection Act"]',
      'National Gambling Act No. 7 of 2004',
      'The National Gambling Act No. 7 of 2004 is the primary legislation regulating gambling activities in South Africa, including all aspects covered in ' || quiz_record.title || '.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 2: Definition/Concept
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'The primary objective of ' || quiz_record.title || ' is to:',
      'multiple_choice',
      '["Increase casino revenue", "Ensure regulatory compliance and customer protection", "Reduce operational costs", "Maximize player losses"]',
      'Ensure regulatory compliance and customer protection',
      'All casino training modules prioritize regulatory compliance, customer protection, and operational integrity above commercial considerations.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 3: Best Practice
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'When implementing procedures related to ' || quiz_record.title || ', staff must:',
      'multiple_choice',
      '["Follow their intuition", "Apply documented Standard Operating Procedures", "Make decisions independently", "Copy other casinos"]',
      'Apply documented Standard Operating Procedures',
      'Professional casino operations require strict adherence to documented SOPs to ensure consistency, compliance, and accountability across all staff and shifts.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 4: Scenario-based
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'SCENARIO: You encounter a situation related to ' || quiz_record.title || ' that is not covered in your training. Your immediate action should be:',
      'scenario_based',
      '["Handle it based on similar situations", "Escalate to your supervisor immediately", "Ask a colleague", "Ignore it if customer is satisfied"]',
      'Escalate to your supervisor immediately',
      'When facing unfamiliar situations, escalation to supervisors ensures proper handling, maintains compliance, and protects both staff and the organization from potential errors.',
      2, question_num
    );
    question_num := question_num + 1;
    
    -- Question 5: Consequences
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'Failure to comply with procedures in ' || quiz_record.title || ' can result in:',
      'multiple_choice',
      '["Written warning only", "Regulatory fines, license suspension, and criminal liability", "No consequences if no one complains", "Customer satisfaction issues only"]',
      'Regulatory fines, license suspension, and criminal liability',
      'Non-compliance can trigger serious consequences including substantial fines, license suspension or revocation, and potential criminal charges for both individuals and the organization.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 6: Documentation
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'Documentation requirements for ' || quiz_record.title || ' exist primarily to:',
      'multiple_choice',
      '["Create bureaucracy", "Provide audit trails and demonstrate compliance", "Keep staff busy", "Generate paperwork"]',
      'Provide audit trails and demonstrate compliance',
      'Documentation creates essential audit trails, demonstrates regulatory compliance, supports investigations, and protects the organization and staff during regulatory reviews.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 7: Customer Interaction
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'When explaining ' || quiz_record.title || ' procedures to customers, you should:',
      'multiple_choice',
      '["Be brief and dismissive", "Provide clear, professional explanations emphasizing regulatory requirements", "Blame management", "Apologize for the inconvenience"]',
      'Provide clear, professional explanations emphasizing regulatory requirements',
      'Professional communication involves clear explanations that help customers understand that procedures exist for regulatory compliance and customer protection, not as arbitrary rules.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 8: Risk Management
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'The main risk associated with ' || quiz_record.title || ' that staff must be vigilant about is:',
      'multiple_choice',
      '["Slow service", "Regulatory non-compliance and associated penalties", "Customer dissatisfaction", "Overtime costs"]',
      'Regulatory non-compliance and associated penalties',
      'The primary risk in all casino operations is regulatory non-compliance, which can lead to severe penalties, license loss, and reputational damage.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 9: Scenario Decision
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'SCENARIO: A VIP customer requests special treatment that conflicts with ' || quiz_record.title || ' procedures. You should:',
      'scenario_based',
      '["Grant the request - VIPs are important", "Politely explain procedures apply to all customers and escalate if needed", "Ignore the procedures this once", "Ask the customer to leave"]',
      'Politely explain procedures apply to all customers and escalate if needed',
      'Regulatory requirements and operational procedures apply equally to all customers regardless of status. Professional service includes courteous explanations and appropriate escalation, never rule violations.',
      2, question_num
    );
    question_num := question_num + 1;
    
    -- Question 10: Professional Standards
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'Professional competence in ' || quiz_record.title || ' requires:',
      'multiple_choice',
      '["Memorizing all procedures", "Ongoing training, procedural awareness, and ethical conduct", "Years of experience only", "Following colleagues"]',
      'Ongoing training, procedural awareness, and ethical conduct',
      'Professional competence is maintained through continuous learning, staying current with procedures, applying knowledge correctly, and upholding ethical standards in all situations.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 11: Confidentiality
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'Customer information obtained during ' || quiz_record.title || ' procedures must be:',
      'multiple_choice',
      '["Shared with colleagues", "Kept strictly confidential per POPIA requirements", "Posted on social media for awareness", "Discussed during breaks"]',
      'Kept strictly confidential per POPIA requirements',
      'POPIA (Protection of Personal Information Act) mandates strict confidentiality of customer information. Unauthorized disclosure can result in criminal charges and substantial fines.',
      1, question_num
    );
    question_num := question_num + 1;
    
    -- Question 12: Final Scenario
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
    VALUES (
      quiz_record.quiz_id,
      'SCENARIO: You complete this assessment and score 75%. According to academy policy, you:',
      'scenario_based',
      '["Pass - 75% is good enough", "Must retake to achieve the required 80% passmark", "Can request a manual override", "Receive partial certification"]',
      'Must retake to achieve the required 80% passmark',
      'SafePlay Academy requires 80% minimum for all assessments to ensure comprehensive understanding. You can retake immediately to achieve the passmark and receive your certificate.',
      2, question_num
    );
    
  END LOOP;
END $$;
