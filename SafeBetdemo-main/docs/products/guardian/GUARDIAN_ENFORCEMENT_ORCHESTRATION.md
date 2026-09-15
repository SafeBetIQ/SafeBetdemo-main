# SafeBet Guardian — Multi-Channel Enforcement Orchestration (ARCH-V4-C9)

**Status:** Planned / in development (synthetic Demo only). SYNTHETIC PROVIDERS ONLY. No real
ISP/registrar/registry/host/bank/PSP/mobile/geo provider; no production; no automatic enforcement.

C9 orchestrates C8-authorised actions to **synthetic** providers. Guardian ORCHESTRATES /
REFERS / PUBLISHES authorised requests; the **external provider** performs the provider-side
action.

## Flow
```
valid C8 AUTHORISED action -> revalidation -> orchestration record -> provider channel
selection -> synthetic provider request -> PUBLISHED/REFERRED -> provider ACK -> provider
response -> INDEPENDENT verification -> CLOSED / follow-up
```

## Critical wording (never claim SafeBet performs the action)
Guardian does not freeze bank accounts, terminate merchants, remove apps, suspend domains, or
compel ISPs. The external authorised provider performs the technical/provider-side action.
`enforcement_orchestration` DB CHECKs force `is_real_provider=false` AND
`is_external_network_call=false`. The module has no outbound/provider client (boundary-tested).

## Entry gate — authenticated authorising identity (C9 §2/§49; closes the C8 finding)
An `AUTHORISING_OFFICER` role is NEVER trusted from the request body / a fixture / a default.
The role + jurisdiction are BOUND to an authenticated Guardian principal
(`resolveGuardianPrincipal`); a caller can only present a principal id. A caller cannot
self-assert authority (proven). Real privileged users remain blocked by the MFA hard gate.

## Only valid authorisations enter (revalidated; no stale)
C9 consumes ONLY the bounded C8 **Authorised-Action Contract** (`guardian.authorised_action`
view — a data-layer revalidation gate that hides expired/withdrawn/superseded rows), and
re-validates immediately before dispatch. Expired / withdrawn / superseded / scope-mutated /
missing-field -> `ORCHESTRATION_BLOCKED`, no provider request. C9 creates no authorisation
authority and cannot widen scope (any scope change -> return to C8).

## No detection -> enforcement
Strict path: C1-C5 intelligence -> C6 investigation -> C7 evidence -> C8 policy/legal/human
authorisation -> C9 orchestration. There is no detection -> provider path (tested: no AUTHORISED
contract -> BLOCKED).

## State semantics
`ACKNOWLEDGED != ACTIONED`, `ACTIONED != VERIFIED`, `PUBLISHED != PROVIDER COMPLIED`,
`DECLINED != TECHNICAL FAILURE`. Guardian sets internal states (READY/PUBLISHED/REFERRED);
provider-originated states come ONLY from a `provider_response` row; only the independent
verification step sets VERIFIED. See GUARDIAN_PROVIDER_STATE_MACHINE.md.

## Durable pipeline & API
- Queue `guardian-enforcement-orchestration` + DLQ + worker `safebet-guardian-enforcement-worker`
  (IAM: logs + SQS + one secret only — no external/provider/network permission) + DLQ alarm.
- API (IAM-protected): `GET /enforcement`, `GET /enforcement/:id`, `POST /authorisations/:id/orchestrate`,
  `GET /enforcement/:id/responses`, `POST /enforcement/:id/verify`, `POST /enforcement/:id/withdraw`.
  No `/block-now`,`/freeze-account`,`/remove-app`,`/seize-domain`.
