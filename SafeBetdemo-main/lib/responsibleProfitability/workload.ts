// ─── SafeBet IQ — B7 Intervention Workload & Follow-Up Assurance (pure domain) ───
//
// Operator-local, own-casino, AGGREGATE-ONLY operational assurance. OCCURRENCE /
// OPERATIONAL only. It reports workload that is required / due / overdue / future and
// recorded activity — it NEVER claims follow-up COMPLETION or intervention EFFECTIVENESS,
// and there is NO SLA. Follow-up completion is not measurable (no governed field).
//
// No I/O here. Source authority:
//   interventions → player_protection_interventions
//   alerts        → player_protection_alerts (B4.1)
//   traceability  → alert_intervention_links (B6)
// Never audit_events (facts already have authoritative source timestamps) and never the
// B2 ALL_RECORDED projection as a period source.

export const WORKLOAD_MAX_RANGE_DAYS = 366;
export const WORKLOAD_TIMEZONE = 'Africa/Johannesburg';   // fixed UTC+2, no DST
export const WORKLOAD_LINK_DENOMINATOR = 'OPEN_ACKNOWLEDGED' as const;

export const OUTCOME_CATEGORIES = ['accepted', 'declined', 'pending', 'successful', 'unsuccessful'] as const;
export type OutcomeCategory = (typeof OUTCOME_CATEGORIES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function realCalendarDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Current SAST (Africa/Johannesburg) business date as YYYY-MM-DD. */
export function sastToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WORKLOAD_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/** The SAST calendar date (YYYY-MM-DD) of a timestamptz ISO instant. */
export function sastDateOf(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return sastToday(new Date(t));
}

/** Whole days between two YYYY-MM-DD SAST dates (later − earlier); null if either missing. */
export function dayDiff(earlier: string | null, later: string | null): number | null {
  if (!earlier || !later) return null;
  const a = Date.parse(`${earlier}T00:00:00+02:00`);
  const b = Date.parse(`${later}T00:00:00+02:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export interface WorkloadPeriod { startDate: string; endDate: string; startIso: string; endIsoExclusive: string }
export interface WorkloadPeriodError { error: string; code: string }
export function isWorkloadPeriodError(p: WorkloadPeriod | WorkloadPeriodError): p is WorkloadPeriodError {
  return (p as WorkloadPeriodError).error !== undefined;
}

/** SAST period: start inclusive, end EXCLUSIVE, max 366 days. Mirrors the governed RG
 *  period rule; NOT financial-period semantics. Caller timezone override is rejected at
 *  the route, never here. */
export function validateWorkloadPeriod(start?: string | null, end?: string | null): WorkloadPeriod | WorkloadPeriodError {
  if (!start || !end) return { error: 'start and end (YYYY-MM-DD) are required', code: 'PERIOD_REQUIRED' };
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return { error: 'start/end must be YYYY-MM-DD', code: 'PERIOD_FORMAT' };
  if (!realCalendarDate(start) || !realCalendarDate(end)) return { error: 'start/end is not a valid calendar date', code: 'PERIOD_INVALID' };
  const startIso = `${start}T00:00:00+02:00`;
  const endIsoExclusive = `${end}T00:00:00+02:00`;
  const sMs = Date.parse(startIso), eMs = Date.parse(endIsoExclusive);
  if (eMs <= sMs) return { error: 'end must be after start (end is exclusive)', code: 'PERIOD_ORDER' };
  if ((eMs - sMs) / 86400000 > WORKLOAD_MAX_RANGE_DAYS) return { error: `range exceeds ${WORKLOAD_MAX_RANGE_DAYS} days`, code: 'PERIOD_TOO_LONG' };
  return { startDate: start, endDate: end, startIso, endIsoExclusive };
}

// ── Follow-up classification (mirrors the B4.1 overdue rule exactly) ──────────────
export type FollowUpClass =
  | 'not_required'               // follow_up_required IS FALSE
  | 'requirement_not_recorded'   // follow_up_required IS NULL (data completeness)
  | 'undated'                    // required, follow_up_date IS NULL
  | 'due_today'                  // required, follow_up_date = today
  | 'overdue'                    // required, follow_up_date < today
  | 'future';                    // required, follow_up_date > today

export function classifyFollowUp(
  row: { follow_up_required: boolean | null; follow_up_date: string | null },
  today: string,
): FollowUpClass {
  if (row.follow_up_required === null || row.follow_up_required === undefined) return 'requirement_not_recorded';
  if (row.follow_up_required === false) return 'not_required';
  if (!row.follow_up_date) return 'undated';
  if (row.follow_up_date < today) return 'overdue';   // ISO YYYY-MM-DD lexical == chronological
  if (row.follow_up_date > today) return 'future';
  return 'due_today';
}

// ── Current intervention workload ────────────────────────────────────────────────
export interface InterventionCurrentCounts {
  followUpRequiredButUndated: number;
  followUpDueToday: number;
  followUpOverdue: number;
  followUpFuture: number;
  maxDaysOverdue: number | null;
}
export interface InterventionCurrentWorkload extends InterventionCurrentCounts {
  followUpRequiredCurrent: number;   // == undated + due + overdue + future (partition invariant)
}
export function buildInterventionCurrent(c: InterventionCurrentCounts): InterventionCurrentWorkload {
  const followUpRequiredCurrent = c.followUpRequiredButUndated + c.followUpDueToday + c.followUpOverdue + c.followUpFuture;
  return {
    followUpRequiredCurrent,
    followUpRequiredButUndated: c.followUpRequiredButUndated,
    followUpDueToday: c.followUpDueToday,
    followUpOverdue: c.followUpOverdue,
    followUpFuture: c.followUpFuture,
    maxDaysOverdue: c.followUpOverdue > 0 ? c.maxDaysOverdue : null,   // null unless there are overdue rows
  };
}

// ── Recorded outcome distribution (period population) ─────────────────────────────
export interface OutcomeDistribution {
  accepted: number; declined: number; pending: number; successful: number; unsuccessful: number; notRecorded: number;
}
export function buildOutcomeDistribution(
  counts: Partial<Record<OutcomeCategory, number>>, notRecorded: number,
): OutcomeDistribution {
  return {
    accepted: counts.accepted ?? 0,
    declined: counts.declined ?? 0,
    pending: counts.pending ?? 0,
    successful: counts.successful ?? 0,
    unsuccessful: counts.unsuccessful ?? 0,
    notRecorded,
  };
}

// ── Semantic metadata (hardened, concise) ─────────────────────────────────────────
export const WORKLOAD_SEMANTICS = {
  timezone: WORKLOAD_TIMEZONE,
  overdueRule: 'Follow-up is overdue only when it is recorded as required, has a recorded follow-up date, and that date is before the current SAST business date.',
  acknowledgedAgeBasis: 'Age of the acknowledged state is measured from acknowledged_at.',
  followUpCompletionAvailable: false as const,
  currentVsPeriodNote: 'Current workload is measured as of generatedAt and is not affected by the selected historical period.',
  outcomeNote: 'Recorded intervention outcome does not indicate intervention effectiveness.',
  slaNote: 'No SafeBet IQ responsible-gambling SLA threshold is configured for these metrics.',
  snapshotNote: 'The summary may be calculated from multiple governed reads; minor cross-query timing differences are possible.',
} as const;

export const WORKLOAD_LINK_NEUTRAL_NOTE =
  'A recorded link is traceability evidence, not a measure of whether an action was correct or effective.';

// ── Prohibited-claim guard (applied to user-facing copy/labels) ───────────────────
export function assertNoProhibitedWorkloadClaims(texts: string[]): void {
  // Affirmative efficacy / completion / SLA claims only. Negated disclaimers (e.g.
  // "does not indicate effectiveness", "completion is not recorded") are intentionally allowed.
  const banned = /\bfollow-?up completed|completion rate|closure rate|completion percentage|success rate|successful intervention|effective intervention|effectiveness rate|harm reduced|risk improved|sla breach|regulatory breach|non-?compliant operator|all follow-?ups are on time|all players safe/i;
  for (const t of texts) {
    if (banned.test(t)) throw new Error(`B7 safeguard violation: prohibited claim in "${t}"`);
  }
}
