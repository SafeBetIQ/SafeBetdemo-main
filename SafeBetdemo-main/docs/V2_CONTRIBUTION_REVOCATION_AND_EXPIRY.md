# Contribution Revocation & Expiry (Milestone 4.3)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY. Historical evidence is never deleted.**

## 1. Revocation (governed)
`FederationEventPlatform.revoke(ctx, eventId, reason)` requires an authorised contribution-service
context. It:
- references the original accepted contribution;
- records reason + authorised actor + timestamp (append-only revocation);
- **preserves** the original contribution (never deleted/rewritten);
- appends a `contribution-revoked` audit;
- **excludes** the contribution from future projection/matching.
Revocation is warranted when a source record is corrected, submitted in error, becomes invalid, its
crypto version is compromised, operator authority is revoked, or legal deletion/restriction applies.
Where required, a governed re-evaluation workflow follows (downstream milestones).

## 2. Expiry (policy-driven)
`expiryAt` metadata may depend on attribute type, jurisdiction, source validity, crypto version, operator
status, or legal retention. An **already-expired** contribution is rejected at submit
(`expired-contribution`); a future-expiry contribution is projected until `asOf` passes its expiry, then
excluded from **new** matching. Historical decisions and audit evidence remain reproducible.

## 3. Non-negotiables
- Historical evidence is **not** deleted on revocation or expiry.
- Revoked/expired contributions do **not** silently continue producing new matches.
- Original events are preserved for audit and reconstruction.

## 4. Validation
Tested: revoke excludes from projection while the original is preserved; a future-expiry contribution is
excluded from matching after its expiry (`asOf`).
