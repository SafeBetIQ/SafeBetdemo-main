// ─── Enterprise Policy Store — configuration loader (Phase 4.4) ──────────────
//
// Loads the ACTIVE policy configuration from the versioned policy repository
// and hands it to the platform's existing configure() seam. This module is
// CONFIGURATION plumbing only — it holds NO evaluation logic (that stays in
// evaluation.ts). Constitution 4 intact: policies remain data; the platform
// remains the one decision layer.
//
// The shipped packs (config/index.ts) are the SEED source of truth; once the
// store holds version 1, the store is authoritative and rollback/versioning
// happen there. If the store is empty or unreachable, the platform keeps its
// last configuration (or the shipped defaults) — availability over freshness.

import { validateRule, type PolicyRule } from './model.ts';

/** Minimal RPC surface (satisfied by supabase-js). */
export interface PolicyStoreClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Read the active policy set's rule definitions from the store and validate
 * them (reject-not-repair). Returns null when the store has no active set,
 * so callers can fall back to their current configuration.
 */
export async function loadActivePolicyRules(client: PolicyStoreClient): Promise<PolicyRule[] | null> {
  const { data, error } = await client.rpc('sbiq_active_policy_rules');
  if (error) throw new Error(`policy store load failed: ${error.message}`);
  const rows = (data ?? []) as unknown[];
  if (rows.length === 0) return null;
  return rows.map(validateRule);
}

/** Rows to persist when seeding a policy version (definition + indexed cols). */
export function toStoredRows(policySetVersion: number, rules: PolicyRule[]): Record<string, unknown>[] {
  return rules.map(r => ({
    policy_set_version: policySetVersion,
    policy_id: r.policyId,
    scope: r.scope,
    jurisdiction: r.jurisdiction ?? null,
    casino_id: r.casinoId ?? null,
    applies_to: r.appliesTo,
    action: r.action,
    priority: r.priority,
    enabled: r.enabled !== false,
    definition: r,
  }));
}
