# SafeBet Guardian — Authorisation Separation of Duties (ARCH-V4-C8)

For a single controlled authorisation decision:
`INVESTIGATOR ≠ LEGAL_REVIEWER ≠ AUTHORISING_OFFICER` (three distinct synthetic principals).

## Proven (tests + live)
- Investigator attempts final authorisation → DENIED (`AUTHORISER_NOT_PERMITTED`).
- Same principal as Investigator AND Legal Reviewer → `SOD_VIOLATION`.
- Legal Reviewer as Authorising Officer where SoD forbids → DENIED.
- Distinct human Authorising Officer → PASS (AUTHORISED).
- `SYSTEM_SERVICE` attempts final authorisation → DENIED (machine authorisation impossible; also
  DB-enforced: `guardian_policy_worker` cannot INSERT `action_authorisation` — proven live).

## Human authority requirement
Final AUTHORISED requires a synthetic human `AUTHORISING_OFFICER` identity/context. No AI or
automated rule makes the final legal/regulatory decision. Rules only deterministically narrow
candidate policies and evaluate hard gates.

## MFA hard gate
Real Authorising Officer activation remains BLOCKED until MFA is enforced. C8 uses synthetic
identities only. This gate is not weakened by C8 introducing authorisation semantics.
