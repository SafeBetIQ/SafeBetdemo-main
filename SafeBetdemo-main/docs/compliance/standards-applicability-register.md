# SafeBet — Standards Applicability Register (initial)

Created under Architecture Authority v4.0 §14.2. **This is an applicability + readiness
register, NOT a certification claim.** No clause text is reproduced from copyrighted
standards; where normative text is required but unavailable it is marked
`STANDARD_TEXT_REQUIRED`. Editions listed are those named by the Authority and MUST be
re-verified against the current SABS/ISO source before any conformity statement.

Applicability values: `APPLICABLE | PARTIALLY_APPLICABLE | NOT_APPLICABLE | OUTSIDE_CERTIFICATION_SCOPE | STANDARD_TEXT_REQUIRED`.

| Standard | Edition (verify) | Product(s) | Component(s) | Applicability | Rationale | Normative text held? | Control mapping | Evidence status |
|---|---|---|---|---|---|---|---|---|
| ISO/IEC 27001 | 2022 | All | Shared security foundation (IAM, RLS, secrets, audit) | APPLICABLE | Platform-wide ISMS baseline | No | Not started | Partial technical substrate (RLS 320/330, audit chain, secret-scan) — no ISMS artefacts |
| ISO/IEC 27701 | 2025 | IQ, Guardian, Regulator Suite | Privacy (player risk, self-exclusion, payment intel, regulator sharing) | APPLICABLE | PII/POPIA processing across products | No | Not started | POPIA notices in marketing pages only; no PIMS |
| ISO/IEC 42001 | 2023 | IQ, Guardian | AI risk/behaviour scoring, AI-assisted assessment | APPLICABLE | AI is a governed decision-support layer | No | Not started | No AI model registry (policyPlatform = rule config, not model governance) |
| ISO 22301 | 2019 | All (per product) | HA/DR, workload isolation, backups | PARTIALLY_APPLICABLE | BC/DR objectives per product not yet defined/tested | No | Not started | Rollback refs exist; RTO/RPO undefined |
| ISO/IEC 20000-1 | 2018 | Shared/Ops | Service management, change/incident | PARTIALLY_APPLICABLE | Release governance exists; SM system not formalised | No | Not started | Exact-SHA release governance in place |
| ISO 9001 / SANS 90003 | 9001:2026 / SANS 90003 | All | Secure SDLC, quality processes | PARTIALLY_APPLICABLE | Quality practices exist; QMS not formalised | No | Not started | Tests 702/702, typecheck, CI gate |
| ISO/IEC 27017 | 2026 | All | Cloud (AWS/Supabase) | APPLICABLE | Cloud-hosted platform | No | Not started | STANDARD_TEXT_REQUIRED |
| ISO/IEC 27018 | 2025 | All | Public-cloud PII processing | APPLICABLE | PII in public cloud | No | Not started | STANDARD_TEXT_REQUIRED |
| ISO/IEC 17025 | 2017 | (external labs) | N/A internally | OUTSIDE_CERTIFICATION_SCOPE | Applies to accredited testing labs, not SafeBet software | No | N/A | N/A |
| SANS 1718 family | verify | (gambling machine/device/WRS only) | Not a SafeBet software component today | NOT_APPLICABLE (current SafeBet software) | SafeBet implements no gambling machine/device/WRS; applies only if SafeBet consumes/produces certified machine/WRS data | No | SANS 1718 Applicability Map required if machine/WRS data is consumed | STANDARD_TEXT_REQUIRED |
| SANS/ISO 27001 (SA-adopted) | verify | All | ISMS (SA adoption) | STANDARD_TEXT_REQUIRED | Confirm SA-adopted edition vs ISO:2022 | No | Not started | Verify SABS catalogue |

**Note:** "SABS compliant" SHALL NOT be used; identify the specific applicable SANS/ISO requirement (Authority §14.1). No SafeBet product is certified to any standard.
