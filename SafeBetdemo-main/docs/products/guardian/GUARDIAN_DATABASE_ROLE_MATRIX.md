# SafeBet Guardian — Database Role Matrix (ARCH-V4-PR2 §23–§26)

Roles recreated by the `arch_v4` migrations (login roles; passwords set out-of-band into per-worker secrets). Every service login: `rolsuper=false, rolbypassrls=false, rolcreaterole=false, rolcreatedb=false`. Direct login (`session_user = current_user =` the dedicated role); NO broad-login→SET ROLE.

| Role | Component | Grants (schema guardian) |
|---|---|---|
| guardian_domain_worker | domain worker | SELECT/INSERT domain tables + domain_reference |
| guardian_app_worker | app worker | SELECT/INSERT app tables + app_reference |
| guardian_payment_worker | payment worker | SELECT/INSERT payment tables + payment_reference |
| guardian_geo_worker | geo worker | SELECT/INSERT geo tables + geo_reference |
| guardian_case_worker | case worker | SELECT/INSERT case tables + case_reference |
| guardian_evidence_worker | evidence writer | SELECT/INSERT evidence tables |
| guardian_evidence_reader | evidence reader | SELECT evidence + controlled reader path |
| guardian_policy_worker | authorisation worker | SELECT/INSERT policy/authorisation + evidence_reference |
| guardian_enforcement_worker | enforcement worker | SELECT/INSERT C9 tables + authorised_action |
| guardian_reentry_worker | re-entry worker | SELECT/INSERT C10 tables + orchestration_reference |
| guardian_identity_resolver | API entitlement lookup | SELECT identity_entitlement + INSERT audit |

No SafeBet IQ role. No generic super-role. The bootstrap/migration identity (elevated) is separate from runtime, not in any runtime secret, not reused by workers, audited, and disabled/rotated after migration.
