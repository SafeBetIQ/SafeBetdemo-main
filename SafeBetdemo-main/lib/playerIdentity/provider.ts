// ─── Identity Provider — enterprise abstraction (Phase 3.1A) ─────────────────
//
// Dependency Inversion boundary for SafeBet IQ player identity.
//
// The application never knows HOW a SafeBet IQ Player ID is produced — only
// how to request one. Concrete strategies (SHA-256 today; national, regulator,
// casino-native, external or federation providers tomorrow) implement this
// interface and are selected by IdentityResolutionService via configuration.
//
// Nothing in this file may reference a hashing algorithm, a key format
// beyond the public SB-PLR contract, or any provider-specific detail.

/**
 * Minimal persistence client contract (structurally satisfied by
 * @supabase/supabase-js in the browser, Node, and Deno edge functions).
 * When present in the context, resolution is persisted in the identity map;
 * when absent, providers that support pure derivation resolve offline.
 */
export interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Ambient context for a resolution request. */
export interface IdentityContext {
  /** Tenant casino the reference belongs to. Required. */
  casinoId: string;
  /** Optional regulatory jurisdiction (e.g. 'ZA', 'MT', 'UKGC'). */
  jurisdiction?: string;
  /**
   * Optional persistence client. With it, the mapping is durably recorded
   * (authoritative); without it, providers may resolve by pure derivation.
   */
  client?: RpcClient;
}

/**
 * A pluggable identity strategy. Implementations own the entire mechanism —
 * derivation, persistence handshake, collision handling — and expose none of it.
 */
export interface IdentityProvider {
  /** Stable registry key, e.g. 'sha256-v1'. */
  readonly name: string;

  /**
   * Resolve a casino player reference to its SafeBet IQ Player ID,
   * creating the persisted mapping on first sight when a client is present.
   * MUST be deterministic per (casinoId, ref) for a given provider.
   */
  resolveIdentity(casinoRef: string, ctx: IdentityContext): Promise<string>;

  /** Explicitly create (register) an identity mapping. Idempotent. */
  createIdentity(casinoRef: string, ctx: IdentityContext): Promise<string>;

  /**
   * Return the identity for a reference if this provider can determine it
   * without creating durable state; null when unknowable offline.
   */
  getExistingIdentity(casinoRef: string, ctx: IdentityContext): Promise<string | null>;

  /** True if the value is a well-formed identifier under this provider. */
  validateIdentity(candidate: string): boolean;

  /** Resolve many references; result order matches input order. */
  resolveBatch(casinoRefs: string[], ctx: IdentityContext): Promise<string[]>;

  /** Capability probes used by the service's selection logic. */
  supportsJurisdiction(jurisdiction: string): boolean;
  supportsCasino(casinoId: string): boolean;
}
