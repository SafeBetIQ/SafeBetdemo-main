const SANDBOX = process.env.SANDBOX_MODE === 'true';

const MOCK: Record<string, unknown> = {
  '/api/check-player': {
    success: true,
    player: {
      id: 'sandbox-player-001',
      casino_id: 'sandbox-casino-001',
      player_token: 'tok_sandbox_001',
      first_name: 'Sandbox',
      last_name: 'Player',
      email: 'sandbox@safebetiq.com',
      current_risk_score: 23,
      current_risk_level: 'LOW',
      is_active: true,
      last_activity: new Date().toISOString(),
      registration_date: '2024-01-01T00:00:00.000Z',
    },
  },
  '/api/verify-player': {
    success: true,
    player_id: 'sandbox-player-001',
    verified: true,
    underage_risk: 0,
    flags: [],
  },
  '/api/check-exclusion': {
    success: true,
    excluded: false,
    exclusion: null,
  },
  '/api/get-decision': {
    success: true,
    player_id: 'sandbox-player-001',
    decision: 'ALLOW',
    reason: 'No risk indicators detected (sandbox)',
    action_required: 'NONE',
    risk_score: 23,
    underage_risk: 0,
    excluded: false,
  },
};

/**
 * Returns a mock response object when SANDBOX_MODE=true, otherwise null.
 * Routes should check this before any DB access.
 */
export function getSandboxResponse(endpoint: string): unknown | null {
  if (!SANDBOX) return null;
  return MOCK[endpoint] ?? { success: true, sandbox: true };
}
