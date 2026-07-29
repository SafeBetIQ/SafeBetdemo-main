// ─── SafeBet IQ Player ID — public format contract ───────────────────────────
//
// Implementation-agnostic: this module defines what a SafeBet IQ Player ID
// LOOKS like and how to display one. It knows nothing about how identities
// are produced — that lives behind the IdentityProvider interface
// (see provider.ts / providers/), reached only via IdentityResolutionService.
//
// Dependency-free and isomorphic (browser / Deno / Node ≥ 18).

export const SAFEBET_ID_PREFIX = 'SB-PLR-';
// Canonical SafeBet IQ Player ID. Two coexisting widths (Phase 4.2 / ADR-001):
//   • 24 hex (96-bit) — the production standard (sha256-v2), collision-safe
//     to >10^10 identities.
//   • 8 hex (32-bit)  — legacy (sha256-v1); still valid so historical events
//     replay and any pre-migration id continues to render. Backward-compatible
//     by construction: a v1 id is the exact prefix of its v2 id (same hash).
export const SAFEBET_ID_PATTERN = /^SB-PLR-[0-9A-F]{8}(?:[0-9A-F]{16})?$/;
export const SAFEBET_ID_HEX_WIDTH = 24; // production standard (96-bit)

/** True if the value is a canonical SafeBet IQ Player ID (v1 or v2 width). */
export function isSafeBetId(value: string | null | undefined): boolean {
  return typeof value === 'string' && SAFEBET_ID_PATTERN.test(value);
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Format any player identifier for display. Canonical IDs pass through;
 * legacy identifiers (UUIDs, host keys) are rendered as an SB-PLR-style
 * label from their last segment so no raw identifier ever reaches the UI.
 */
export function formatPlayerId(playerId: string | null | undefined): string {
  if (!playerId) return '—';
  if (isSafeBetId(playerId)) return playerId;
  // Legacy fallback labelling only (non-canonical inputs): 8 chars keep the
  // label short and readable. Canonical v1/v2 ids already returned above.
  const parts = String(playerId).split('-');
  const tail = parts[parts.length - 1].toUpperCase().slice(0, 8);
  return `${SAFEBET_ID_PREFIX}${tail || 'UNKNOWN'}`;
}

/** Two-character avatar glyph derived from an anonymous player ID. */
export function playerAvatarChars(playerId: string | null | undefined): string {
  if (!playerId) return 'SB';
  const id = String(playerId).replace(SAFEBET_ID_PREFIX, '').replace(/[^A-Za-z0-9]/g, '');
  return id.slice(0, 2).toUpperCase() || 'SB';
}
