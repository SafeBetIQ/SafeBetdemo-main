# Version 2.0 Certification — Evidence Register

**Milestone 3.8 · 2026-07-16.** Traceable, reproducible evidence for every certification claim.
Companion to `V2_ENTERPRISE_CERTIFICATION_REPORT.md`.

## 1. Reproduction commands
| Evidence | Command |
|---|---|
| Full regression | `node --test "tests/**/*.test.mjs"` → 354 pass / 0 fail |
| TypeScript | `npx tsc --noEmit` → clean |
| Adversarial (C2-2) | `node --test tests/identityFederation.certification.adversarial.test.mjs` → 12 pass |
| End-to-end (C2-4/6/7) | `node --test tests/identityFederation.certification.e2e.test.mjs` → 8 pass |
| Isolation (fwd) | `grep -rl "identityFederation" app components supabase/functions` → none |
| Isolation (rev) | `grep -rnE "@/app\|@/components\|supabase" lib/identityFederation` → none |

## 2. Component → architecture traceability (ADR-006)
| Component | File | ADR mapping | Certified surface |
|---|---|---|---|
| Types / config / version | `types.ts`, `config.ts`, `version.ts` | Foundation (3.1) | domain |
| Security scaffolding | `security.ts` | Privacy boundary | domain (scaffolding; prod HSM = condition) |
| Jurisdiction profiles | `jurisdictionProfiles.ts` | Sovereign profiles | domain |
| Identity Matching Engine | `matchingEngine.ts` | Candidates only (3.2) | domain |
| Federation Decision Engine | `decisionEngine.ts` | Sole decision authority (3.3) | domain |
| SB-NAT Registry | `registry.ts` | Approved-only creation (3.4) | domain |
| Enterprise Correlation Layer | `correlation/*` | Read-only intelligence (3.5) | domain |
| National Policy Platform | `policy/*` | Regulator-plane policy (3.6) | domain |
| Demonstration Dataset | `demo/*` | Demo v2 (3.7) | demonstration |
| NIFS service | `service.ts` | Composition root | domain |

## 3. Test-suite inventory (federation certification)
| Suite | Tests | Covers |
|---|---|---|
| `identityFederation.foundation` | 14 | flags/profiles/versions/audit/security/DI |
| `identityFederation.matching` | 11 | deterministic candidate generation (C2-1/4) |
| `identityFederation.decision` | 13 | policy-driven decisions + governance (C2-1/4) |
| `identityFederation.registry` | 21 | approved-only creation, lifecycle, integrity (C2-1/4) |
| `identityFederation.correlation` | 17 | read-only twins/timeline/intelligence, access, PII (C2-2/3/4) |
| `identityFederation.policy` | 22 | policy-as-data, outcomes, governance, integrity (C2-2/4) |
| `identityFederation.demo` | 11 | deterministic dataset, scenarios, reconciliation (C2-4/6/7) |
| `identityFederation.certification.adversarial` | 12 | **independent negative-path security (C2-2)** |
| `identityFederation.certification.e2e` | 8 | **independent clean-state e2e + determinism (C2-4/6/7)** |
| **Federation total** | **129** | |
| **Full repo regression** | **354** | includes pre-existing SafeBet suites (C2-5) |

## 4. Adversarial evidence (C2-2)
| ID | Attack | Result |
|---|---|---|
| ADV-1 | operator / casino-admin / unauthenticated query | denied |
| ADV-2 | wrong-jurisdiction / cross-sovereign regulator | denied |
| ADV-3 | cross-sovereign registry merge | rejected |
| ADV-4 | direct SB-NAT mint via public surface | none; approval-gated only |
| ADV-5 | unapproved / superseded decision registration | rejected |
| ADV-6 | registry record / audit mutation | immutable (throws) |
| ADV-7 | policy injection / executable schema | rejected (validation) |
| ADV-8 | malformed / unsupported contribution | ignored, no crash |
| ADV-9 | replay / duplicate decision | idempotent, no duplicate |
| ADV-10 | privilege escalation (role-less review/override) | denied |
| ADV-11 | malformed input to integrity verifiers | clean error, no crash |
| ADV-12 | serialised-output PII | none detected |

## 5. End-to-end evidence (C2-4/6/7)
| ID | Check | Result |
|---|---|---|
| E2E-1 | two clean-state runs byte-identical | pass |
| E2E-2 | independent reconciliation (recomputed) | pass |
| E2E-3 | 16 scenarios re-assert | pass |
| E2E-4 | legitimate correlation + false-positive protection | pass |
| E2E-5 | isolation + deny-by-default access | pass |
| E2E-6 | no plaintext PII in pipeline outputs | pass |
| E2E-7 | controlled integrity-failure detected | pass |
| E2E-EVIDENCE | counts + timings collected | printed |

## 6. Independent reconciliation categories (kept separate)
| Category | Status |
|---|---|
| Demonstration-ledger reconciliation | **AVAILABLE** — all checks pass |
| Certified operator-runtime reconciliation | **NOT AVAILABLE** — live integration absent |
| Live Event Platform GGR reconciliation | **NOT AVAILABLE** — condition C1 |

## 7. Certification evidence counts (reproduced)
128 contributions · 47 candidates · 40 auto-approved / 7 manual-review (2 approved / 5 rejected) ·
31 SB-NAT (30 multi / 2 high-interest / 1 single) · 1 split · 1 merge · registry integrity OK ·
31 twins · 186 policy evaluations · 8 policy-outcome families · 8 conflicts · national GGR 123,922 ·
reconciliation OK · determinism byte-identical across two clean states.
