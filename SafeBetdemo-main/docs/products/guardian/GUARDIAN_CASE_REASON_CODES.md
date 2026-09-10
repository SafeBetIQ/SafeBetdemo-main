# SafeBet Guardian — Case Reason Codes (ARCH-V4-C6)

Reason codes are **investigation reasons, not legal violations**. Deterministic and
explainable (no AI, no black-box score). None sets legality or enforcement.

| Reason code | Meaning (non-legal) |
|---|---|
| `MULTI_SIGNAL_CORRELATION` | Two or more C1–C5 domains referenced in one intake (evidence, not illegality). |
| `NO_AUTHORITATIVE_REGISTRY_MATCH` | C1 registry NO_MATCH. Absence ≠ illegal. |
| `DOMAIN_REFERENCE_INCONSISTENCY` | C2 domain reference not resolvable/consistent. |
| `APP_REFERENCE_INCONSISTENCY` | C3 app reference not resolvable/consistent. |
| `PAYMENT_REFERENCE_INCONSISTENCY` | C4 payment reference not resolvable/consistent. |
| `GEO_JURISDICTION_INCONSISTENCY` | C5 geo reference inconsistent/not-found. |
| `REGISTRY_SOURCE_CONFLICT` | Conflicting registry source → review, not silent resolution. |
| `INVESTIGATION_REQUIRED` | Umbrella: a human investigation is required (never "illegal"). |

## Priority (deterministic)
- **HIGH** — `NO_AUTHORITATIVE_REGISTRY_MATCH` + multi-signal, or ≥2 strong inconsistency signals.
- **MEDIUM** — one strong inconsistency signal, source conflict, or multi-signal correlation.
- **LOW** — matched references, no review signal.

CRITICAL is available as an investigation priority but is never equated with proven
illegality; priority changes require an `override_reason` (append-only history).
