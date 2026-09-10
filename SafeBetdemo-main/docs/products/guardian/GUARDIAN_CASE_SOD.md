# SafeBet Guardian — Case Separation of Duties (ARCH-V4-C6)

C6 reuses the C0 role vocabulary and the `evaluateSod` rule specification.

## Separated duties
`INVESTIGATOR ≠ LEGAL_REVIEWER ≠ AUTHORISING_OFFICER` for the same controlled decision on
the same case. C6 actively uses INVESTIGATOR and LEGAL_REVIEWER (synthetic case review).
AUTHORISING_OFFICER remains modelled but **no enforcement-authorisation functionality is
introduced** at C6.

## Proven (tests + model)
- The **same** synthetic principal acting as both Investigator and Legal Reviewer on one
  case → **DENIED** (SoD violation).
- A **different** authorised synthetic Legal Reviewer → **PASS**.
- Jurisdiction-bound: mixed jurisdictions on one decision → denied.

## Not yet built
Full enforcement SoD (Authorising Officer approval → provider action) is a **later,
separate** milestone. No enforcement decision path exists in C6.

## MFA gate
The A5 MFA hard gate remains: no real (non-synthetic) Investigator / Legal Reviewer /
Authorising Officer may be activated. C6 uses synthetic identities / service roles only.
