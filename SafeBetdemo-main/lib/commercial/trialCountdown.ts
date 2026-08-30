// ─── Trial / licence countdown formatting (UAT-OP-5 P2-1) ────────────────────
// The onboarding page rendered `{daysToExpiry} days remaining` directly, so an
// expired licence (daysToExpiry < 0) displayed "-15 days remaining". The value is
// correct (negative = past expiry); only the presentation was wrong. This helper
// renders honest, non-negative wording.

export function formatDaysRemaining(days: number | null | undefined): string {
  if (days == null || Number.isNaN(days)) return 'Expiry unknown';
  if (days < 0) return 'Trial expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

/** Tone for the countdown: red once expired/expiring today, amber within a week. */
export function daysRemainingTone(days: number | null | undefined): 'expired' | 'warn' | 'ok' {
  if (days == null) return 'ok';
  if (days <= 0) return 'expired';
  if (days <= 7) return 'warn';
  return 'ok';
}
