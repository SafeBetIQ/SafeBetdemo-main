// ─── SafeBet IQ — Responsible Profitability B4.1: Operator-Local Protection Alerts ──
//
// Pure, deterministic domain layer. Defines the governed v1 alert taxonomy (TWO rules
// only), the eligibility predicates, candidate construction, request-body guards, the
// role→scope mapping (reusing the EXISTING resolveRpScope + principalMayAccessCasino),
// and safeguards. NO I/O lives here.
//
// An alert is a GOVERNED OPERATIONAL SIGNAL REQUIRING HUMAN REVIEW — never a diagnosis,
// proof of harm, causal/effectiveness claim, exclusion instruction, enforcement action,
// marketing trigger, or cross-operator signal. Cross-operator federation remains OFF.
//
// The database (migration 20261001120000_b4_1_player_protection_alerts) is the AUTHORITY:
// it independently re-proves eligibility on INSERT, generates the immutable evidence from
// the authoritative source row, owns all lifecycle timestamps, and emits the audit chain.
// This module mirrors the same deterministic rules for candidate selection and is unit-tested.

export const ALERT_RULE_VERSION = 'v1.0.0';

export type AlertType = 'SELF_EXCLUSION_BREACH_REVIEW' | 'INTERVENTION_FOLLOW_UP_OVERDUE';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface AlertRuleDefinition {
  type: AlertType;
  version: string;
  label: string;        // operator-facing label (must pass assertNoProhibitedAlertFraming)
  description: string;  // governed description (may carry explicit non-diagnostic disclaimers)
  sourceTable: 'self_exclusions' | 'player_protection_interventions';
  identityColumn: 'self_exclusion_id' | 'intervention_id';
}

export const ALERT_RULES: Record<AlertType, AlertRuleDefinition> = {
  SELF_EXCLUSION_BREACH_REVIEW: {
    type: 'SELF_EXCLUSION_BREACH_REVIEW',
    version: ALERT_RULE_VERSION,
    label: 'Self-exclusion breach — review',
    description:
      'A self-exclusion record for an own-casino player is marked breached and requires human review. '
      + 'This is an operational signal only — it is not a diagnosis, not proof of harm, and not an enforcement instruction.',
    sourceTable: 'self_exclusions',
    identityColumn: 'self_exclusion_id',
  },
  INTERVENTION_FOLLOW_UP_OVERDUE: {
    type: 'INTERVENTION_FOLLOW_UP_OVERDUE',
    version: ALERT_RULE_VERSION,
    label: 'Intervention follow-up overdue',
    description:
      'A recorded responsible-gambling intervention has a required follow-up whose date has passed '
      + '(South African business date) and requires human review. It does not state whether the intervention worked.',
    sourceTable: 'player_protection_interventions',
    identityColumn: 'intervention_id',
  },
};

export const ALERT_TYPES: AlertType[] = ['SELF_EXCLUSION_BREACH_REVIEW', 'INTERVENTION_FOLLOW_UP_OVERDUE'];

// Explicitly excluded / unavailable in v1 — honest, never silently substituted.
export const EXCLUDED_ALERT_RULES: { type: string; reason: string }[] = [
  { type: 'SELF_EXCLUSION_EXPIRY_REVIEW', reason: 'No governed self-exclusion expiry review-window threshold exists; not invented.' },
  { type: 'INTERVENTION_COMPLETENESS_REVIEW', reason: 'delivered_at/acknowledged_at/risk_score_after are not defensibly defined in the governed schema; excluded to avoid treating missing data as failure.' },
  { type: 'CURRENT_HIGHER_RISK_REVIEW', reason: 'No governed historical risk-transition store exists; a persisted current-risk alert could not honestly model recurrence.' },
];
export const EXCLUDED_ALERT_TYPES = EXCLUDED_ALERT_RULES.map((r) => r.type);

