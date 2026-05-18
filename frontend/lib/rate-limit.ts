import { NextRequest } from 'next/server';

interface Entry { count: number; reset: number }

const store      = new Map<string, Entry>();
const burstStore = new Map<string, Entry>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, val] of store)      if (now > val.reset) store.delete(key);
  for (const [key, val] of burstStore) if (now > val.reset) burstStore.delete(key);
}

/** Returns true if the request is allowed, false if rate limited. */
export function rateLimit(key: string, limit = 100, windowMs = 60_000): boolean {
  if (store.size > 10_000 || burstStore.size > 10_000) pruneExpired();

  const now = Date.now();

  // Burst protection: block if >20 requests within 1 second
  const burst = burstStore.get(key);
  if (!burst || now > burst.reset) {
    burstStore.set(key, { count: 1, reset: now + 1_000 });
  } else if (burst.count >= 20) {
    return false;
  } else {
    burst.count++;
  }

  // Per-minute limit
  const entry = store.get(key);
  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/** Resolved IP address for logging/tagging (never used as rate-limit key directly). */
export function getIp(req: NextRequest): string {
  const raw =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    '';
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : crypto.randomUUID();
}

/**
 * Rate-limit key: uses `x-api-key` header when present (prefixed to avoid
 * collision with IP-derived keys), otherwise falls back to the resolved IP.
 */
export function getRateLimitKey(req: NextRequest): string {
  const apiKey = req.headers.get('x-api-key')?.trim();
  if (apiKey && apiKey.length > 0) return `apikey:${apiKey}`;
  return getIp(req);
}
