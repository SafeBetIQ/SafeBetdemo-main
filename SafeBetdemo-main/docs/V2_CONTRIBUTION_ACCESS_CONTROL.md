# Contribution Access Control (Milestone 4.3)

**ADR-006 (frozen) · Deny-by-default · Boundary-enforced (not UI).**

## 1. Planes
`contribution-service` (authorised operator integration boundary) · `regulator` · `operator` ·
`casino-admin` · `unauthenticated`.

## 2. Capabilities
| Capability | Allowed |
|---|---|
| Submit hash-only contribution | `contribution-service` with matching operator + tenant + jurisdiction |
| Read accepted contribution evidence | `regulator` or the authorised service |
| Revoke a contribution | `contribution-service` (authorised) |
| Project / matching handoff | service/regulator (read of accepted events) |

## 3. Denied (by default)
Operator general federation reads · casino-admin federation reads · operator access to another tenant ·
operator access to SB-NAT / matching candidates / federation decisions / national policy outcomes ·
wrong-jurisdiction service access · unauthenticated event submission.

## 4. Attribution integrity
Operator/tenant/jurisdiction are taken from the **authenticated context**, not inferred from the untrusted
payload alone; the event must match the context (`unauthorised-operator` / `tenant-mismatch` /
`wrong-jurisdiction` otherwise). SB-PLR ownership must match both Identity Resolution and the context.

## 5. Enforcement
Enforced at the service boundary (`assertSubmit` / `assertRead`), throwing `ContributionAccessError`
(mapped to `unauthenticated-source` in a rejection record for submit). **Not** UI-based. Tested:
unauthenticated + operator submit denied; operator read denied.

## 6. Deployment binding
Managed authn (mTLS / signed tokens) + IAM least-privilege for the contribution service, and native DB
RLS for reads, are Phase 4.4 / C2 bindings; the pilot enforces the plane/role model in-process.