// ── SAST business date (Africa/Johannesburg) — identical boundary to the DB trigger ──
export function sastBusinessDate(now: Date = new Date()): string {
  // 'en-CA' yields YYYY-MM-DD; timeZone pins the South African business calendar.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

// ── Source row shapes + eligibility predicates (mirror the DB trigger exactly) ──
export interface SelfExclusionSourceRow {
  id: string; casino_id: string; player_id: string | null; status: string | null; breach_count: number | null;
}
export interface InterventionSourceRow {
  id: string; casino_id: string; player_id: string | null; follow_up_required: boolean | null; follow_up_date: string | null;
}

/** Rule A: own-casino self-exclusion marked 'breached' with a governed (non-null) player reference. */
export function isSelfExclusionBreachEligible(row: SelfExclusionSourceRow, scopeCasino: string): boolean {
  return row.casino_id === scopeCasino && row.player_id != null && row.status === 'breached';
}

/** Rule C: required follow-up whose date is STRICTLY before the SAST business date (overdue). */
export function isInterventionFollowUpOverdue(row: InterventionSourceRow, scopeCasino: string, sastToday: string): boolean {
  return row.casino_id === scopeCasino
    && row.player_id != null
    && row.follow_up_required === true
    && typeof row.follow_up_date === 'string' && row.follow_up_date.length > 0
    && row.follow_up_date < sastToday;   // ISO 'YYYY-MM-DD' lexical compare == chronological; strict '<' = overdue
}

// ── Candidate construction (INSERT payload). Deliberately carries NO evidence, NO
//    timestamps, NO status, NO fingerprint: the DB sets them. generated_by is the
//    VERIFIED principal id, never a request-body value. ──
export interface AlertCandidate {
  casino_id: string;
  player_id: string;
  alert_type: AlertType;
  rule_version: string;
  self_exclusion_id?: string;
  intervention_id?: string;
  generated_by: string;
}

export function buildBreachCandidate(row: SelfExclusionSourceRow, scopeCasino: string, generatedBy: string): AlertCandidate {
  if (!isSelfExclusionBreachEligible(row, scopeCasino)) throw new Error('self-exclusion is not breach-eligible');
  return {
    casino_id: scopeCasino, player_id: row.player_id as string,
    alert_type: 'SELF_EXCLUSION_BREACH_REVIEW', rule_version: ALERT_RULE_VERSION,
    self_exclusion_id: row.id, generated_by: generatedBy,
  };
}

export function buildFollowUpCandidate(row: InterventionSourceRow, scopeCasino: string, sastToday: string, generatedBy: string): AlertCandidate {
  if (!isInterventionFollowUpOverdue(row, scopeCasino, sastToday)) throw new Error('intervention follow-up is not overdue');
  return {
    casino_id: scopeCasino, player_id: row.player_id as string,
    alert_type: 'INTERVENTION_FOLLOW_UP_OVERDUE', rule_version: ALERT_RULE_VERSION,
    intervention_id: row.id, generated_by: generatedBy,
  };
}

// ── Request-body guards: these are server/DB-derived and must NEVER be caller-supplied ──
export const FORBIDDEN_ALERT_BODY_FIELDS: readonly string[] = [
  'id', 'generated_at', 'created_at', 'updated_at', 'acknowledged_at', 'resolved_at',
  'generated_by', 'acknowledged_by', 'resolved_by', 'evidence', 'rule_version',
  'self_exclusion_id', 'intervention_id', 'self_exclusion_status', 'breach_count',
  'follow_up_date', 'status', 'source_fingerprint', 'fingerprint', 'player_id', 'alert_type',
];

/** Returns the offending key if the body carries any forbidden field, else null. */
export function bodyHasForbiddenField(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const k of Object.keys(body as Record<string, unknown>)) {
    if (FORBIDDEN_ALERT_BODY_FIELDS.includes(k)) return k;
  }
  return null;
}

// ── Role / scope mapping — REUSES the existing resolveRpScope + principalMayAccessCasino ──
export const ALERT_OPERATOR_ROLES: readonly string[] = ['casino_admin', 'compliance_officer', 'super_admin'];

export function isAlertOperatorRole(role: string | null | undefined): boolean {
  return !!role && ALERT_OPERATOR_ROLES.includes(role);
}

/** Map an allowed operator role to the EXISTING resolveRpScope profile (no new resolver invented). */
export function alertScopeProfile(role: string | null | undefined): 'casino-operator' | 'administrator' | null {
  if (role === 'super_admin') return 'administrator';
  if (role === 'casino_admin' || role === 'compliance_officer') return 'casino-operator';
  return null;
}

// ── Governed GET projection + evaluate summary ──
export interface ProtectionAlertView {
  id: string;
  alert_type: AlertType;
  rule_version: string;
  status: AlertStatus;
  player_id: string;
  evidence: Record<string, unknown>;
  generated_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  updated_at: string;
}

export interface EvaluateSummary {
  casinoId: string;
  evaluated: number;
  created: number;
  alreadyPresent: number;
  rulesRun: AlertType[];
  rulesExcluded: string[];
}

export function emptyEvaluateSummary(casinoId: string): EvaluateSummary {
  return {
    casinoId, evaluated: 0, created: 0, alreadyPresent: 0,
    rulesRun: [...ALERT_TYPES], rulesExcluded: [...EXCLUDED_ALERT_TYPES],
  };
}

// ── Safeguard: operator-facing labels/evidence text must never diagnose, predict, or
//    claim causality/effectiveness/trajectory. (Applied to LABELS and UI evidence text —
//    NOT to governed descriptions, which deliberately carry negated disclaimers.) ──
export function assertNoProhibitedAlertFraming(texts: string[]): void {
  const banned = /\b(addict|problem gambler|diagnos|probabilit|likely to|propensit|causal|caused by|effectiveness|risk (increased|worsen|trajector)|predict)/i;
  for (const t of texts) {
    if (banned.test(t)) throw new Error(`B4.1 safeguard violation: prohibited framing in "${t}"`);
  }
}
