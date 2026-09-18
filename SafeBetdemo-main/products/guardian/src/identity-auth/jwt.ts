// ─── SafeBet Guardian — cryptographic JWT validation (ARCH-V4-PR1 §19/§20) ────
//
// Production-ready bearer/OIDC token validation. A token is NEVER trusted on its
// unsigned claims: signature (RS256 via the issuer JWKS), issuer, audience,
// expiry, not-before, token_use and subject are all verified. No signing key is
// pinned in source — keys come from an injected JWKS provider (runtime: the
// issuer's rotating JWKS; tests: a local key set). Uses only Node's built-in
// crypto (JWK → public key), so there is no new dependency and no bundled secret.

import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from 'node:crypto';

export type JwtReasonCode =
  | 'MALFORMED_TOKEN' | 'UNSUPPORTED_ALG' | 'MISSING_KID' | 'UNKNOWN_KID' | 'INVALID_SIGNATURE'
  | 'WRONG_ISSUER' | 'WRONG_AUDIENCE' | 'TOKEN_EXPIRED' | 'TOKEN_NOT_YET_VALID'
  | 'WRONG_TOKEN_USE' | 'MISSING_SUBJECT';

export class JwtValidationError extends Error {
  readonly reasonCode: JwtReasonCode;
  readonly status = 401;
  constructor(reasonCode: JwtReasonCode, message?: string) {
    super(message ?? reasonCode); this.name = 'JwtValidationError'; this.reasonCode = reasonCode;
  }
}

export interface JwtHeader { alg: string; kid?: string; typ?: string }
export interface JwtClaims {
  sub?: string; iss?: string; aud?: string | string[]; exp?: number; nbf?: number; iat?: number;
  token_use?: string; auth_time?: number; amr?: string[]; acr?: string; 'cognito:username'?: string;
  jti?: string; [k: string]: unknown;
}

/** A JWKS provider resolves a signing key (as a JsonWebKey) by `kid`. Runtime impls fetch the
 *  issuer's rotating JWKS and refetch on an unknown kid (rotation); tests inject a static set. */
export interface JwksProvider {
  getKey(kid: string): Promise<JsonWebKey | null>;
}

export interface JwtValidationConfig {
  issuer: string;                 // exact expected iss
  audience: string;               // expected aud / client_id
  tokenUse?: 'access' | 'id';     // Cognito token_use (optional but validated when set)
  clockSkewSec?: number;          // default 60
  now?: () => number;             // epoch seconds provider (tests)
}

function b64urlToBuf(s: string): Buffer { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
function b64urlToJson<T>(s: string): T { return JSON.parse(b64urlToBuf(s).toString('utf8')) as T; }

/** Decode (WITHOUT verifying) — used internally and never trusted on its own. */
export function decodeJwt(token: string): { header: JwtHeader; claims: JwtClaims; signingInput: string; signature: Buffer } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtValidationError('MALFORMED_TOKEN', 'expected 3 JWT segments');
  let header: JwtHeader, claims: JwtClaims;
  try { header = b64urlToJson<JwtHeader>(parts[0]); claims = b64urlToJson<JwtClaims>(parts[1]); }
  catch { throw new JwtValidationError('MALFORMED_TOKEN', 'unparseable header/payload'); }
  return { header, claims, signingInput: `${parts[0]}.${parts[1]}`, signature: b64urlToBuf(parts[2]) };
}

/** Fully validate a JWT and return its trusted claims, or throw JwtValidationError. */
export async function validateJwt(token: string, jwks: JwksProvider, cfg: JwtValidationConfig): Promise<JwtClaims> {
  const now = (cfg.now ? cfg.now() : Math.floor(Date.now() / 1000));
  const skew = cfg.clockSkewSec ?? 60;
  const { header, claims, signingInput, signature } = decodeJwt(token);

  // Algorithm must be RS256 (asymmetric) — never accept "none" or an HMAC downgrade.
  if (header.alg !== 'RS256') throw new JwtValidationError('UNSUPPORTED_ALG', `alg ${header.alg} not allowed`);
  if (!header.kid) throw new JwtValidationError('MISSING_KID');

  // Resolve the signing key by kid from the (rotating) JWKS — never a pinned key.
  const jwk = await jwks.getKey(header.kid);
  if (!jwk) throw new JwtValidationError('UNKNOWN_KID', `no JWKS key for kid ${header.kid}`);
  const key = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });

  // Cryptographic signature verification over the exact signing input.
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(signingInput), key, signature);
  if (!ok) throw new JwtValidationError('INVALID_SIGNATURE');

  // Registered-claim validation (only after the signature is proven).
  if (claims.iss !== cfg.issuer) throw new JwtValidationError('WRONG_ISSUER', 'issuer mismatch');
  const auds = Array.isArray(claims.aud) ? claims.aud : (claims.aud ? [claims.aud] : []);
  // Cognito access tokens carry client_id instead of aud; accept either against the configured audience.
  const clientId = typeof claims['client_id'] === 'string' ? [claims['client_id'] as string] : [];
  if (![...auds, ...clientId].includes(cfg.audience)) throw new JwtValidationError('WRONG_AUDIENCE', 'audience mismatch');
  if (typeof claims.exp !== 'number' || claims.exp + skew < now) throw new JwtValidationError('TOKEN_EXPIRED');
  if (typeof claims.nbf === 'number' && claims.nbf - skew > now) throw new JwtValidationError('TOKEN_NOT_YET_VALID');
  if (cfg.tokenUse && claims.token_use !== cfg.tokenUse) throw new JwtValidationError('WRONG_TOKEN_USE');
  if (!claims.sub) throw new JwtValidationError('MISSING_SUBJECT');
  return claims;
}
