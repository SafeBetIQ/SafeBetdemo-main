# Pilot RLS & Access Control (Milestone 4.1)

**ADR-006 (frozen) · Deny-by-default · Regulator-plane only.**

## 1. Access model
`RegulatorAccessContext = { plane, jurisdiction, sovereignJurisdictions?, roles? }`.
Planes: `regulator | service | operator | casino-admin | unauthenticated`.
Roles: `reader | writer | reviewer | override-authority | appeal-reviewer | auditor | integrity`.

## 2. Enforcement functions
- `assertRegulatorRead(ctx, jurisdiction)` — allow only `regulator` plane, sovereign-authorised for
  the jurisdiction, with a read-capable role (if roles are supplied). Else `AccessDeniedError`.
- `assertServiceWrite(ctx, jurisdiction)` — allow only an authorised `service` plane, jurisdiction-
  bound, with `writer` role (if roles supplied). Governed writes never come from a regulator/operator.
- `assertOperatorNeverReads(ctx)` — structural check of the FUTURE operator write boundary; operators
  never receive federation read access. **Not enabled in 4.1.**

## 3. RLS test matrix (against the real store)
| Role / context | Read | Write |
|---|---|---|
| Correct-jurisdiction regulator (reader) | ✅ allow | ❌ deny |
| Authorised service (writer) | ❌ (not a reader) | ✅ allow |
| Regulator reviewer / auditor / integrity | ✅ allow | ❌ deny |
| Override-authority / appeal-reviewer | ✅ allow | ❌ deny (governed via engines) |
| Operator | ❌ deny | ❌ deny |
| Casino administrator | ❌ deny | ❌ deny |
| Unauthenticated | ❌ deny | ❌ deny |
| Wrong-jurisdiction regulator | ❌ deny | ❌ deny |
| Cross-sovereign regulator (no auth) | ❌ deny | ❌ deny |
| Cross-sovereign regulator (explicit `sovereignJurisdictions`) | ✅ allow | — |
| ZA context → NA/BW/KE | ❌ deny (each) | — |

All rows verified in `tests/identityFederation.persistence.test.mjs` against `RegulatorPlaneStore` /
the guard — not mocked policy logic.

## 4. Enforcement layers (honest description)
| Layer | Enforced by | In 4.1 | Deployment binding |
|---|---|---|---|
| Access control | application deny-by-default guard | ✅ implemented + tested | **native Postgres RLS on managed RDS (C2)** |
| Least privilege | service/reader/migration role separation (plan) | ✅ modelled | IAM + DB roles |
| Direct table access | not applicable (file store) | n/a | DB `REVOKE` from non-authorised roles |
| Encrypted connection | not applicable (local file) | n/a | TLS to managed RDS |

## 5. Operator write boundary (future, not enabled)
Operators will eventually contribute **hash-only** events through an approved write boundary
(Phase 4.3/4.4). In 4.1 this path is **not created**; the structural guard denies operator federation
reads/writes so the boundary is testable without being enabled.
