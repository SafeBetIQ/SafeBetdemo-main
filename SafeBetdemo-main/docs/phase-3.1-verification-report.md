# Phase 3.1 — Identity Resolution Service: Implementation Verification Report

**Date:** 2026-07-09 · **Branch:** Demo · **Environment:** SafeBet Demo (`uexdjngogzunjxkpxwll`) — Production untouched.

---

## 1. What was implemented

The Identity Resolution Service (IRS) is now the **only** source of SafeBet IQ player identity.

- **Deterministic derivation:** `SB-PLR-XXXXXXXX` = first 8 hex chars of `SHA-256("sbiq-v1:<casino_id>:<normalized_ref>")`, uppercased. Pure function — identical output in the browser, Deno edge functions, Node tests, and Postgres (`pgcrypto`).
- **Persisted mapping:** `safebet_identity_map` stores only the SHA-256 hash of the casino player reference and the SB-PLR id. The raw reference is never stored, logged, or echoed.
- **Atomic resolution:** `resolve_player_identity(casino_id, ref_hash, candidate_id)` RPC — idempotent get-or-create with 32-bit-collision signalling; EXECUTE granted to `service_role` only.
- **Both `generateSafeBetId()` implementations deleted.** Zero `Math.random()` identity generation remains anywhere in the codebase (grep-verified).
- **Simulator (edge):** resolves stable synthetic patrons `demo-patron-1..150` through the IRS — same patron → same SB-PLR id across ticks, cold starts, and consumers.
- **Browser context:** `CasinoDataContext` derives the same 150 patron identities at startup (pure derivation, refresh-stable, byte-identical to the simulator's) and persists mappings via the `identity-resolution` edge function.
- **Ingestion boundary:** all 5 platform integration syncs (Playtech, BetSoftware, Evolution, Altenar, SoftSwiss) now resolve the external player reference through the IRS and **no longer write names, emails, or phone numbers** into `players`.
- **All remaining player PII removed** from UI queries, search filters, displays, intervention messages, and edge-function responses/logs.
- **Display helpers unified:** `formatPlayerId` / `playerAvatarChars` now exist only in `lib/playerIdentity` (5 duplicate local implementations removed).

## 2. Files created

| File | Purpose |
|---|---|
| `lib/playerIdentity/core.ts` | Canonical derivation, hashing, format, display helpers (isomorphic, dependency-free) |
| `lib/playerIdentity/resolver.ts` | Persisted resolver: RPC call, idempotency, collision probing |
| `lib/playerIdentity/index.ts` | Public API (`@/lib/playerIdentity`) |
| `supabase/functions/identity-resolution/index.ts` | IRS edge function (single + batch resolution, service-role, JWT-verified) |
| `supabase/migrations/20260709100000_create_safebet_identity_map.sql` | Table + RPC + backfill |
| `supabase/migrations/20260709101500_widen_live_events_event_types.sql` | Fixes pre-existing constraint that silently rejected all lifecycle events |
| `tests/playerIdentity.test.mjs` | 17 unit tests (run: `node --test tests/playerIdentity.test.mjs`) |

## 3. Files modified

**Engines:** `contexts/CasinoDataContext.tsx` (identity pool replaces random generation), `supabase/functions/casino-simulator/index.ts` (IRS resolution replaces random generation), `tsconfig.json` (`allowImportingTsExtensions` for shared browser/Deno lib).

**PII removed / helpers deduplicated (19 app files):** `app/casino/interventions`, `app/casino/ai-intelligence`, `app/casino/dashboard`, `app/casino/players` (+ investigate), `app/casino/wellbeing-games`, `app/casino/api-centre` (API contract now documents `casino_player_ref` — no identity fields), `app/regulator/wellbeing-compliance`, `app/behavioral-risk-intelligence`, `app/admin/wellbeing-games`, `app/wellbeing-game/play/[token]`, `components/{LiveCasinoFeed, PlayerRiskProfileSheet, PlayerHistorySheet, SendNovaIQInvitation, CrossOperatorIntelligence, CasinoXAIDashboard, WellbeingGamesDashboardWidget, SaaSWellbeingGamesManagement}`, `components/live/{MachineMonitor, LiveBettingFeed, LiveRiskOverlay}`, `components/compliance/{PlayerRiskMonitor, InterventionAlerts, SessionBehaviourAnalytics, SelfExclusionCompliance}`, `components/regulator/HighRiskPlayerAnalytics`, `components/wellbeing-games/DetailedSessionViewer`.

**Edge functions cleaned:** `process-wellbeing-completion` (no names in narratives/alerts/responses), `intervention-engine` (no name selects; `{player_name}` → "Valued Player"), `cross-operator-intelligence` (join drops names), 5 × `integration-*-sync` (IRS resolution, PII fields dropped from upserts).

**Staff PII untouched by design:** staff/training/user-roles pages operate on employee records, not players (verified: zero `players`-table references in all 8 remaining files matching `first_name`).

## 4. Database migrations (applied to SafeBet Demo)

1. `create_safebet_identity_map` — table, RLS (no client policies), RPC, backfill.
   *Named `safebet_identity_map` because a pre-existing `player_identity_map` (self-exclusion-network global identity links, 450 rows) already occupied the design's table name. That table was not touched.*
2. `widen_live_events_event_types` — pre-existing defect: the check constraint allowed only 11 legacy event types, so **every lifecycle event the simulator emitted was silently rejected**. Constraint now matches the actual event vocabulary.

## 5. API changes

- **New:** `POST /functions/v1/identity-resolution` — `{casino_id, casino_player_ref}` or `{casino_id, casino_player_refs[]}` → SB-PLR id(s). JWT-verified; hashes in-process; never returns or logs raw references.
- **Documented contract updated:** `/v1/players` register example no longer instructs casinos to send `first_name/last_name/date_of_birth` — it takes an opaque `casino_player_ref`.
- **Removed from responses:** `player_name` (process-wellbeing-completion).

## 6. Edge functions deployed (11)

`identity-resolution` (new, v1), `casino-simulator`, `send-wellbeing-invitation`, `process-wellbeing-completion`, `intervention-engine`, `cross-operator-intelligence`, `integration-playtech-sync`, `integration-betsoftware-sync`, `integration-evolution-sync`, `integration-altenar-sync`, `integration-softswiss-sync` — all bundling the single shared `lib/playerIdentity` source.

## 7. Tests executed & passed

| Test | Result |
|---|---|
| Unit tests (`node --test tests/playerIdentity.test.mjs`) | **17/17 pass** — format, determinism, uniqueness (150/150), normalisation, collision probing, resolver idempotency, "raw ref never transmitted" |
| Pinned derivation vector | `casino …0001 + demo-patron-1 → SB-PLR-707371C3`, independently reproduced via `openssl dgst -sha256` |
| TypeScript (`tsc --noEmit`) | **0 errors** |
| Production build (`next build`) | **Compiled successfully**, full route table emitted |
| SQL ↔ TS derivation parity | 5/5 sampled players: stored id = SQL re-derivation = TS formula |
| Backfill integrity | **525/525** players canonical (`SB-PLR-[0-9A-F]{8}`), 0 non-canonical, 525 mappings |
| RPC determinism (live DB) | call 1 → `(SB-PLR-51D20858, created)`, call 2 → `(SB-PLR-51D20858, existing)` |
| IRS edge function determinism (live HTTP) | same ref twice → `SB-PLR-790556A5` both times |
| Simulator E2E (live) | burst → `{"success":true,"inserted":15}`; all inserted `live_events.player_id` canonical **and present in `safebet_identity_map`** |

## 8. Success criteria for Phase 3.1

| Requirement | Status |
|---|---|
| Dedicated Identity Resolution module | ✅ `lib/playerIdentity` + edge function + RPC |
| Persist anonymous identity mappings | ✅ `safebet_identity_map` (hash + SB-PLR only) |
| Replace every `generateSafeBetId()` | ✅ both deleted; zero random identity generation remains |
| Same casino reference → same SafeBet ID, always | ✅ proven at unit, SQL, RPC, and HTTP levels |
| Remove all remaining player PII | ✅ UI, queries, messages, logs, API contract, ingestion |
| Simulator uses IRS | ✅ deployed + live-verified |
| Components consume only SB-PLR ids | ✅ single shared formatter everywhere |

## 9. Remaining blockers / notes for Phase 3.2

- **Pre-existing, out of 3.1 scope:** `simulate_live_feed` DB function logs `ON CONFLICT DO UPDATE cannot affect row a second time` (its internal upsert). The Event Bus (3.2/3.3) replaces this path; flagged, not patched, per "no temporary fixes".
- `players.email/phone` **columns** still exist (used only server-side by wellbeing-invitation delivery). Full column removal belongs to the Phase 3.3+ schema work once delivery contact routing moves behind the casino boundary.
- `players.external_id` retains the opaque platform key as upsert conflict target; it disappears when ingestion becomes event-based (3.2/3.3).
- Browser-derived identities are pure derivations; the rare (≈n²/2³³) ID-collision probe path can only be arbitrated by the persisted map — irrelevant at demo scale, resolved automatically via the IRS on every server-side path.
