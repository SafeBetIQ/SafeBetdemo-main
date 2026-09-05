# SafeBet Guardian — Product Boundary (ARCH-V4-C0)

Guardian is a distinct product with its own runtime, API, identity, data, queue,
config, secrets, observability, release lifecycle and audit context. This document
records the boundary rules and the proofs.

## Allowed dependencies
- **Governed Shared Platform Foundation only:** `@/lib/platform/audit`, `@/lib/platform/evidence`
  (pure contracts, no DB/credentials). Future shared identity/privacy contracts as they are
  formalised.

## Forbidden dependencies (hard independence)
- No import of any SafeBet IQ business module (`lib/consumerPlatform`, `lib/certified*`,
  `lib/regulator*`, `lib/operator*`, `app/casino`, `app/admin`, `app/regulator`, IQ auth/supabase).
- No read of SafeBet IQ business tables. Enumerated in `products/guardian/src/product.ts`
  (`FORBIDDEN_IQ_TABLES`): `casino_event_log`, `players`, `projection_financial_posture`,
  `sbiq_financial_rollup_hourly`, `intervention_state`, `projection_intervention_state`,
  `behavioural_events`, `machines`, `self_exclusions`.
- No reuse of legacy `public.guardian_*` (IQ minor-protection analytics) or `public.guardianlayer_*`
  (legacy) namespaces for new Guardian business data. Guardian uses the clean `guardian` schema.

## Boundary proofs (automated)
`tests/guardian/guardianBoundary.test.mjs`:
- **no-IQ-import:** scans every `products/guardian/**/*.ts`; the only permitted cross-package
  specifiers are the two shared contracts; any IQ-area import fails the test.
- **no-forbidden-table:** no Guardian source references a forbidden IQ business table.
- **no-legacy-namespace:** no Guardian source creates `public.guardian_*` / `guardianlayer_*`.
- **independence:** the foundation descriptor resolves with no IQ runtime/data present.

## Cross-product access denials (proven)
| Scenario | Result | Proof |
|---|---|---|
| SafeBet IQ role (casino_admin/super_admin/…) → Guardian resource | **DENIED** | `assertNotSafebetIqIdentity` + app test |
| Guardian principal jurisdiction A → jurisdiction B resource | **DENIED** | `assertMayAccess` app test + DB RLS test |
| IQ session (no `guardian_jurisdiction` claim) → `guardian` tables | **0 rows** | DB RLS negative test |
| Unauthenticated (`anon`) → `guardian` tables | **permission denied** | DB negative test (no anon grant) |
| Guardian `service_role` (worker/admin) → approved internal path | **PASS** | DB test (bypassrls) |

## Enforcement boundary
Guardian orchestrates; it never itself freezes bank accounts/transactions, terminates
merchants, removes mobile apps, suspends domains, compels ISPs, or issues legal
determinations (`GUARDIAN_MUST_NOT_SELF_EXECUTE`). Automated signal ≠ legal finding;
detection ≠ enforcement authorisation; no automatic blocking. Encoded + tested.
