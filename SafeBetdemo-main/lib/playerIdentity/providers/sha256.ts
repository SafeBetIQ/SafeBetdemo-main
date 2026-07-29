// ─── SHA256IdentityProvider — the ONLY module that knows the algorithm ───────
//
// Encapsulates the entire SafeBet IQ deterministic identity mechanism:
//   id = 'SB-PLR-' + first N hex chars of SHA-256('sbiq-v1:<casino>:<ref>'), uppercased
//
// The truncation width N is the ONLY difference between provider versions
// (ADR-001, Phase 4.2):
//   • sha256-v2 (N=24, 96-bit) — the production standard; collision-safe past
//     10^10 identities. Registered as the default.
//   • sha256-v1 (N=8,  32-bit) — legacy; retained so historical events replay
//     deterministically. A v1 id is the exact PREFIX of the v2 id for the same
//     reference (identical hash, wider slice) — backward compatibility by
//     construction.
// The hash PREIMAGE domain tag ('sbiq-v1') is stable across widths so this
// continuity holds; it is NOT the provider version.
//
// This file is intentionally NOT exported from lib/playerIdentity/index.ts.
// Consumers obtain identities exclusively through IdentityResolutionService.
//
// Privacy contract (unchanged from Phase 3.1):
//   • The raw casino reference never leaves this provider un-hashed.
//   • Only the SHA-256 hash and the SB-PLR id are persisted.

import type { IdentityContext, IdentityProvider, RpcClient } from '../provider.ts';
import { SAFEBET_ID_PREFIX, isSafeBetId } from '../core.ts';

const HASH_DOMAIN = 'sbiq-v1';
const MAX_COLLISION_PROBES = 4;

/** Production identity standard (Phase 4.2): 96-bit, 24 hex chars. */
export const SHA256_V2_HEX_WIDTH = 24;
/** Legacy identity width (Phase 3.1): 32-bit, 8 hex chars. */
export const SHA256_V1_HEX_WIDTH = 8;

function normalizeCasinoRef(casinoRef: string): string {
  return casinoRef.trim().toLowerCase();
}

async function hashCasinoRef(casinoId: string, casinoRef: string, probe = 0): Promise<string> {
  const input = `${HASH_DOMAIN}:${casinoId}:${normalizeCasinoRef(casinoRef)}${probe > 0 ? `#${probe}` : ''}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function safeBetIdFromHash(refHash: string, hexWidth: number): string {
  return `${SAFEBET_ID_PREFIX}${refHash.slice(0, hexWidth).toUpperCase()}`;
}

interface ResolveRow {
  out_safebet_player_id: string | null;
  out_status: string;
}

/** Persisted get-or-create via the resolve_player_identity RPC. */
async function resolvePersisted(
  client: RpcClient,
  casinoId: string,
  casinoRef: string,
  refHash: string,
  hexWidth: number,
): Promise<string> {
  for (let probe = 0; probe <= MAX_COLLISION_PROBES; probe++) {
    const candidateId = safeBetIdFromHash(
      probe === 0 ? refHash : await hashCasinoRef(casinoId, casinoRef, probe),
      hexWidth,
    );

    const { data, error } = await client.rpc('resolve_player_identity', {
      p_casino_id: casinoId,
      p_ref_hash: refHash,
      p_safebet_id: candidateId,
    });

    if (error) throw new Error(`identity resolution failed: ${error.message}`);

    const row = (Array.isArray(data) ? data[0] : data) as ResolveRow | null;
    if (row?.out_status === 'collision') continue; // candidate ID owned by another hash
    if (row?.out_safebet_player_id) return row.out_safebet_player_id;

    throw new Error('identity resolution returned no identifier');
  }

  throw new Error('identity resolution exhausted collision probes');
}

export class SHA256IdentityProvider implements IdentityProvider {
  readonly name: string;
  private readonly hexWidth: number;

  /** Defaults to the production standard (sha256-v2, 96-bit). */
  constructor(opts: { name?: string; hexWidth?: number } = {}) {
    this.name = opts.name ?? 'sha256-v2';
    this.hexWidth = opts.hexWidth ?? SHA256_V2_HEX_WIDTH;
  }

  async resolveIdentity(casinoRef: string, ctx: IdentityContext): Promise<string> {
    // The mapping is keyed by the probe-0 hash; probes only vary the candidate
    // ID in the (astronomically rare) event of an ID-width collision.
    const refHash = await hashCasinoRef(ctx.casinoId, casinoRef);
    if (ctx.client) {
      return resolvePersisted(ctx.client, ctx.casinoId, casinoRef, refHash, this.hexWidth);
    }
    // Pure derivation: deterministic, side-effect free, refresh-stable.
    return safeBetIdFromHash(refHash, this.hexWidth);
  }

  createIdentity(casinoRef: string, ctx: IdentityContext): Promise<string> {
    // Deterministic get-or-create — creation IS resolution for this provider.
    return this.resolveIdentity(casinoRef, ctx);
  }

  async getExistingIdentity(casinoRef: string, ctx: IdentityContext): Promise<string | null> {
    // Deterministic provider: the identity is knowable without durable writes.
    return safeBetIdFromHash(await hashCasinoRef(ctx.casinoId, casinoRef), this.hexWidth);
  }

  validateIdentity(candidate: string): boolean {
    return isSafeBetId(candidate);
  }

  async resolveBatch(casinoRefs: string[], ctx: IdentityContext): Promise<string[]> {
    const out: string[] = [];
    for (const ref of casinoRefs) {
      out.push(await this.resolveIdentity(ref, ctx));
    }
    return out;
  }

  supportsJurisdiction(_jurisdiction: string): boolean {
    return true; // jurisdiction-neutral anonymous scheme
  }

  supportsCasino(_casinoId: string): boolean {
    return true; // tenant-neutral
  }
}
