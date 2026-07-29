# Version 2.0 — Phase 4 Security & Key-Management Plan

**Phase 4.0 · PLANNING ONLY · 2026-07-16 · ADR-006 (frozen).**
**Do NOT create or rotate real secrets in Phase 4.0.** Covers **C4** (pepper + rotation) and the
**CERT-L1 / C10** runtime-encapsulation recommendation (evaluated, not implemented).

## 1. Pepper & Key-Management Plan (C4, Phase 4.2)
| Aspect | Plan |
|---|---|
| Provider | AWS Secrets Manager or approved HSM service (injected `PepperProvider` at the composition root) |
| Pepper creation | Per-jurisdiction pepper; created by an authorised key-admin process (not in 4.0) |
| Jurisdiction-specific peppers | One pepper per sovereign jurisdiction (sovereign isolation preserved) |
| Access roles | Least-privilege IAM role for pepper retrieval; separate admin role for rotation |
| Key retrieval | Server-side only; never client-exposed; retrieved by the NIFS composition root |
| Caching policy | Short-TTL in-memory cache with version tag; invalidated on rotation |
| Rotation | Versioned rotation using the existing `pepperKeyVersion`; **dual-pepper transition** (accept both old+new during overlap) so in-flight contributions remain linkable |
| Recovery | Documented recovery from Secrets Manager/HSM backup; versioned continuity preserved |
| Compromise response | Emergency disablement of a jurisdiction; rotate; audit; regulator notification per C7 |
| Audit logging | All pepper access + rotation audited (no secret material logged) |
| Backup/restore | Pepper store backup + restore drill aligned with C6 |
| Demo/pilot/prod separation | Distinct secrets per environment; **no shared secrets**; pilot uses pilot secrets only |
| Least privilege | Retrieval role cannot rotate; rotation role cannot read plaintext beyond need |
| Emergency disablement | Feature-flag + connector disable stops contribution immediately |

**Closure test (C4):** pepper served from HSM/Secrets Manager; a **key-rotation + recovery
exercise** completes with **versioned continuity** (old-version hashes remain linkable through the
transition; new contributions use the new version). No real secret is created/rotated in 4.0.

## 2. CERT-L1 / C10 — Runtime Encapsulation Recommendation (EVALUATION ONLY)
**Finding (unchanged):** the SB-NAT Registry uses TypeScript `private` for internal state, which is
compile-time only under the project's current build target; ECMAScript `#private` was reverted in
certification because the target does not support it. **No approved public path fabricates an
SB-NAT** (create() is approval-gated; ADV-4/ADV-5), so this is **LOW** severity.

### Options evaluated (none implemented in 4.0)
| Option | Approach | Compatibility impact | Regression risk | New ADR? |
|---|---|---|---|---|
| A. Module-closure encapsulation | Construct registry state in a factory closure; expose only methods | Works at current TS target; requires refactor of `SbNatRegistry` construction | Medium (touches registry internals; large test surface) | No |
| B. WeakMap-backed private state | Store per-instance state in a module-scoped `WeakMap` keyed by `this` | Works at current target; verbose | Medium | No |
| C. Factory-based internal state | `createSbNatRegistry()` returns an object literal over closed-over state; class retained as type | Works at current target; changes construction ergonomics | Medium | No |
| D. Interface narrowing | Export a narrow `SbNatRegistryReader`/writer interface; keep class internal | Reduces surface but does not make state runtime-private on its own | Low | No |
| E. Non-exported storage implementation | Keep state class non-exported; expose only a facade | Similar to A/D | Low–Medium | No |
| F. Build-target upgrade to ES2015+ | Enable ECMAScript `#private` fields/methods | **Global config change** — affects whole app build; **out of scope**, must be separately assessed | High (whole-app) | Possibly (build-config governance) |
| G. Runtime access-control tests | Adversarial injection tests asserting state is unreachable | Complements any of A–F; not a control by itself | Low | No |
| H. Registry service-boundary hardening | Only expose the registry through NIFS with no state accessor | Already largely true; compensating control | Low | No |

### Recommendation
**Primary: Option A (module-closure encapsulation)** for `SbNatRegistry` internal state, combined
with **Option G** (runtime injection adversarial tests) and **Option H** (service-boundary
exposure). This achieves runtime-private state **without** a global TS-target change and **without**
architectural change (registry contract unchanged). **Option F (target upgrade) is NOT recommended
for C10 alone** — it is a whole-app build decision requiring separate assessment (and possibly a
build-governance ADR); do not assume it is acceptable.

### Required tests (Phase 4.1)
- Adversarial: external attempt to read/mutate registry internal state **fails** (no reachable
  `records`/`mintedIds` handle); direct injection of a fabricated record is impossible.
- Full regression remains green (registry public behaviour unchanged).

### New ADR?
**No** for Options A/B/C/D/E/G/H (no architectural change; registry contract preserved). **Yes,
potentially** only if Option F (global target upgrade) were pursued (build-governance decision).

## 3. Broader security controls carried into pilot
Deny-by-default regulator-plane access; role separation (evaluator/reviewer/override-authority/
appeal-reviewer); tenant + jurisdiction + sovereign isolation; hash-only federation boundary; no
plaintext PII; immutable decision/registry/policy audit (durable per C3); strict policy-schema
validation (no executable policy code); safe diagnostics + error messages; no sensitive logging;
connector authn/authz + replay/idempotency (C5); RLS at the durable store (C2).

## 4. Closure summary
- **C4:** rotation + recovery drill passes with versioned continuity (Phase 4.2).
- **C10:** runtime-private registry state via module-closure encapsulation; adversarial injection
  fails (Phase 4.1). LOW residual acceptable in pilot if deferred, with compensating controls.
