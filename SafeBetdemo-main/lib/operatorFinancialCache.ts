// ─── Regulator operator-financial switching cache + stale-guard (PERF-REG-1) ──
// Pure, framework-free logic behind fast, correct operator switching on the
// regulator reports page. Two concerns, both testable without React:
//
//   1) A short-lived, per-operator cache of the CERTIFIED posture (the whole
//      FinancialPostureView — never per-period cards), keyed strictly by casino
//      id so one operator's data can never surface under another. TTL is
//      conservative (matches the certified snapshot cadence); a stale entry is
//      ignored so the UI refetches.
//   2) A monotonic request generation guard: each operator switch bumps a
//      counter; a response only applies if it belongs to the CURRENT generation.
//      A late A-response after switching to B is dropped — B's values can never
//      be overwritten by A. Correctness beats apparent speed.
//
// Only successfully-authorised server results are cached; a 403/401/404/failed
// fetch is never cached and never becomes a false value.

// Default TTL: 30s. The certified financial posture is a periodically-refreshed
// snapshot; 30s keeps revisits instant without presenting materially stale data.
export const OPERATOR_FINANCIAL_TTL_MS = 30_000;

export interface CachedPosture<T> {
  casinoId: string;
  operator: unknown;
  posture: T | null;   // certified FinancialPostureView | null (null = certified-unavailable)
  fetchedAt: number;
}

export class OperatorFinancialCache<T = unknown> {
  private readonly store = new Map<string, CachedPosture<T>>();
  private readonly ttlMs: number;
  constructor(ttlMs: number = OPERATOR_FINANCIAL_TTL_MS) { this.ttlMs = ttlMs; }

  /** Fresh cached entry for this exact operator, or null (miss / expired). */
  getFresh(casinoId: string, now: number): CachedPosture<T> | null {
    if (!casinoId) return null;
    const hit = this.store.get(casinoId);
    if (!hit) return null;
    if (now - hit.fetchedAt > this.ttlMs) return null;   // expired → miss (refetch)
    return hit;
  }

  /** Cache a SUCCESSFULLY-authorised result. Isolated strictly by casinoId. */
  put(entry: CachedPosture<T>): void {
    if (!entry.casinoId) return;
    this.store.set(entry.casinoId, entry);
  }

  has(casinoId: string, now: number): boolean {
    return this.getFresh(casinoId, now) !== null;
  }

  clear(): void { this.store.clear(); }
}

/**
 * Monotonic request-generation guard. `next()` starts a new switch and returns
 * its generation; a response is only applied when `isCurrent(gen)` still holds.
 */
export class RequestGuard {
  private gen = 0;
  next(): number { return ++this.gen; }
  isCurrent(gen: number): boolean { return gen === this.gen; }
  get current(): number { return this.gen; }
}
