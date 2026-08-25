// ─── Certified financial PRESENTATION contract ───────────────────────────────
// One certified contract → many presentations. Every operator/regulator/report/
// evidence screen formats money, selects a reporting period, and derives status
// through THIS module, so identical certified data (projection_financial_posture
// → FinancialPostureView) always renders identically. The cardinal rule of this
// module: a null certified value is NEVER a false zero.
//
// Runtime source of truth is the Supabase certified posture (projection_financial_
// posture / sbiq_certified_financial_posture_v2), surfaced to the app as
// FinancialPostureView. This module presents that contract — it computes no GGR of
// its own beyond the certified formula mirror in lib/financialRollup.ts.

import type { FinancialPostureView } from '@/lib/consumerPlatform/contracts';

// Rendered when a certified value is unavailable/unsupported (null). Never "R 0".
export const FINANCIAL_UNAVAILABLE = '—';

// Coerce to a finite number, or null. Unlike `Number(v ?? 0) || 0`, this NEVER
// turns an absent/unsupported value into 0 — that distinction is the whole point.
function finiteOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Canonical ZAR formatter: "R 1 234" (0dp) or "R 1 234.56" (2dp), space thousands
// separators, sign preserved. A negative certified GGR is a real house net-loss
// for the period and must be shown as such — never hidden with Math.abs.
export function zar(v: unknown, decimals: 0 | 2 = 0): string {
  const n = finiteOrNull(v);
  if (n === null) return FINANCIAL_UNAVAILABLE;
  const sign = n < 0 ? '-' : '';
  const body = Math.abs(n).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}R ${body}`;
}

// Null-not-zero gate. null/undefined → "—"; a genuine certified 0 → "R 0".
// Use this for every certified money value on screen and in exports.
export function certifiedMoney(v: unknown, decimals: 0 | 2 = 0): string {
  return v === null || v === undefined ? FINANCIAL_UNAVAILABLE : zar(v, decimals);
}

// ─── Reporting periods (South African operational semantics) ─────────────────
// TODAY / MTD follow the SAST (Africa/Johannesburg, UTC+2, no DST) calendar;
// ROLLING_24H is a trailing 24h window; SHIFT uses the certified shift boundary.
// The period values themselves are computed server-side in the certified posture;
// this module only selects and labels them.
export type FinancialPeriod = 'TODAY' | 'SHIFT' | 'ROLLING_24H' | 'MTD';

export const FINANCIAL_PERIODS: { key: FinancialPeriod; label: string; short: string }[] = [
  { key: 'TODAY',       label: 'Today (SAST)',          short: 'Today' },
  { key: 'SHIFT',       label: 'Current shift',         short: 'Shift' },
  { key: 'ROLLING_24H', label: 'Rolling 24 hours',      short: '24h' },
  { key: 'MTD',         label: 'Month to date (SAST)',  short: 'MTD' },
];

export function ggrForPeriod(fp: FinancialPostureView | null, period: FinancialPeriod): number | null {
  if (!fp) return null;
  switch (period) {
    case 'TODAY':       return fp.ggrToday;
    case 'SHIFT':       return fp.ggrCurrentShift;
    case 'ROLLING_24H': return fp.ggrLast24Hours;
    case 'MTD':         return fp.ggrMonthToDate;
  }
}

export function stakesForPeriod(fp: FinancialPostureView | null, period: FinancialPeriod): number | null {
  if (!fp) return null;
  switch (period) {
    case 'TODAY':       return fp.stakesToday;
    case 'SHIFT':       return fp.stakesCurrentShift;
    case 'ROLLING_24H': return fp.stakesLast24Hours;
    case 'MTD':         return fp.stakesMonthToDate;
  }
}

export function winningsForPeriod(fp: FinancialPostureView | null, period: FinancialPeriod): number | null {
  if (!fp) return null;
  switch (period) {
    case 'TODAY':       return fp.playerWinningsToday;
    case 'SHIFT':       return fp.playerWinningsCurrentShift;
    case 'ROLLING_24H': return fp.playerWinningsLast24Hours;
    case 'MTD':         return fp.playerWinningsMonthToDate;
  }
}

// ─── Controlled status vocabulary ────────────────────────────────────────────
// Only ever derived from the certified status field — never asserted just because
// a number rendered. CERTIFIED is reserved for a fully healthy certified posture.
export type FinancialStatusLabel =
  | 'CERTIFIED' | 'RECONCILED' | 'PARTIAL' | 'DELAYED' | 'DEGRADED' | 'UNAVAILABLE';

export function financialStatusLabel(fp: FinancialPostureView | null): FinancialStatusLabel {
  if (!fp) return 'UNAVAILABLE';
  switch (fp.status) {
    case 'healthy':     return 'CERTIFIED';
    case 'delayed':     return 'DELAYED';
    case 'partial':     return 'PARTIAL';
    case 'degraded':    return 'DEGRADED';
    case 'unavailable': return 'UNAVAILABLE';
    default:            return 'PARTIAL';
  }
}

// Badge tone for the status label, mapped to the app's existing badge variants.
export function financialStatusTone(label: FinancialStatusLabel): 'secondary' | 'default' | 'destructive' {
  if (label === 'CERTIFIED' || label === 'RECONCILED') return 'secondary';
  if (label === 'UNAVAILABLE' || label === 'DEGRADED') return 'destructive';
  return 'default'; // PARTIAL / DELAYED
}

// Currency / timezone display, defaulting to the certified ZAR·SAST contract.
export function financialCurrency(fp: FinancialPostureView | null): string {
  return String(fp?.currency ?? 'ZAR');
}
export function financialTimezone(fp: FinancialPostureView | null): string {
  return String(fp?.timezone ?? 'Africa/Johannesburg');
}

// Synthetic-data disclosure line for demo honesty (only when actually synthetic).
export function syntheticDisclosure(fp: FinancialPostureView | null): string | null {
  if (!fp || !fp.containsSyntheticData) return null;
  return `Synthetic demo data (${fp.syntheticEventCount.toLocaleString()} synthetic / ${fp.nonSyntheticEventCount.toLocaleString()} non-synthetic events)`;
}
