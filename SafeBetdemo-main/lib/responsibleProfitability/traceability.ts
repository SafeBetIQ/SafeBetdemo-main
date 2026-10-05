// ─── SafeBet IQ — B6 Protection Action Traceability (pure domain layer) ──────────
//
// Links a B4.1 protection alert to the recorded intervention(s) that represent the
// operator's human response. OCCURRENCE ONLY — a link records that an action was taken,
// NEVER that it worked. No effectiveness / causality / harm-reduction / risk-trajectory
// claim is made or permitted. Cross-operator federation remains OFF.
//
// No I/O here. The database (migration 20261005120000_b6_protection_action_traceability)
// is the integrity AUTHORITY: composite FKs freeze same-casino/same-player for the link's
// life, a partial-unique index enforces one active link per (alert,intervention) pair,
// correction is a single trigger-driven INSERT, and the audit event is emitted in-trigger.

export const TRACEABILITY_CANDIDATE_LIMIT = 100;

// Fields the DB / server / principal own — a caller may NEVER supply them on any B6 body.
export const FORBIDDEN_LINK_BODY_FIELDS: readonly string[] = [
  'id', 'casino_id', 'player_id', 'alert_id', 'linked_by', 'linked_at', 'created_at',
  'superseded_at', 'superseded_by', 'supersedes_link_id', 'link_id',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export type LinkBody = { ok: true; interventionId: string } | { ok: false; code: string; error: string };

/** Parse a B6 request body: the ONLY accepted field is intervention_id (a uuid). */
export function parseLinkBody(body: unknown): LinkBody {
  if (!body || typeof body !== 'object') return { ok: false, code: 'BODY', error: 'request body is required' };
  const rec = body as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (k === 'intervention_id') continue;
    if (FORBIDDEN_LINK_BODY_FIELDS.includes(k)) return { ok: false, code: 'FORBIDDEN_FIELD', error: `field not accepted from caller: ${k}` };
    return { ok: false, code: 'UNEXPECTED_FIELD', error: `unexpected field: ${k}` };
  }
  if (!isUuid(rec.intervention_id)) return { ok: false, code: 'INTERVENTION_ID', error: 'intervention_id must be a uuid' };
  return { ok: true, interventionId: rec.intervention_id };
}

// ── Recorded-outcome wording (occurrence, NOT effectiveness) ──────────────────────
// The source enum includes 'successful'/'unsuccessful' as RECORDED CATEGORIES. They must
// always be shown with explicit "Recorded intervention outcome:" framing and must NEVER be
// rendered as an effectiveness verdict.
export const RECORDED_OUTCOME_PREFIX = 'Recorded intervention outcome';

export function recordedOutcomeLabel(outcome: string | null | undefined): string {
  return `${RECORDED_OUTCOME_PREFIX}: ${outcome && outcome.length > 0 ? outcome : '—'}`;
}

/** Guard: B6 operator-facing strings must never imply effectiveness / causality / trajectory.
 *  (Applied to labels and any derived display text; not to governed negated disclaimers.) */
export function assertNoEffectivenessFraming(texts: string[]): void {
  const banned = /\beffective|effectiveness|successful intervention|harm[- ]reduc|player improved|caused (improvement|by)|reduced risk|risk (reduced|improv\w*|trajector\w*)|\bworked\b|prevented harm/i;
  for (const t of texts) {
    if (banned.test(t)) throw new Error(`B6 safeguard violation: prohibited effectiveness framing in "${t}"`);
  }
}

// ── Governed DTOs (NO player_id / casino_id / staff identity / message content / risk scores) ──
export interface LinkableInterventionRow {
  id: string;
  intervention_type: string | null;
  intervention_date: string | null;
  outcome: string | null;
  follow_up_required: boolean | null;
}

export interface LinkableInterventionDTO {
  interventionId: string;
  interventionType: string | null;
  interventionDate: string | null;
  recordedOutcome: string | null;   // raw recorded category; UI prefixes with RECORDED_OUTCOME_PREFIX
  followUpRequired: boolean | null;
  alreadyLinked: boolean;
}

export function mapLinkableIntervention(row: LinkableInterventionRow, alreadyLinked: boolean): LinkableInterventionDTO {
  return {
    interventionId: row.id,
    interventionType: row.intervention_type ?? null,
    interventionDate: row.intervention_date ?? null,
    recordedOutcome: row.outcome ?? null,
    followUpRequired: row.follow_up_required ?? null,
    alreadyLinked,
  };
}

export interface ActiveLinkRow {
  id: string;
  intervention_id: string;
  linked_at: string;
  intervention_type: string | null;
  intervention_date: string | null;
  outcome: string | null;
  follow_up_required: boolean | null;
}

export interface ActiveLinkDTO {
  linkId: string;
  interventionId: string;
  linkedAt: string;
  interventionType: string | null;
  interventionDate: string | null;
  recordedOutcome: string | null;
  followUpRequired: boolean | null;
}

export function mapActiveLink(row: ActiveLinkRow): ActiveLinkDTO {
  return {
    linkId: row.id,
    interventionId: row.intervention_id,
    linkedAt: row.linked_at,
    interventionType: row.intervention_type ?? null,
    interventionDate: row.intervention_date ?? null,
    recordedOutcome: row.outcome ?? null,
    followUpRequired: row.follow_up_required ?? null,
  };
}
