// ─── SafeBet Guardian — JWKS providers + key rotation (ARCH-V4-PR1 §20) ───────
//
// Runtime: fetch the issuer's JWKS (…/.well-known/jwks.json), cache by TTL, and
// refetch once on an unknown kid so signing-key ROTATION is tolerated without a
// deploy. No key material is committed. Tests: a static in-memory key set.

import type { JwksProvider } from './jwt.ts';
import type { JsonWebKey } from 'node:crypto';

/** Static JWKS (tests / offline). */
export class StaticJwksProvider implements JwksProvider {
  private readonly byKid: Map<string, JsonWebKey>;
  constructor(keys: (JsonWebKey & { kid: string })[]) { this.byKid = new Map(keys.map((k) => [k.kid, k])); }
  async getKey(kid: string): Promise<JsonWebKey | null> { return this.byKid.get(kid) ?? null; }
}

interface Fetchlike { (url: string): Promise<{ ok: boolean; json: () => Promise<{ keys: (JsonWebKey & { kid: string })[] }> }> }

/** Remote JWKS with TTL cache + rotation-tolerant refetch on unknown kid. */
export class RemoteJwksProvider implements JwksProvider {
  private cache = new Map<string, JsonWebKey>();
  private fetchedAt = 0;
  private readonly jwksUri: string;
  private readonly ttlMs: number;
  private readonly fetchImpl: Fetchlike;
  private readonly now: () => number;
  constructor(
    jwksUri: string,
    ttlMs = 10 * 60 * 1000,
    fetchImpl: Fetchlike = (globalThis as unknown as { fetch: Fetchlike }).fetch,
    now: () => number = () => Date.now(),
  ) {
    this.jwksUri = jwksUri; this.ttlMs = ttlMs; this.fetchImpl = fetchImpl; this.now = now;
  }

  private async refresh(): Promise<void> {
    const res = await this.fetchImpl(this.jwksUri);
    if (!res.ok) return;                       // keep the stale cache rather than failing open
    const body = await res.json();
    const next = new Map<string, JsonWebKey>();
    for (const k of body.keys ?? []) next.set(k.kid, k);
    this.cache = next; this.fetchedAt = this.now();
  }

  async getKey(kid: string): Promise<JsonWebKey | null> {
    if (this.cache.size === 0 || this.now() - this.fetchedAt > this.ttlMs) await this.refresh();
    if (this.cache.has(kid)) return this.cache.get(kid)!;
    // Unknown kid → a rotation may have happened; refetch once.
    await this.refresh();
    return this.cache.get(kid) ?? null;
  }
}

/** Cognito issuer + JWKS URI helpers (issuer is validated exactly in jwt.ts). */
export function cognitoIssuer(region: string, userPoolId: string): string {
  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
}
export function cognitoJwksUri(region: string, userPoolId: string): string {
  return `${cognitoIssuer(region, userPoolId)}/.well-known/jwks.json`;
}
