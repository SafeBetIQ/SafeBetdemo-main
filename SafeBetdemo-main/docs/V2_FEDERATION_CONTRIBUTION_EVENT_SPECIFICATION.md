# Federation Contribution Event Specification (Milestone 4.3)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY · Hash-only · No plaintext PII.**

## 1. Event type
`IDENTITY_FEDERATION_ATTRIBUTE` (`eventSchemaVersion = evt-1`). Append-only, jurisdiction-bound. No
duplicate/competing event types.

## 2. Fields (the exact permitted set — unknown fields are rejected at runtime)
eventId · eventType · eventSchemaVersion · eventTimestamp · sourceOperatorId · tenantId · jurisdiction ·
sbPlr · attributeType · **digest (HMAC-SHA-256 hex, 64)** · hmacAlgorithm · pepperVersion ·
normalisationVersion · canonicalFormatVersion · contributionSchemaVersion · sourceSystemRef ·
sourceSequence? · idempotencyKey · traceId? · expiryAt? · supersedesEventId? · revokesEventId?.

## 3. Forbidden content (rejected, not merely omitted)
Plaintext national id/passport/phone/email/loyalty/payment/device, names, addresses, raw pepper, secret-
store credentials, reversible identifiers, and **any unknown field**.

## 4. Runtime validation (`validateEventSchema`, fails closed)
- size ≤ 4 KB; unknown field → `unknown-schema-field`; missing field → `unsupported-schema` / `missing-version-metadata`;
- `digest` must match `^[0-9a-f]{64}$` → else `invalid-digest`;
- PII-leakage scan (email / 7+ digit run) over personal-risk string fields → `plaintext-pii-detected`;
- correct event type + schema version.

## 5. Version governance
Every event carries HMAC algorithm + pepper/normalisation/canonical-format/contribution-schema versions;
the certified six-part decision versioning downstream is unchanged. Incompatible cryptographic versions
never compare as equal (different digest).

## 6. Idempotency identity
Server-derived content key = `tenantId ␟ sbPlr ␟ attributeType ␟ pepperVersion ␟ digest` (operator key
is validated but not authoritative).
