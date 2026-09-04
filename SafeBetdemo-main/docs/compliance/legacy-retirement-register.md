# Legacy / Retirement Register (ARCH-V4-A3)

Records objects excluded from the v4.0 target architecture and their disposition.
**No destructive removal in A3** — all actions are reversible and deferred to separately-approved
milestones. Read-only classification 2026-09-04.

| Item | Objects (examples) | Classification | Reason | Action (deferred, reversible) |
|---|---|---|---|---|
| **SafeBet Academy** | `module_quizzes`, `quiz_questions`, `quiz_answers`, `quiz_attempts`, `training_lessons`, `training_lesson_progress`, `training_certificates`, `award_training_credits()`, `generate_certificate_on_pass()`, `get_assessment_stats()`, quiz/certificate migration | **LEGACY / EXCLUDED** | Academy is explicitly excluded from v4 (§2.5). Not a product. | Deprecate; stop exposing as a product; retire in a dedicated milestone after confirming no live dependency. No build/expose. |
| **`guardianlayer_*`** | `guardianlayer_*` test tables + Feb-2026 seed migrations | **LEGACY** | Early test scaffolding; superseded. | Retire with the reclassification below. |
| **`guardian_*` analytics** | `guardian_device_intelligence`, `guardian_identity_drift`, `guardian_intervention_signals`, `guardian_minor_risk_scores`, `guardian_operator_risk_summary`, `guardian_province_risk_summary`, `guardian_school_hour_flags` | **RECLASSIFY → SafeBet IQ** (RG/minor-protection) | These are minor-protection RG analytics, **not** the v4 Guardian illegal-gambling product; the name collides with the reserved Guardian namespace. | Rename off `guardian_*` (e.g. `iq_rg_*` / `minor_protection_*`) via views/synonyms (strangler) in a later milestone. **Not renamed in A3.** The v4 Guardian product MUST use a distinct namespace. |
| **Certification Gateway / VLT Telecontrol** | none in DB | **EXCLUDED** | Explicitly excluded from v4 (§2.5). | Do not build/reintroduce. |
| **Transaction archives** | `transactions_archive_2024_01 … 2026_12` (36 monthly partitions) | **IQ financial (archive)** | Historical partitions — not legacy, but candidates for retention/archival policy. | Confirm retention class; no action in A3. |
| **Legacy production stacks (context)** | SafeBetBackend, legacy RDS (per prior audits) | **RETIRED / OUT OF SCOPE** | Production-side; separately governed. | No change in A3 (Demo only). |

## Rules
- No object in this register is dropped or renamed in A3.
- Academy MUST NOT be built or exposed as a product.
- The Guardian product namespace is reserved and MUST NOT reuse `guardian_*` table names.
- Each retirement is its own reversible, independently-approved milestone with a dependency check.
