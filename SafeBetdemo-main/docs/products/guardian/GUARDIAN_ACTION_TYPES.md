# SafeBet Guardian — Action Types (ARCH-V4-C8)

C8 models AUTHORISABLE action types. They are **NOT executable** in C8 — there is no provider
adapter, no outbound API, no email/referral, no SFTP, no block command.

## Authorisable action types
`DOMAIN_BLOCK, DNS_POLICY, HOSTING_REFERRAL, REGISTRAR_REFERRAL, APP_PLATFORM_REFERRAL,
PAYMENT_REFERRAL, GEO_RESTRICTION, MONITOR_ONLY`.

A policy version explicitly specifies which action categories it permits/reviews; authorising an
action outside policy permission → DENIED (`ACTION_TYPE_NOT_PERMITTED`).

## Action scope (bounded)
An authorised action record carries a bounded scope: target type + target reference,
jurisdiction, provider category (implied by action type), policy reference, case reference,
evidence package reference. No vague "block everything" scope.

## Who performs the actual action
Guardian orchestrates (in a FUTURE milestone) authorised enforcement **requests**. The external
authorised provider performs the actual technical/provider action. Guardian does not freeze
accounts, block bank transactions, remove apps, suspend domains, or compel ISPs.
