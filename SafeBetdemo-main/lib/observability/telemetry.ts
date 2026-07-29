// ─── Enterprise Observability — structured telemetry (Phase 4.3) ─────────────
//
// Cross-cutting observability infrastructure (NOT an enterprise platform).
// Every platform layer emits ONE-line structured JSON events and increments
// in-process counters, so production issues are diagnosable without a
// debugger and without exposing sensitive information.
//
// PRIVACY (Constitution §8, Evidence Integrity): telemetry carries only
// anonymous ids, counts and timings — never PII, never raw casino
// references, never payloads. A guard strips any accidental player id.
//
// Distribution-agnostic: emits to console.* as newline-delimited JSON, which
// every host (Deno edge, Node, browser) forwards to its log sink. Metrics are
// exposed via snapshot() for health endpoints.

export type Severity = 'debug' | 'info' | 'warn' | 'error';

export interface TelemetryEvent {
  ts: string;
  level: Severity;
  /** dotted component path, e.g. 'eventPlatform.ingest'. */
  component: string;
  event: string;
  /** Anonymous dimensions only (casinoId, counts, durations). */
  fields: Record<string, unknown>;
}

// Keys that must never appear in telemetry (defense-in-depth PII guard).
const FORBIDDEN_KEYS = /(^|_)(ref|reference|email|phone|name|password|payload|raw)($|_)/i;

function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.test(k)) { out[k] = '[redacted]'; continue; }
    // Never emit a raw casino player reference; anonymous SB-PLR ids are fine.
    if (typeof v === 'string' && /^demo-patron-/.test(v)) { out[k] = '[redacted]'; continue; }
    out[k] = v;
  }
  return out;
}

// ─── In-process counters (exposed for health snapshots) ──────────────────────

const counters = new Map<string, number>();

export function increment(metric: string, by = 1): void {
  counters.set(metric, (counters.get(metric) ?? 0) + by);
}

export function counterSnapshot(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function resetCounters(): void {
  counters.clear();
}

// ─── Structured emit ─────────────────────────────────────────────────────────

let sink: (e: TelemetryEvent) => void = (e) => {
  // One line of JSON per event — parseable by any log aggregator.
  const line = JSON.stringify(e);
  if (e.level === 'error') console.error(line);
  else if (e.level === 'warn') console.warn(line);
  else console.log(line);
};

/** Redirect telemetry (tests, custom shippers). */
export function setTelemetrySink(fn: (e: TelemetryEvent) => void): void {
  sink = fn;
}

export function emit(level: Severity, component: string, event: string, fields: Record<string, unknown> = {}): void {
  sink({ ts: new Date().toISOString(), level, component, event, fields: sanitize(fields) });
}

// ─── Timing helper ───────────────────────────────────────────────────────────

/** Measure an async operation, emitting duration_ms and a metric counter. */
export async function timed<T>(
  component: string, event: string, metric: string, fn: () => Promise<T>,
  fields: Record<string, unknown> = {},
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    increment(`${metric}.ok`);
    emit('info', component, event, { ...fields, duration_ms: Date.now() - start, outcome: 'ok' });
    return result;
  } catch (err) {
    increment(`${metric}.error`);
    emit('error', component, event, {
      ...fields, duration_ms: Date.now() - start, outcome: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
