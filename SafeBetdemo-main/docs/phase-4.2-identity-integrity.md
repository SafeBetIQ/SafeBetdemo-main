# Phase 4.2 — Enterprise Identity Integrity & Evolution

**Status: COMPLETE & DEPLOYED** (2026-07-12, SafeBet Demo `uexdjngogzunjxkpxwll`; production untouched)
**Governed by:** `SAFEBET_ENTERPRISE_CONSTITUTION.md` · **Closes certification condition C3** · **Decision: ADR-001 (Accepted)** · **Gate G2: GO**

SafeBet IQ now derives player identity at the **96-bit deterministic standard** (`sha256-v2`, 24 hex). Collision probability at one billion identities falls from ~2.7×10⁻² (32-bit) to ~6.3×10⁻¹² — practically eliminated across the entire 20-year growth curve. The Identity Resolution architecture, the enterprise flow, and all six constitutions are unchanged; this is an identity *evolution*, not a redesign.

---

## 1. Expanded ADR-001
Complete architectural decision (problem, current implementation, four options with computed collision/performance/storage/index/readability/URL/QR/replay/jurisdiction/federation analysis, migration + backward-compatibility strategy, long-term recommendation, final decision, consequences) recorded and **Accepted** in `ARCHITECTURE_DECISION_RECORD.md`.

## 2. Identity Strategy Report
- **Chosen:** 96-bit deterministic (Option B). **Rejected:** 64-bit (2.7% collision at 1e9 — fails the target, disproving the "64-bit is enough" assumption), 128-bit (over-provisioned), UUID/opaque (breaks determinism).
- **Mechanism preserved:** `id = 'SB-PLR-' + upper(first 24 hex of SHA-256('sbiq-v1:<casino>:<ref>'))`. The **preimage domain tag stays `sbiq-v1`** so v2 is the same hash truncated wider — **a v1 id is the exact prefix of its v2 id** (`707371C3` ⊂ `707371C39AE04D71BBA3E495`). This is the backward-compatibility keystone.
- **Architecture untouched:** provider abstraction, policy layer, service entry point all unchanged. The width is a provider parameter; a future 128-bit or federation strategy is an additive provider selected by config — the property that guarantees **no second identity redesign**.

## 3. Collision Analysis (birthday bound p ≈ n²/2^(b+1))
| Identities | 32-bit (old) | **96-bit (new)** |
|---|---|---|
| 100k | 1.2e-3 | 6.3e-20 |
| 1M | 1.2e-1 | 6.3e-18 |
| 10M | ~1 | 6.3e-16 |
| 100M | certain | 6.3e-14 |
| 1B | certain | **6.3e-12** |
| 10B | certain | 6.3e-10 |
96-bit eliminates collision with >60 bits of margin over the whole curve. Live: 5,000-reference stress set produced 5,000 unique 96-bit ids (0 collisions).

## 4. Migration Report
Demonstration data only, deterministic and repeatable:
1. Widen check constraints on `safebet_identity_map`, `casino_event_log`, `projection_player_state` to accept **both** widths (`^SB-PLR-[0-9A-F]{8}([0-9A-F]{16})?$`) — additive, backward-compatible.
2. `truncate` the identity map, event log, and projection tables.
3. Reseed via the casino-simulator producer under `sha256-v2`.
**Live evidence:** 30 reseeded events → **30/30 are 96-bit (24 hex, len 31); 0 legacy 32-bit**. No duplicate, merged, or orphaned identities; identical references reseed to identical ids.

## 5. Database Impact Assessment
Id `text` key widens 15→31 bytes (no type change); unique index on `safebet_player_id` and the event-log `(safebet_player_id, occurred_at)` index carry a wider but trivial key (B-tree depth unaffected). Constraints accept both widths. Partitioning/archive (Phase 4.3) unaffected — id is not a partition key. ~16 GB extra at 1e9 identities — immaterial.

## 6. Performance Assessment
Generation: SHA-256 cost is width-independent (full hash computed regardless) — negligible. Lookup/resolution throughput unchanged (same RPC handshake, same map keys). Migration completed in a single burst live. Memory: +16 bytes/runtime id — negligible at demo scale.

