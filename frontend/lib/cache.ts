interface CacheEntry<T> { value: T; expires: number }

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { store.delete(key); return null; }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = 45_000): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}
