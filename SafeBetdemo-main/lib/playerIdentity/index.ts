// SafeBet IQ Identity Resolution — public API (Phase 3.1A).
//
// Consumers import ONLY from here ('@/lib/playerIdentity' in the app,
// '../../../lib/playerIdentity/index.ts' in edge functions):
//
//   • getIdentityService() — obtain identities. How they are produced is a
//     provider concern; no consumer may import providers/ directly.
//   • formatPlayerId / playerAvatarChars / isSafeBetId — display & format
//     helpers for the public SB-PLR contract.
//
// The concrete SHA-256 mechanism is deliberately NOT exported.

export {
  SAFEBET_ID_PREFIX,
  SAFEBET_ID_PATTERN,
  isSafeBetId,
  formatPlayerId,
  playerAvatarChars,
} from './core.ts';

export type { IdentityProvider, IdentityContext, RpcClient } from './provider.ts';
export type { IdentityConfig } from './config.ts';
export type { IdentityPolicyRules, IdentityPolicyDecision } from './policy.ts';
export { IdentityResolutionService, getIdentityService } from './service.ts';