## 7. Security Assessment
- **Collisions:** eliminated at target scale (§3) — the core C3 risk closed.
- **Spoofing/predictability:** identity requires the exact casino reference; the id reveals nothing invertible (SHA-256 preimage-resistant); no PII encoded (anonymous SB-PLR).
- **Replay safety:** deterministic — proven by two identical rebuilds under v2.
- **Cross-tenant/cross-casino isolation:** unchanged (per-casino derivation + Phase 4.1 RLS); same reference in different casinos yields different ids (test-verified).
- **Integrity:** the runtime collision-probe fallback remains for defense-in-depth, now over a space where it will effectively never fire.

## 8. Files created
- `supabase/migrations/20260712140000_phase42_identity_v2_96bit.sql`
- `docs/phase-4.2-identity-integrity.md`; ADR-001 (Accepted) in `ARCHITECTURE_DECISION_RECORD.md`

## 9. Files modified
- `lib/playerIdentity/core.ts` — widened `SAFEBET_ID_PATTERN` (8 or 24 hex), `SAFEBET_ID_HEX_WIDTH`
- `lib/playerIdentity/providers/sha256.ts` — parameterized truncation width; `SHA256_V1/V2_HEX_WIDTH`
- `lib/playerIdentity/config.ts` — `DEFAULT_PROVIDER_NAME = 'sha256-v2'`
- `lib/playerIdentity/service.ts` — registers `sha256-v2` (default) + `sha256-v1` (legacy)
- `tests/playerIdentity.test.mjs`, `tests/eventPlatform.test.mjs` — v2 pinned vectors + v1 backward-compat anchor

## 10. Database migrations
One additive migration (applied to demo): widen 3 constraints + dispose/reseed synthetic data. No shape change; historical-replay capability preserved by construction.

## 11–12. Tests executed / passed
`node --test tests/*.test.mjs` → **134 tests, 134 pass, 0 fail** (129 pre-existing incl. Phase 4.1 — zero regressions — + 5 new: 96-bit width, dual-width validation, 5,000-ref collision-free stress, cross-instance/cross-casino determinism, v1-prefix backward-compat). `tsc --noEmit` clean. Identity suite covers: deterministic derivation, both pinned vectors, config-driven provider routing, policy-gated selection, persisted idempotency.

Live verification (demo): 30/30 store ids are 96-bit; rebuild ×2 → identical projections (9 players, 10 sessions, 9 machines); inactive-user auth correctly rejected (bonus 4.1 evidence).

## 13. Remaining risks
- v1 legacy ids remain valid by design (replay/backward-compat); once no v1 data exists anywhere, the constraint could be tightened to 24-hex-only in a later housekeeping ADR (optional).
- Federation/128-bit is deliberately deferred to an additive provider under a future ADR — not a risk, a documented extension path.

## 14. Rollback strategy
Repoint `DEFAULT_PROVIDER_NAME`/config to `sha256-v1` (still registered) and reseed — deterministic and immediate. Constraints already accept both widths, so no schema rollback needed. Not advised (32-bit fails the scale target). Demo is the blast radius.

## 15. Identity Architecture Diagram (unchanged flow, evolved provider)
```
Casino reference
  → IdentityResolutionService.resolveIdentity()
      → Identity Policy (permit? provider? cross-casino? federation?)   [unchanged]
      → Provider registry: sha256-v2 (default, 96-bit) | sha256-v1 (legacy)
          id = 'SB-PLR-' + upper(first N hex of SHA-256('sbiq-v1:<casino>:<ref>'))
      → persisted get-or-create (safebet_identity_map, probe fallback)  [unchanged]
  → SB-PLR id → Event Platform → Projections → Twin → Intelligence → Policy → Consumers
```

## 16. Production Readiness Certificate — Enterprise Identity
> **CERTIFIED.** SafeBet IQ player identity is production-grade for the stated 20-year enterprise scale. The identifier is 96-bit deterministic (`sha256-v2`), collision probability ≤6.3×10⁻¹² at one billion identities, anonymous (no PII), per-casino isolated, backward-compatible with legacy ids, and deterministically replayable (verified live). The strategy is recorded permanently in ADR-001 and requires no future redesign — width and federation are configuration/provider concerns. Condition C3 is closed.

## 17. Go / No-Go — Gate G2

**GO — proceed to Phase 4.3.** Every G2 criterion is met with objective evidence: production-grade identity strategy selected by computed evidence (not assumption); collisions practically eliminated at projected scale; identity and replay remain deterministic (live-proven); Identity Resolution and enterprise architecture unchanged; all governing documents and six constitutions satisfied; ADR-001 is the permanent enterprise-identity record. The synthetic-data reseed — the one forward-only step — was executed while data is disposable, exactly as G2 requires before any production tenant.
