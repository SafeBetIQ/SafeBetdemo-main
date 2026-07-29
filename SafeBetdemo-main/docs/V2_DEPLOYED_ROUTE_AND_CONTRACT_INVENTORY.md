# V2 — Route & Contract Inventory (Milestone 4.6)

**Purpose: enumerate the Consumer Platform surface and confirm Version 2.0 introduces no change to it.**

## 1. Inventory (branch `Demo`)
- **App page routes:** 43
- **API routes:** 1
- **Components:** 93
- **Federation-serving routes in operator space:** 0
- **Regulator-plane routes wired into operator app:** 0

## 2. Federation Surface
The National Identity Federation (Version 2.0) exposes **no** HTTP route in the operator/consumer app. It is a
regulator-plane library (`lib/identityFederation/`) with a programmatic API (`FederationRuntime`) only. No
operator/consumer route serves SB-NAT, national correlation, national policy, or national financial data.

## 3. Contract Compatibility
Because no operator/consumer file imports `identityFederation` (verified — see
`V2_DEPLOYED_CONSUMER_PLATFORM_REGRESSION.md`), every existing route/API contract is **structurally
unchanged**: no required-field, type, enum, error-shape, status-code, pagination, or date-format change, and
no federation field (SB-NAT / regulator metadata / national policy / national GGR) can appear in any operator
contract.

## 4. Limitation
A **deployed** route/contract diff (hitting a running app) was **not** executed — no deployed app available.
This is a C8 residual. The structural inventory above is a static/architectural inventory, not a deployed
smoke.
