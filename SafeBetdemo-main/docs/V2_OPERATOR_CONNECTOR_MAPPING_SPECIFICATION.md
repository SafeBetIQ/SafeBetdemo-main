# Operator Connector Mapping Specification (Milestone 4.4)

**ADR-006 (frozen) · Hash-before-boundary · Jurisdiction-driven allowlist.**

## 1. Source record → contribution
`OperatorSourceRecord { sourceRef, sourceSequence, sourceTimestamp, sourceVersion, status, sbPlr,
attributes: [{ type, value }], supersedesSourceRef? }`. Only the fields needed for SB-PLR resolution +
approved attribute generation are consumed; the **full operator source record is never sent** into
SafeBet IQ.

## 2. Attribute allowlist
Permitted attributes = `config.supportedAttributes` ∩ the jurisdiction profile (`isAttributeEnabled`).
The connector **rejects/excludes** unapproved attributes, excessive demographics, raw payment/name/address/
unnecessary personal data, and unsupported identity categories. Arbitrary mapping **cannot** broaden the
jurisdiction policy.

## 3. SB-PLR resolution
Each source player maps to a valid, tenant-scoped SB-PLR via the Identity Resolution resolver. Validated:
format, existence, `active` status, tenant + operator + jurisdiction ownership. Missing/invalid/inactive/
cross-tenant → rejected. The connector **never creates** an SB-PLR or SB-NAT; onboarding that legitimately
creates SB-PLR uses the approved Identity Resolution boundary.

## 4. Hash-before-boundary
For each approved attribute: normalise → **HMAC-SHA-256** via the 4.2 provider (jurisdiction pepper) →
digest. The **plaintext value stays local and is discarded**; only the digest + version stamp form the
contribution. Wrong/revoked pepper and cross-jurisdiction mismatch are rejected (fail closed).

## 5. Event id (idempotency)
`connectorId : sourceRef : attributeType : sourceVersion` — stable across restarts/reprocessing so the
Event Platform dedups replays; a corrected record (new `sourceVersion`) yields a new event id.

## 6. Version governance
Contribution carries HMAC algorithm + pepper/normalisation/canonical-format/contribution-schema versions
(from the 4.2 stamp) — the Event Platform validates them and segregates incompatible versions.
