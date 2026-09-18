# SafeBet Guardian — Identity Recovery (ARCH-V4-PR1)

- MFA reset / recovery is managed by the identity provider (Cognito): an administrator can reset a user's software-token MFA (`admin-set-user-mfa-preference` / re-associate software token) under audited administrative control. Recovery does not silently bypass identity proofing.
- No weak security questions are implemented.
- Password reset for test identities uses the Cognito admin API (`admin-set-user-password`) under administrative control; for real users a later PR will define the proofed recovery workflow.
- MFA seed/QR/recovery material is never exposed, printed, logged, committed, or returned in any report.
- Any identity administrator performing recovery is itself an MFA-required role.
