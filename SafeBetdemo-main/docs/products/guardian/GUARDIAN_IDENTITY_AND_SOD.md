# SafeBet Guardian — Identity & Separation of Duties (ARCH-V4-C0)

## Role vocabulary
`INVESTIGATOR`, `LEGAL_REVIEWER`, `AUTHORISING_OFFICER`, `EXTERNAL_PROVIDER`,
`SYSTEM_SERVICE` (`products/guardian/src/identity.ts`). A SafeBet IQ role is **not** in this
vocabulary and can never grant Guardian access (`assertNotSafebetIqIdentity`).

## Principal context
Every Guardian principal carries: `principalId`, `product=GUARDIAN`, `jurisdiction`, `role`,
`authAssurance` (`SYNTHETIC_TEST | PASSWORD_ONLY | MFA_VERIFIED | SERVICE_KEY`), `purpose`
(POPIA purpose limitation), `isSynthetic`, and optional `delegatedBy`/`sessionId`/`requestId`.

## MFA hard gate (inherited from A5)
`MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE = true`. `makeGuardianPrincipal` **rejects** any real
(non-synthetic) privileged human — `INVESTIGATOR`, `LEGAL_REVIEWER`, `AUTHORISING_OFFICER` —
at C0, regardless of assurance. C0 permits **synthetic/test** principals and non-human
`SYSTEM_SERVICE` identities only.

> Target model (future MFA milestone): privileged role → MFA enrolled → MFA verified →
> privileged access allowed. Never enforce-before-enrol. No real Guardian privileged user,
> and no production privileged regulatory access, until MFA enforcement is proven.

## Separation of Duties
For a single enforcement decision on a single case:
`INVESTIGATOR ≠ LEGAL_REVIEWER ≠ AUTHORISING_OFFICER` — three distinct human principals.
`evaluateSod` (`products/guardian/src/sod.ts`) rejects:
- the same principal holding two of the three separated duties;
- a slot filled by the wrong role;
- mixed jurisdictions across one decision.

C0 does not implement the enforcement workflow; it proves the authorisation model can reject
incompatible same-case roles (synthetic tests in `tests/guardian/guardianFoundation.test.mjs`).

## Jurisdiction scoping
`principalMayAccessGuardianResource` / `assertMayAccess` (`products/guardian/src/jurisdiction.ts`)
permit access only when the principal's jurisdiction equals the resource jurisdiction and both
carry `product=GUARDIAN`. Mirrored at the database by RLS on the `guardian` schema
(claim `guardian_jurisdiction`).
