# SafeBet Guardian — Evidence Export (ARCH-V4-C7)

Synthetic evidence export supports **regulator/legal review preparation** — **not** provider
enforcement.

## Manifest
`buildExportManifest(...)` produces a manifest with: case reference, evidence references,
content hashes, capture timestamps, source provenance, chain-of-custody head hashes,
classification, integrity-verification status, export timestamp, export actor. No secrets.

## Manifest hash
The manifest is hashed with **SHA-256** (`manifest_hash`) over the canonical item list. This
is **hashing for integrity**, explicitly **not** a legally recognised digital signature; no
legal signing/certification is claimed without approved infrastructure/policy. An export
records a `COPIED_FOR_EXPORT` / `EXPORTED` custody event.

## Access
Export creation/retrieval is IAM-protected; no anonymous export; no SafeBet IQ operator
access; jurisdiction + classification rules apply. Export responses carry
`isLegalDetermination:false`, `isEnforcementAuthorised:false`.
