// Pure, testable decision logic shared by the Demo Simulation Health optimisation
// (component load path, lock-free token read, API cache). Keeping these pure keeps
// the fast-load behaviour unit-testable in the node --test harness.

// Minimal storage shape (window.localStorage compatible) so this is testable.
export interface KeyValueStore {
  length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
}

/** Read the persisted Supabase access token synchronously from storage — WITHOUT
 *  supabase.auth.getSession() (which acquires the auth-token navigator lock and can
 *  block for seconds on first load). The server still fully re-validates the token. */
export function readTokenFromStore(store: KeyValueStore | undefined | null): string | null {
  if (!store) return null;
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.includes('-auth-token')) {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const tok = parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
        if (tok) return tok as string;
      }
    }
  } catch { /* fall through */ }
  return null;
}

/** Staged loading message. `verifying` = waiting on AuthContext; otherwise the
 *  message escalates with elapsed seconds on the first (blocking) load. */
export function slowMessage(phase: 'verifying' | 'loading', slowSeconds: number): string {
  if (phase === 'verifying') return 'Verifying Super Admin access…';
  if (slowSeconds >= 10) return 'This is taking longer than expected…';
  if (slowSeconds >= 5) return 'Loading casino activity…';
  return 'Loading simulator health…';
}

/** Retry option appears only after the 15s stage. */
export function showRetryAt(slowSeconds: number): boolean {
  return slowSeconds >= 15;
}

/** Poll a refresh only when the tab is visible AND the first load has completed
 *  (so polling never races or duplicates the initial request). */
export function shouldPoll(hidden: boolean, firstLoadDone: boolean): boolean {
  return !hidden && firstLoadDone;
}

/** Short private server cache: serve cached only when not explicitly bypassed and
 *  within TTL. Auth is validated separately, every request, before this is used. */
export function cacheHit(cachedAt: number | null, now: number, ttlMs: number, bypass: boolean): boolean {
  return !bypass && cachedAt !== null && now - cachedAt < ttlMs;
}
