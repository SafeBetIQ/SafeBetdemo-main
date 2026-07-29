# Phase 3.1A — Identity Resolution Service Abstraction: Deliverables

**Date:** 2026-07-10 · **Branch:** Demo · **Deployed to:** SafeBet Demo (`uexdjngogzunjxkpxwll`) — Production untouched.
**Nature:** architectural hardening only. Zero behavioral change; identity algorithm and all existing SB-PLR IDs unchanged (proven below).

---

## 1. Class / service diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                            Consumers                               │
│  CasinoDataContext · casino-simulator · identity-resolution fn     │
│  5 × integration-*-sync · (future: Event Bus, engines, dashboards) │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ getIdentityService()
                               ▼
        ┌──────────────────────────────────────────────┐
        │        IdentityResolutionService              │
        │  resolveIdentity · createIdentity ·           │
        │  getExistingIdentity · validateIdentity ·     │
        │  resolveBatch · supportsProvider              │
        │                                               │
        │  select(ctx): casino → jurisdiction →         │
        │               env → default   (config.ts)     │
        └──────────────────────┬───────────────────────┘
                               │ IdentityProvider (interface)
              ┌────────────────┼───────────────────────────┐
              ▼                ▼                           ▼
   SHA256IdentityProvider   (future)                    (future)
   'sha256-v1' — the ONLY   NationalIdentityProvider    RegulatorIdentity-
   module that knows the    CasinoNativeIdentity-       Provider, External-,
   derivation algorithm     Provider                    Federation-, Testing-
```

## 2. IdentityProvider interface — `lib/playerIdentity/provider.ts`

`resolveIdentity(ref, ctx)` · `createIdentity(ref, ctx)` · `getExistingIdentity(ref, ctx)` · `validateIdentity(candidate)` · `resolveBatch(refs, ctx)` · `supportsJurisdiction(j)` · `supportsCasino(c)` · `readonly name`.
`IdentityContext = { casinoId, jurisdiction?, client? }` — with a persistence client the mapping is durably recorded; without one, capable providers resolve side-effect-free. `supportsProvider(name)` lives on the service (registry probe). No hashing concept appears anywhere in the interface.

## 3. Provider implementation structure

```
lib/playerIdentity/
├── index.ts            public API — service + display helpers ONLY
├── core.ts             SB-PLR format contract + display helpers (no crypto)
├── provider.ts         IdentityProvider interface, IdentityContext, RpcClient
├── config.ts           provider selection: casino → jurisdiction → env
│                       (SAFEBET_IDENTITY_PROVIDER / NEXT_PUBLIC_…) → 'sha256-v1'
├── service.ts          IdentityResolutionService + composition root
└── providers/
    └── sha256.ts       SHA256IdentityProvider — hashing, collision probing,
                        RPC persistence. Fully encapsulated; NOT exported
                        from index.ts.
(resolver.ts deleted — absorbed into providers/sha256.ts)
```

## 4. Dependency graph (after)

```
consumers ──► lib/playerIdentity/index.ts ──► service.ts ──► provider.ts (interface)
                                                  │                ▲
                                                  ├─► config.ts    │ implements
                                                  └─► providers/sha256.ts ──► core.ts (format only)
```
No arrow exists from any consumer to `providers/` or to a hash primitive. The only file importing `SHA256IdentityProvider` is `service.ts` (composition root) — plus the test suite.

## 5. Files created / modified

**Created:** `lib/playerIdentity/provider.ts`, `lib/playerIdentity/config.ts`, `lib/playerIdentity/service.ts`, `lib/playerIdentity/providers/sha256.ts`, `docs/phase-3.1a-identity-abstraction.md`.
**Modified:** `lib/playerIdentity/core.ts` (crypto removed — format/display only), `lib/playerIdentity/index.ts` (public API narrowed), `tests/playerIdentity.test.mjs` (rewritten against the service), `contexts/CasinoDataContext.tsx`, `supabase/functions/{identity-resolution, casino-simulator, integration-playtech-sync, integration-betsoftware-sync, integration-evolution-sync, integration-altenar-sync, integration-softswiss-sync}/index.ts`.
**Deleted:** `lib/playerIdentity/resolver.ts`.
**Not touched:** database schema, migrations, RPC, `safebet_identity_map` — no data change of any kind.

## 6. Refactoring summary

- All 9 identity call sites now go through `getIdentityService().resolveIdentity/resolveBatch(ref(s), { casinoId, [client] })`.
- The browser context's derive-only path and the edge functions' persisted path are now the *same consumer call*, differing only by the presence of `ctx.client`.
- `deriveSafeBetId`, `hashCasinoRef`, `safeBetIdFromHash`, `normalizeCasinoRef` removed from the public API; they exist only inside `providers/sha256.ts`.
- Provider selection is configuration-driven (env var, per-casino map, per-jurisdiction map, default) — adding a provider requires implementing the interface and registering it; **zero consumer changes** (proven by test).

## 7. Regression test results

- **Unit: 22/22 pass** (`node --test tests/playerIdentity.test.mjs`) — determinism, uniqueness 150/150, normalisation, batch ordering, persisted-path idempotency, collision probing, error surfacing, raw-ref-never-transmitted, encapsulation, extensibility, mis-configuration failure mode.
- **`tsc --noEmit`:** 0 errors. **`next build`:** compiled successfully, 72/72 pages.

## 8. Backward compatibility verification

| Check | Before 3.1A | After 3.1A | Verdict |
|---|---|---|---|
| Pinned vector (casino …0001 + `demo-patron-1`) | `SB-PLR-707371C3` | `SB-PLR-707371C3` | unchanged |
| Live IRS endpoint, `e2e-verify-patron` | `SB-PLR-790556A5` | `SB-PLR-790556A5` | unchanged |
| Live IRS batch, `demo-patron-1` (Betway) | `SB-PLR-51D20858` | `SB-PLR-51D20858` | unchanged |
| RPC / DB mappings | 525+ rows | untouched (no migration) | unchanged |
| Simulator burst | success, lifecycle events | `{"success":true,"inserted":15}` | unchanged |
| API request/response shapes | — | identical | unchanged |

## 9. Consumer-dependency evidence (grep, full tree)

- `SHA256IdentityProvider` referenced in `app/ components/ contexts/ supabase/`: **NONE**.
- `hashCasinoRef | safeBetIdFromHash | deriveSafeBetId | sbiq-v1` referenced outside `lib/playerIdentity/`: **NONE**.
- Identity consumers (all via `getIdentityService`): `contexts/CasinoDataContext.tsx` and the 7 edge functions listed above. All other listed modules (Machine Monitor, Live Feed, Player Investigation, reports, compliance, regulator, XAI) consume only the resolved `player_id` value plus the implementation-agnostic `formatPlayerId` — they never generated identities and now cannot.

## 10. Encapsulation confirmation

The SHA-256 mechanism (domain string, hashing, truncation, collision probes, RPC handshake) exists solely in `lib/playerIdentity/providers/sha256.ts`, which is not exported from the public API; the test suite asserts the public surface leaks none of it. **Phase 3.1A objective met with zero behavioral drift.**
