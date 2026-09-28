# SafeBet Guardian — Database TLS (ARCH-V4-PR2 §30–§37)

All Guardian runtime PostgreSQL connections validate the certificate chain AND the hostname.

## Implementation
`products/guardian/src/db/tls.ts` → `guardianDbSsl({ host })` returns `{ rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: host, ca?: <bundle> }`. It is structurally incapable of returning an insecure config: it throws on the NODE_TLS bypass or the sslmode no-verify option, and the type fixes `rejectUnauthorized` to the literal `true`. There is NO insecure fallback.

## Forbidden (target 0 occurrences in Guardian runtime after cutover)
disabled `rejectUnauthorized`, the NODE_TLS bypass env, the sslmode no-verify option, `insecure=true`, trust-all certificate callback, hostname-verification bypass.

## Cutover change (11 Guardian DB clients)
Each of the 10 worker bins + `guardian-lambda` replaces `ssl: { rejectUnauthorized: false }` with `ssl: guardianDbSsl({ host: conn.host })`, applied **atomically** with the endpoint switch to the dedicated DB (not against the current shared pooler). Current source occurrences: **11** (pre-cutover); target: **0**.

## Proof plan
Positive: valid endpoint + trusted CA + matching hostname CONNECTS (report TLS version, cert validated, hostname validated). Negative: wrong/untrusted CA FAILS; hostname mismatch FAILS where safely testable. Verification is never disabled to run the positive path.
