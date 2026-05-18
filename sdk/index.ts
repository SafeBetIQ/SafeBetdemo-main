/**
 * SafeBetIQ Decision Engine SDK
 *
 * Usage:
 *   import SafeBetIQ from '@safebet/sdk';
 *   const client = new SafeBetIQ({ baseUrl: 'https://safebetiq.com', apiKey: 'sk_live_...' });
 *   const result = await client.getDecision({ player_id: '...' });
 */

export interface SafeBetIQOptions {
  baseUrl: string;
  apiKey: string;
  /** Milliseconds before a request times out (default: 10000) */
  timeoutMs?: number;
}

export interface PlayerLookup {
  player_id?: string;
  player_token?: string;
}

export interface DecisionInput extends PlayerLookup {
  casino_id?: string;
}

export interface CheckPlayerResponse {
  success: boolean;
  player: {
    id: string;
    casino_id: string;
    player_token: string;
    first_name: string;
    last_name: string;
    email?: string;
    current_risk_score: number;
    current_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    is_active: boolean;
    last_activity: string;
    registration_date: string;
  };
}

export interface VerifyPlayerResponse {
  success: boolean;
  player_id: string;
  verified: boolean;
  underage_risk: number;
  flags: string[];
}

export interface CheckExclusionResponse {
  success: boolean;
  excluded: boolean;
  exclusion: {
    id: string;
    exclusion_type: string;
    duration_type: string;
    starts_at: string;
    ends_at?: string;
    reason?: string;
  } | null;
}

export interface DecisionResponse {
  success: boolean;
  player_id: string;
  decision: 'ALLOW' | 'VERIFY' | 'LIMIT' | 'BLOCK';
  reason: string;
  action_required: 'NONE' | 'REQUIRE_KYC' | 'APPLY_LIMITS' | 'ACCOUNT_SUSPEND';
  risk_score: number;
  underage_risk: number;
  excluded: boolean;
}

export class SafeBetIQError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'SafeBetIQError';
  }
}

class SafeBetIQ {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor({ baseUrl, apiKey, timeoutMs = 10_000 }: SafeBetIQOptions) {
    this.baseUrl   = baseUrl.replace(/\/$/, '');
    this.apiKey    = apiKey;
    this.timeoutMs = timeoutMs;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method:  'POST',
        signal:  controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new SafeBetIQError(
        (data as { error?: string }).error ?? `HTTP ${res.status}`,
        res.status,
        data,
      );
    }

    return data as T;
  }

  /** Fetch player profile by player_id or player_token. */
  checkPlayer(input: PlayerLookup): Promise<CheckPlayerResponse> {
    return this.post('/api/check-player', input);
  }

  /** Verify player identity and underage risk score. */
  verifyPlayer(input: PlayerLookup): Promise<VerifyPlayerResponse> {
    return this.post('/api/verify-player', input);
  }

  /** Check whether a player has an active self-exclusion. */
  checkExclusion(input: PlayerLookup): Promise<CheckExclusionResponse> {
    return this.post('/api/check-exclusion', input);
  }

  /** Run full decision engine — returns ALLOW / VERIFY / LIMIT / BLOCK. */
  getDecision(input: DecisionInput): Promise<DecisionResponse> {
    return this.post('/api/get-decision', input);
  }
}

export default SafeBetIQ;
