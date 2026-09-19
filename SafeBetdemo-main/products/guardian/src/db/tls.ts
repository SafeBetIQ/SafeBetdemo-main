// ─── SafeBet Guardian — CA-validated PostgreSQL TLS (ARCH-V4-PR2 §30–§37) ─────
//
// The single source of truth for every Guardian PostgreSQL client's TLS settings.
// After PR2 cutover EVERY Guardian runtime connection MUST validate the certificate
// chain AND the hostname. Disabling verification (the disabled rejectUnauthorized value),
// sslmode=no-verify, and trust-all callbacks are FORBIDDEN — this module cannot emit
// an insecure config (it throws instead), so it is impossible to "just remove false".
//
// A CA certificate is NOT a secret: the trusted CA bundle is controlled configuration,
// supplied by path (GUARDIAN_DB_CA_BUNDLE) or inline PEM (GUARDIAN_DB_CA_PEM). When no
// bundle is configured, Node's built-in public trust store is used (rejectUnauthorized:true)
// — valid when the endpoint chains to a public CA. Hostname verification is always on
// (node-postgres/tls verifies the host against the cert SAN when rejectUnauthorized is true).

import { readFileSync } from 'node:fs';

export interface GuardianTlsConfig {
  rejectUnauthorized: true;          // ALWAYS true — the type itself forbids false
  ca?: string | string[];            // trusted CA bundle (PEM), when the endpoint needs one
  servername?: string;               // explicit SNI/hostname for verification
  minVersion: 'TLSv1.2';
}

export class InsecureTlsForbiddenError extends Error {
  constructor(msg: string) { super(msg); this.name = 'InsecureTlsForbiddenError'; }
}

/** Guard: refuse any attempt to disable verification, whatever the source. */
export function assertNoInsecureTls(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new InsecureTlsForbiddenError('the NODE_TLS reject-unauthorized bypass is forbidden for Guardian DB connections');
  }
  if ((env.GUARDIAN_DB_SSL_MODE ?? '').toLowerCase() === 'no-verify') {
    throw new InsecureTlsForbiddenError('the sslmode no-verify option is forbidden for Guardian DB connections');
  }
}

function loadCaBundle(env: NodeJS.ProcessEnv): string | undefined {
  if (env.GUARDIAN_DB_CA_PEM && env.GUARDIAN_DB_CA_PEM.includes('BEGIN CERTIFICATE')) return env.GUARDIAN_DB_CA_PEM;
  if (env.GUARDIAN_DB_CA_BUNDLE) {
    const pem = readFileSync(env.GUARDIAN_DB_CA_BUNDLE, 'utf8');
    if (!pem.includes('BEGIN CERTIFICATE')) throw new InsecureTlsForbiddenError('GUARDIAN_DB_CA_BUNDLE is not a PEM certificate');
    return pem;
  }
  return undefined; // fall back to Node's built-in public CA trust store (still rejectUnauthorized:true)
}

/** Build the CA-validated TLS config for a Guardian pg client. Never returns an insecure config. */
export function guardianDbSsl(opts: { host?: string; env?: NodeJS.ProcessEnv } = {}): GuardianTlsConfig {
  const env = opts.env ?? process.env;
  assertNoInsecureTls(env);
  const ca = loadCaBundle(env);
  const cfg: GuardianTlsConfig = { rejectUnauthorized: true, minVersion: 'TLSv1.2' };
  if (ca) cfg.ca = ca;
  if (opts.host) cfg.servername = opts.host;   // enforce hostname verification against this SAN
  return cfg;
}

/** Convenience: a full pg.Client ssl option object. Identical shape to `guardianDbSsl`. */
export function guardianPgSsl(host?: string): GuardianTlsConfig { return guardianDbSsl({ host }); }
