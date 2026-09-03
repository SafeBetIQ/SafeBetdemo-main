// ─── ARCH-V3-A1 — Shared certified-financial FRESHNESS contract ──────────────
// One freshness vocabulary for every certified-financial surface, so no page
// re-invents its own staleness logic (architecture v3 §12.4 / §19.3). It derives
// exactly ONE state from: the certified posture, the SOURCE as-of age (the newest
// underlying certified event time — never now()/render/request time), and the UI
// loading flag. The cardinal rules it enforces:
//
//   • LOADING is never zero and never "certified".
//   • A missing / failed / stale certified source is never shown as "R0 certified".
//   • A genuine, fresh certified zero is still allowed (renders "R 0").
//
// This module derives state and presentation ONLY. It performs no financial
// arithmetic — GGR = stakes − winnings stays in the certified pipeline unchanged.

import type { FinancialPostureView } from './consumerPlatform/contracts';

export type FinancialFreshnessState =
  | 'LOADING' | 'FRESH' | 'STALE' | 'PARTIAL' | 'UNAVAILABLE';

// The Demo live writer ticks every 5 minutes, so a source snapshot is normally
// ≤5 min old. A 6-minute (360s) threshold means normal operation reads FRESH and
// only a genuinely stalled / re-disabled writer crosses into STALE. Callers may
// override per-surface.
export const DEFAULT_FINANCIAL_STALE_AFTER_SECONDS = 360;

export interface FreshnessInput {
  /** UI is still fetching the first certified snapshot. */
  loading: boolean;
  /** Certified posture, or null when the certified source has no row. */
  posture: FinancialPostureView | null | undefined;
  /** ISO source-as-of: the newest certified event time (NOT now()/query time). */
  sourceAsOf?: string | number | Date | null;
  /** Injectable clock for deterministic tests. */
  nowMs?: number;
  staleAfterSeconds?: number;
}

/**
 * Age, in seconds, of the certified SOURCE (newest event) relative to `nowMs`.
 * Returns null when no usable source timestamp is available (so callers do not
 * fabricate an age of 0). Negative ages (clock skew) clamp to 0.
 */
export function sourceAgeSeconds(
  sourceAsOf: string | number | Date | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (sourceAsOf == null || sourceAsOf === '') return null;
  const t = new Date(sourceAsOf).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 1000));
}

/**
 * Derive the single freshness state. Precedence is deliberate:
 *   LOADING → UNAVAILABLE → STALE → PARTIAL → FRESH
 * so a stalled feed surfaces as STALE even if the certified status still claims
 * a capability level, and an absent source always wins over any stale value.
 */
export function financialFreshnessState(input: FreshnessInput): FinancialFreshnessState {
  const staleAfter = input.staleAfterSeconds ?? DEFAULT_FINANCIAL_STALE_AFTER_SECONDS;

  // 1) Still fetching and nothing to show yet — NOT zero, NOT certified.
  if (input.loading && !input.posture) return 'LOADING';

  // 2) No certified evidence at all (null posture, or explicit unavailable).
  if (!input.posture || input.posture.status === 'unavailable') return 'UNAVAILABLE';

  // 3) Source data is older than the freshness threshold — honest STALE. Only
  //    applied when we actually have a source timestamp to judge.
  const age = sourceAgeSeconds(input.sourceAsOf, input.nowMs);
  if (age != null && age > staleAfter) return 'STALE';

  // 4) Certified source is available but not fully healthy (capability-limited,
  //    delayed or degraded) — PARTIAL, never "certified".
  if (input.posture.status !== 'healthy') return 'PARTIAL';

  // 5) Healthy + recent (or no staleness signal to contradict it).
  return 'FRESH';
}

export interface FreshnessPresentation {
  label: string;
  tone: 'ok' | 'muted' | 'warn' | 'bad';
}

// UI label + tone for a freshness state. "Certified" is reserved for FRESH.
export function freshnessPresentation(state: FinancialFreshnessState): FreshnessPresentation {
  switch (state) {
    case 'LOADING':     return { label: 'Loading…',    tone: 'muted' };
    case 'FRESH':       return { label: 'Certified',   tone: 'ok' };
    case 'PARTIAL':     return { label: 'Partial',     tone: 'warn' };
    case 'STALE':       return { label: 'Stale',       tone: 'warn' };
    case 'UNAVAILABLE': return { label: 'Unavailable', tone: 'bad' };
  }
}

/**
 * True only when the certified value may carry the "certified" word. FRESH and
 * PARTIAL are presentable certified figures (PARTIAL is a real, current certified
 * capability level); LOADING / STALE / UNAVAILABLE must show an honest state
 * instead of a value labelled certified.
 */
export function isCertifiedPresentable(state: FinancialFreshnessState): boolean {
  return state === 'FRESH' || state === 'PARTIAL';
}

// The short qualifier appended to a certified money figure, e.g. "ZAR · certified"
// / "ZAR · partial" / "ZAR · stale". Ensures the word "certified" appears ONLY for
// FRESH — the central "never label stale/missing output certified" guarantee.
export function financialCaption(state: FinancialFreshnessState, currency = 'ZAR'): string {
  return `${currency} · ${freshnessPresentation(state).label.replace('…', '').toLowerCase()}`;
}
