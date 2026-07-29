# Pilot Federation Cryptographic Specification (Milestone 4.2)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY.**

## 1. Construction
Federation identity attributes use **HMAC-SHA-256** keyed with a jurisdiction-specific pepper. No
unkeyed SHA-256, no reversible encryption, no custom/deprecated/truncated algorithm.

## 2. Canonical input (`cf-1`)
`canonicalHashInput(jurisdiction, attributeType, normalisedValue)` =
`LP(cf-1) | LP(SB-FED-ATTR) | LP(jurisdiction) | LP(attributeType) | LP(NFC(normalisedValue))`,
where `LP(x) = "<utf8-byte-length>:<x>"`. Length-prefixing + fixed separator make the encoding
collision-safe (no boundary merging, attribute-type confusion, separator/whitespace ambiguity); NFC
removes Unicode ambiguity. The plaintext canonical input is **never logged**.

## 3. Versions (governance)
`HMAC_ALGORITHM = HMAC-SHA-256` · `CANONICAL_FORMAT_VERSION = cf-1` · `NORMALISATION_VERSION = norm-1`
· `CONTRIBUTION_SCHEMA_VERSION = contrib-1`. Every produced hash carries a `ContributionCryptoStamp`
(jurisdiction, attribute type, algorithm, canonical-format version, normalisation version, pepper
version, contribution-schema version). Existing six-part decision versioning is unchanged.

## 4. Normalisation
Deterministic, attribute-specific, jurisdiction-aware, applied **before** HMAC (certified
`normaliseAttribute` + NFC). Only jurisdiction-approved attributes are hashable; non-approved
attributes are rejected (fail-closed). The permitted set is policy-driven and not broadened here.

## 5. Provider surface (narrow)
`hashAttribute` · `hashAttributeVersion` · `verifyVersion` · `rotationState` · `invalidateCache` ·
`health`. It exposes **no** raw pepper, secret-store client, mutable buffer, arbitrary/general
hashing/encryption, secret enumeration/export, or production reference.

## 6. Matching segregation
Two hashes are comparable only when `sameCryptoVersion(a, b)` (equal pepper version + canonical-format
+ normalisation + algorithm). The Matching Engine must never treat different-version hashes as equal
(wired in Phase 4.3; the certified engine is unchanged in 4.2).

## 7. Deployment binding
Pepper served from AWS Secrets Manager / HSM with KMS at-rest encryption + least-privilege IAM =
condition **C4** deployment residual (OPEN).
