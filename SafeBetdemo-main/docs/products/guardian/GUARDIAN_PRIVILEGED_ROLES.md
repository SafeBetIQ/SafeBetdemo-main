# SafeBet Guardian — Privileged Roles (ARCH-V4-PR1)

Roles come only from the governed entitlement. Capabilities are disjoint where SoD requires it.

| Role | Capabilities | Notes |
|---|---|---|
| INVESTIGATOR | case view/review, evidence access, propose action, orchestration view, re-entry review | cannot authorise |
| LEGAL_REVIEWER | case view, evidence access, legal review, orchestration view, re-entry review | cannot authorise (SoD) |
| AUTHORISING_OFFICER | case view, evidence access, AUTHORISE action, orchestration view | HUMAN + MFA only; the C8 gate |
| POLICY_ADMINISTRATOR | policy administer, case view | never gains business authorisation |
| GUARDIAN_ADMINISTRATOR | identity administer | administrative scope only; NO business authorisation |

- INVESTIGATOR ≠ LEGAL_REVIEWER ≠ AUTHORISING_OFFICER (SoD preserved and strengthened).
- Administrative privilege ≠ legal/regulatory authorisation. A Guardian Administrator cannot authorise actions.
- A service principal can never hold any of these roles (`is_human` entitlement CHECK).
