# V2 — Access-Control Validation (Milestone 4.6)

**Regulator-plane deny-by-default access control validated in the deployed-runtime composition (in-process).**

## 1. Operator Access (must be denied)
Exercised in the deployed smoke:
| Attempted operator access | Result |
|---|---|
| National Player Twin over an SB-NAT | **AccessDeniedError** |
| National correlation / intelligence | **Denied** (no operator handle) |
| National financial aggregate (`national()`) | **Denied** |
| SB-NAT candidates / decisions / registry mutation | **Structurally impossible** (operators hold no handle) |

Operators remain **write-only** contributors (hash-only, at the connector/contribution boundary) and never
read the regulator plane.

## 2. Regulator Access (scoped)
- Jurisdiction-bound + role-scoped (evaluator / reviewer / override-authority / appeal-reviewer).
- Cross-sovereign access denied; wrong-role access denied (3.5/3.6 + this milestone).
- Read-only over the National Player Twin/timeline/intelligence; cannot mutate operator runtime, financial
  projections, or Digital Twins.

## 3. Feature-Flag Gating
Correlation/policy reads are **denied when federation is disabled** (default), independent of role — verified
by the rollback step (emergency shutdown → correlation denied).

## 4. Limitation
Validated at the **composition boundary in-process**. Deployed **API-level** negative tests (HTTP 401/403
against a running service) were **not** executed — no deployed app. C8 residual.
