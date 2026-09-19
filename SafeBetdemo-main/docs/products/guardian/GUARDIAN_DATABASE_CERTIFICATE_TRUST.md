# SafeBet Guardian — Database Certificate Trust (ARCH-V4-PR2 §31/§32/§33)

A CA certificate is NOT a secret, but its integrity/version/ownership is controlled configuration.

## Trust model (decided at provisioning, against the actual dedicated endpoint)
Preference order:
1. OS/Node built-in public CA trust store, when the dedicated Guardian endpoint chains to a public CA (`guardianDbSsl` with no bundle → `rejectUnauthorized:true` against the system store).
2. Otherwise the managed provider official CA bundle, supplied as controlled configuration via `GUARDIAN_DB_CA_BUNDLE` (path) or `GUARDIAN_DB_CA_PEM` (inline). Version + source recorded here.

Do NOT pin a temporary leaf certificate unless the provider architecture explicitly requires it.

## Post-provisioning certificate inspection (completed at cutover, recorded here)
endpoint hostname; TLS protocol; issuer; subject/SAN; certificate expiry; root/intermediate trust path. No credentials exposed. This section is completed once the dedicated Guardian endpoint exists.
