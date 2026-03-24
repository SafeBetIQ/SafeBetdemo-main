/*
  # Drop all foreign key constraints referencing auth.users

  ## Problem
  Public schema tables have FK constraints pointing to auth.users.
  This causes GoTrue to throw "Database error querying schema" during
  password authentication because the schema introspection traverses
  the FK graph across schema boundaries and fails.

  ## Solution
  Drop all FK constraints from public tables that reference auth.users.
  The columns are retained — only the cross-schema constraint is removed.
  Data integrity is maintained through application logic and the
  public.users table which already mirrors auth user IDs.

  ## Tables affected
  ai_false_positive_log, ai_model_registry, api_tokens, audit_logs,
  behaviour_events, casino_integration_configs, casino_modules,
  casino_packages, compliance_certificates, compliance_evidence,
  cross_operator_alerts, data_subject_requests, demo_audit_logs,
  esg_evidence_trail, esg_reports, intervention_history,
  intervention_logs, intervention_threshold_rules, interventions,
  login_sessions, mfa_settings, operator_feature_access,
  operator_integrations, regulators, security_events, self_exclusions,
  sen_exclusion_events, staff, staff_training_assignments,
  training_assignment_templates, training_enrollments, trusted_devices
*/

ALTER TABLE ai_false_positive_log        DROP CONSTRAINT IF EXISTS ai_false_positive_log_reported_by_fkey;
ALTER TABLE ai_model_registry            DROP CONSTRAINT IF EXISTS ai_model_registry_deployed_by_fkey;
ALTER TABLE api_tokens                   DROP CONSTRAINT IF EXISTS api_tokens_revoked_by_fkey;
ALTER TABLE api_tokens                   DROP CONSTRAINT IF EXISTS api_tokens_created_by_fkey;
ALTER TABLE audit_logs                   DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE behaviour_events             DROP CONSTRAINT IF EXISTS behaviour_events_reviewed_by_fkey;
ALTER TABLE casino_integration_configs   DROP CONSTRAINT IF EXISTS casino_integration_configs_created_by_fkey;
ALTER TABLE casino_modules               DROP CONSTRAINT IF EXISTS casino_modules_enabled_by_fkey;
ALTER TABLE casino_packages              DROP CONSTRAINT IF EXISTS casino_packages_activated_by_fkey;
ALTER TABLE compliance_certificates      DROP CONSTRAINT IF EXISTS compliance_certificates_issued_by_fkey;
ALTER TABLE compliance_evidence          DROP CONSTRAINT IF EXISTS compliance_evidence_collected_by_fkey;
ALTER TABLE cross_operator_alerts        DROP CONSTRAINT IF EXISTS cross_operator_alerts_reviewed_by_fkey;
ALTER TABLE data_subject_requests        DROP CONSTRAINT IF EXISTS data_subject_requests_handled_by_fkey;
ALTER TABLE demo_audit_logs              DROP CONSTRAINT IF EXISTS demo_audit_logs_user_id_fkey;
ALTER TABLE esg_evidence_trail           DROP CONSTRAINT IF EXISTS esg_evidence_trail_verified_by_fkey;
ALTER TABLE esg_reports                  DROP CONSTRAINT IF EXISTS esg_reports_generated_by_fkey;
ALTER TABLE intervention_history         DROP CONSTRAINT IF EXISTS intervention_history_triggered_by_fkey;
ALTER TABLE intervention_logs            DROP CONSTRAINT IF EXISTS intervention_logs_sent_by_fkey;
ALTER TABLE intervention_threshold_rules DROP CONSTRAINT IF EXISTS intervention_threshold_rules_created_by_fkey;
ALTER TABLE interventions                DROP CONSTRAINT IF EXISTS interventions_created_by_fkey;
ALTER TABLE login_sessions               DROP CONSTRAINT IF EXISTS login_sessions_user_id_fkey;
ALTER TABLE mfa_settings                 DROP CONSTRAINT IF EXISTS mfa_settings_user_id_fkey;
ALTER TABLE operator_feature_access      DROP CONSTRAINT IF EXISTS operator_feature_access_enabled_by_fkey;
ALTER TABLE operator_integrations        DROP CONSTRAINT IF EXISTS operator_integrations_enabled_by_fkey;
ALTER TABLE regulators                   DROP CONSTRAINT IF EXISTS regulators_user_id_fkey;
ALTER TABLE security_events              DROP CONSTRAINT IF EXISTS security_events_resolved_by_fkey;
ALTER TABLE self_exclusions              DROP CONSTRAINT IF EXISTS self_exclusions_submitted_by_fkey;
ALTER TABLE sen_exclusion_events         DROP CONSTRAINT IF EXISTS sen_exclusion_events_submitted_by_fkey;
ALTER TABLE staff                        DROP CONSTRAINT IF EXISTS staff_auth_user_id_fkey;
ALTER TABLE staff_training_assignments   DROP CONSTRAINT IF EXISTS staff_training_assignments_assigned_by_fkey;
ALTER TABLE training_assignment_templates DROP CONSTRAINT IF EXISTS training_assignment_templates_created_by_fkey;
ALTER TABLE training_enrollments         DROP CONSTRAINT IF EXISTS training_enrollments_assigned_by_fkey;
ALTER TABLE trusted_devices              DROP CONSTRAINT IF EXISTS trusted_devices_user_id_fkey;
