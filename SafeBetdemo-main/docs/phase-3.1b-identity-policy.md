# Phase 3.1B — Identity Policy Layer (Flow Integration): Deliverables

**Date:** 2026-07-10 · **Branch:** Demo · **Deployed to:** SafeBet Demo (`uexdjngogzunjxkpxwll`) — Production untouched.
**Nature:** one decision point added inside the existing Identity Resolution flow. No new engine, no new workflow, no new state, no behavioral change under default policy.

---

## 1. Updated event flow diagram

```
Casino Event (CARD_INSERT / platform sync / burst)
      │
      ▼
IdentityResolutionService.resolveIdentity(ref, ctx)
      │
      ▼
┌────────────────────────────────────────────┐
│  Identity Policy Layer  (policy.ts)        │   ← DECISION POINT, in-flow
│  • resolution permitted for tenant?        │     pure fn: f(ctx, config, rules)
│  • permitted in jurisdiction?              │     no state · no events ·
│  • which provider applies?                 │     no projections · no logic
│  • cross-casino permitted?  (default: no)  │
│  • federation permitted?    (default: no)  │
└──────────────┬─────────────────────────────┘
     permitted │ control returns immediately        refused → resolution
               ▼                                    fails loudly; event
IdentityProvider (selected by the decision)         does not continue
               │
               ▼
SafeBet IQ Player ID  (unchanged: same derivation, same persisted map)
               │
               ▼
event continues UNCHANGED on the existing flow:
live_events → Supabase Realtime → CasinoDataContext → dashboards / feeds
   (future stages slot in-line here: Event Bus 3.2 → Digital Twin 3.5 →
    Rules → Behaviour → Risk → AI Decision → Intervention → Projection →
    Realtime → Dashboards → Reports → Compliance → Executive → Regulator)
```

One event enters once; identity policy neither copies, re-emits, nor restarts it.

## 2. Updated architecture diagram

```
Consumers (context, simulator, IRS fn, 5 syncs, future engines)
        │  getIdentityService()
        ▼
IdentityResolutionService ── evaluatePolicy(ctx) ──► policy.ts (pure decision)
        │  select(ctx): decision.permitted? decision.providerName            
        ▼
IdentityProvider interface ──► SHA256IdentityProvider ('sha256-v1')
```

## 3. Dependency graph (audited)

- `policy.ts` **imports:** `provider.ts` (types), `config.ts` (provider precedence). Nothing else.
- `policy.ts` **is imported by:** `service.ts` (evaluation) and `index.ts` (type re-export only). Grep-verified: no other file in the tree references it.
- `policy.ts` **contains none of:** timers, subscriptions, channels, DB calls, fetch, classes, mutable module state (grep-verified `NONE`).

## 4. Integration points

| Point | Detail |
|---|---|
| `IdentityResolutionService.select()` | Consults `evaluateIdentityPolicy` before provider dispatch; refusal throws `identity policy refused resolution: <reason>` — the event does not continue |
| `IdentityResolutionService.evaluatePolicy(ctx)` | Introspection surface for governance/compliance tooling; pure, no side effects |
| Constructor 3rd arg `policyRules` | Tenant/jurisdiction deny-lists, `allowCrossCasino`, `allowFederation` — defaults preserve exact current behavior (permit all tenants; cross-casino and federation **denied** — the privacy-safe posture) |
| Consumers | **Zero changes.** Same `resolveIdentity`/`resolveBatch` calls as 3.1A |

## 5. Files modified

- **Created:** `lib/playerIdentity/policy.ts` (the decision point), this document.
- **Modified:** `lib/playerIdentity/service.ts` (policy consultation in `select()`, `evaluatePolicy()`, optional `policyRules`), `lib/playerIdentity/index.ts` (policy **types** exported), `tests/playerIdentity.test.mjs` (+6 policy tests).
- **Untouched:** every consumer, every dashboard, all edge-function business code, database, migrations, RPC.

## 6. Regression test results

- **28/28 unit tests pass** (22 prior + 6 policy): default-policy id preservation (pinned `SB-PLR-707371C3`), purity/statelessness (`deepEqual` of repeated evaluations), tenant denial, jurisdiction denial, policy-owned provider routing, cross-casino/federation flags as decisions only.
- `tsc --noEmit`: 0 errors. `next build`: compiled successfully.
- **Live after redeploy (7 functions):** batch resolution through the policy layer returns `["SB-PLR-790556A5","SB-PLR-51D20858"]` — byte-identical to pre-3.1B values; simulator burst `{"success":true,"inserted":15}`.

## 7. Evidence: decision point, not a parallel architecture

✓ Identity Policy executes **inside** `select()` on the existing resolution path — the only way to reach it is the same call every consumer already makes.
✓ No parallel pipeline: no new timers, subscriptions, channels, tables, or event emitters anywhere in the change set.
✓ No duplicate business logic: policy evaluates governance rules only; risk/behaviour/intervention logic untouched.
✓ No independent player/session/machine state: `policy.ts` holds no state of any kind; decisions are derived values, discarded after use.
✓ One authoritative event flow: post-resolution, the identical event object continues to `live_events` → Realtime → consumers exactly as before this phase.

## 8. Confirmation

No new independent workflow, engine, or subsystem was created. The Identity Policy Layer is a stateless, in-flow governance decision between the Identity Resolution Service and the Identity Provider — refusals stop the flow loudly; permits return control immediately. Future stages (Digital Twin, Rules Engine, Projection Engine) are reserved as in-line stages of this same flow and were deliberately **not** implemented in this phase.
